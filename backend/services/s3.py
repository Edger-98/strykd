"""AWS S3 integration for daily visual proof uploads.

boto3 is synchronous, so uploads run in a worker thread to avoid blocking the
event loop. Objects are stored PRIVATE and encrypted; proofs are served via
short-lived presigned GET URLs (see `presign_get`) instead of public URLs, so a
proof is only reachable through a signed link we hand out at response time, not
by anyone who guesses/keeps the object URL. We store the S3 *key* in the DB and
sign it on read. Legacy rows that stored a full public URL are handled too.
"""
import asyncio
import logging

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from config import settings

logger = logging.getLogger("strykd.s3")

# Presigned GET links live long enough to cover the public-page cache window
# (600s, see services/cache.py) with large margin, but still expire.
PRESIGN_TTL = 24 * 60 * 60  # 24h

_client = None


def is_configured() -> bool:
    return bool(
        settings.aws_access_key_id
        and settings.aws_secret_access_key
        and settings.aws_s3_bucket
    )


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


def _public_url_prefix() -> str:
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/"


def _extract_key(value: str) -> str | None:
    """Turn a stored proof value into an S3 key.

    New rows store the bare key (e.g. "proofs/<uid>/<date>/<id>.jpg"). Legacy
    rows stored the full public URL; strip the bucket prefix back to the key.
    Returns None for anything we don't recognize (e.g. an unrelated URL)."""
    if not value:
        return None
    prefix = _public_url_prefix()
    if value.startswith(prefix):
        return value[len(prefix):]
    if value.startswith("http://") or value.startswith("https://"):
        return None  # some other URL — leave it alone
    return value  # already a bare key


def presign_get(value: str | None, expires: int = PRESIGN_TTL) -> str | None:
    """Return a short-lived presigned GET URL for a stored proof key/URL.

    Pass-through (unchanged) if S3 isn't configured or the value isn't one of our
    objects, so callers can apply this blindly to any stored proof_url value."""
    if not value or not is_configured():
        return value
    key = _extract_key(value)
    if key is None:
        return value
    try:
        return _get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.aws_s3_bucket, "Key": key},
            ExpiresIn=expires,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("Presign failed for %s: %s", key, exc)
        return value


def _upload(key: str, data: bytes, content_type: str) -> str:
    client = _get_client()
    client.put_object(
        Bucket=settings.aws_s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="private, max-age=86400",
        ServerSideEncryption="AES256",
    )
    return key


async def upload_proof(key: str, data: bytes, content_type: str) -> str:
    """Upload proof bytes to S3 (private, encrypted) and return the stored KEY.

    Callers persist the key and serve it via `presign_get`. Raises RuntimeError
    if S3 is not configured, or on upload failure.
    """
    if not is_configured():
        raise RuntimeError("S3 is not configured (missing AWS credentials or bucket)")
    try:
        return await asyncio.to_thread(_upload, key, data, content_type)
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 upload failed for %s: %s", key, exc)
        raise RuntimeError(f"Upload failed: {exc}") from exc
