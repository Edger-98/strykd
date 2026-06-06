"""AWS S3 integration for daily visual proof uploads.

boto3 is synchronous, so uploads run in a worker thread to avoid blocking the
event loop. The bucket is expected to serve objects publicly (read-only) so the
proof gallery on a user's public page renders without auth.
"""
import asyncio
import logging

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from config import settings

logger = logging.getLogger("strykd.s3")

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


def _public_url(key: str) -> str:
    region = settings.aws_region
    bucket = settings.aws_s3_bucket
    # us-east-1 historically omits the region in the virtual-hosted URL, but the
    # regional form works for every region including us-east-1.
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _upload(key: str, data: bytes, content_type: str) -> str:
    client = _get_client()
    client.put_object(
        Bucket=settings.aws_s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000",
    )
    return _public_url(key)


async def upload_proof(key: str, data: bytes, content_type: str) -> str:
    """Upload proof bytes to S3 and return the public URL.

    Raises RuntimeError if S3 is not configured, or on upload failure.
    """
    if not is_configured():
        raise RuntimeError("S3 is not configured (missing AWS credentials or bucket)")
    try:
        return await asyncio.to_thread(_upload, key, data, content_type)
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 upload failed for %s: %s", key, exc)
        raise RuntimeError(f"Upload failed: {exc}") from exc
