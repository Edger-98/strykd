# Strykd — Production Deployment

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

4. Visit `https://strykd.io` and any `https://<slug>.strykd.io`.

## What setup.sh does

Docker + Compose · Nginx · Certbot → clones the repo → writes `backend/.env` →
starts Postgres + Redis (compose) → runs FastAPI under systemd (`strykd-api`) →
builds the React frontend → Nginx wildcard vhost (`strykd.io` + `*.strykd.io`,
SSE-friendly proxy to `:8000`, SPA fallback) → Let's Encrypt wildcard cert.

## Useful commands (on the server)

```sh
sudo systemctl status strykd-api      # backend service
sudo journalctl -u strykd-api -f      # backend logs
sudo docker compose ps                # Postgres + Redis
sudo nginx -t && sudo systemctl reload nginx
```
