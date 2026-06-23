# Strykd — Production Deployment

## Current state

**Live (HTTP) at http://98.84.244.237** — full stack deployed and verified:
Postgres + Redis (Docker), FastAPI under systemd (`strykd-api`), React build
served by Nginx. End-to-end smoke test passed on the box (register → subscription
gate → real LLM onboarding → public page → Redis cache → SSE streaming).

**Pending — domain + SSL:** `strykdapp.com` / `*.strykdapp.com` do not resolve yet. Add
the Namecheap records in `DNS.md` (apex `A` + wildcard `*` `A` → `98.84.244.237`),
then run the certbot step in `setup.sh` for the wildcard HTTPS cert. Until then,
the app is reachable only by IP over HTTP.

## How it was deployed

The repo is **private**, so instead of a server-side `git clone` the working tree
is **rsynced** to the box and `deploy/provision.sh` runs the non-interactive,
HTTP-only provisioning (everything except the interactive DNS-01 cert):

```sh
rsync -az --delete -e "ssh -i strykd-key.pem" \
  --exclude .git --exclude node_modules --exclude .venv --exclude dist \
  --exclude '*.pem' --exclude .env --exclude .claude --exclude __pycache__ \
  ./ ubuntu@98.84.244.237:/home/ubuntu/strykd/

# IMPORTANT: --exclude .env (matches basename at any depth) protects BOTH
#   backend/.env  (app secrets: DB/Redis URLs, JWT/cron, AWS, Stripe, OneSignal)
#   ./.env        (compose secrets: POSTGRES_PASSWORD, REDIS_PASSWORD)
# Never drop it from a --delete rsync or you'll wipe Redis auth / DB creds on the box.

# backend/.env and ./.env are written/maintained separately on the server (real secrets)
ssh -i strykd-key.pem ubuntu@98.84.244.237 \
  "cd /home/ubuntu/strykd && sudo APP_DIR=/home/ubuntu/strykd PUBLIC_IP=98.84.244.237 bash deploy/provision.sh"
```

`provision.sh` is idempotent — re-run after an rsync to redeploy. Note: Nginx
runs as `www-data`, so `/home/ubuntu` needs the traverse bit (`chmod o+x /home/ubuntu`)
for it to read the frontend build.

`setup.sh` remains the canonical full installer (adds the Let's Encrypt wildcard
cert + HTTPS vhost) for the eventual DNS-backed cutover.

---

Infrastructure provisioned in AWS account `664418982465` (us-east-1):

| Resource        | ID                        | Detail                              |
|-----------------|---------------------------|-------------------------------------|
| EC2 instance    | `i-0f3b9391f1dfb4a5a`      | t3.small, Ubuntu 22.04, 20 GB gp3   |
| AMI             | `ami-02013f5b15758f4d4`    | ubuntu-jammy-22.04-amd64-server     |
| Security group  | `sg-00e6faf8e8aeda794`     | `strykd-sg` — tcp 22, 80, 443, 8000 |
| Elastic IP      | `98.84.244.237`            | `eipalloc-034858689fea292a9`        |
| SSH key pair    | `strykd-key`               | private key: `../strykd-key.pem` (gitignored) |

## Deploy steps

1. **DNS** — add the records in [`DNS.md`](./DNS.md) at Namecheap (apex `A` +
   wildcard `*` `A`, both → `98.84.244.237`). Wait for propagation.

2. **Copy the setup script up and run it** (pass secrets as env vars so they
   never touch the repo):

   ```sh
   scp -i ../strykd-key.pem setup.sh ubuntu@98.84.244.237:~

   ssh -i ../strykd-key.pem ubuntu@98.84.244.237

   # on the server:
   chmod +x setup.sh
   ANTHROPIC_API_KEY=sk-ant-... \
   STRIPE_SECRET_KEY=sk_live_... \
   STRIPE_WEBHOOK_SECRET=whsec_... \
   STRIPE_PRICE_ID=price_... \
   ./setup.sh
   ```

3. **DNS-01 challenge** — `setup.sh` pauses at the certbot step and prints a TXT
   value. Add it at Namecheap (`_acme-challenge`, see `DNS.md`), wait ~1 min,
   then press Enter to finish issuing the wildcard cert.

4. Visit `https://strykdapp.com` and any `https://<slug>.strykdapp.com`.

## What setup.sh does

Docker + Compose · Nginx · Certbot → clones the repo → writes `backend/.env` →
starts Postgres + Redis (compose) → runs FastAPI under systemd (`strykd-api`) →
builds the React frontend → Nginx wildcard vhost (`strykdapp.com` + `*.strykdapp.com`,
SSE-friendly proxy to `:8000`, SPA fallback) → Let's Encrypt wildcard cert.

## Useful commands (on the server)

```sh
sudo systemctl status strykd-api      # backend service
sudo journalctl -u strykd-api -f      # backend logs
sudo docker compose ps                # Postgres + Redis
sudo nginx -t && sudo systemctl reload nginx
```
