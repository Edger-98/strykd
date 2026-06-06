#!/usr/bin/env bash
#
# Strykd non-interactive HTTP provisioner.
# Runs on the EC2 box AFTER the code tree has been rsynced to $APP_DIR and
# backend/.env is in place. Brings the full stack up on port 80 via the
# Elastic IP. SSL + wildcard domain are added later (see setup.sh / DNS.md)
# once Namecheap DNS points at the server.
#
# Idempotent — safe to re-run for redeploys.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/strykd}"
PUBLIC_IP="${PUBLIC_IP:-98.84.244.237}"

echo "==> Provisioning Strykd at ${APP_DIR} (HTTP @ ${PUBLIC_IP})"

# ── 1. Base packages ────────────────────────────────────────────────────────
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git nginx python3-venv python3-pip

# ── 2. Docker + Compose plugin ──────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker ubuntu
fi

# ── 3. Node 20 (for the frontend build) ─────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ── 4. Postgres + Redis via Docker Compose ──────────────────────────────────
echo "==> Starting Postgres + Redis"
cd "${APP_DIR}"
sudo docker compose up -d
echo "==> Waiting for Postgres"
until sudo docker exec strykd_postgres pg_isready -U strykd >/dev/null 2>&1; do sleep 2; done

# ── 5. Backend venv + systemd service ───────────────────────────────────────
echo "==> Backend service"
cd "${APP_DIR}/backend"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip -q
./.venv/bin/pip install -r requirements.txt -q

sudo tee /etc/systemd/system/strykd-api.service > /dev/null <<UNIT
[Unit]
Description=Strykd FastAPI backend
After=network.target docker.service

[Service]
User=ubuntu
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable strykd-api
sudo systemctl restart strykd-api

# ── 5b. Scheduled jobs (cron.d) ─────────────────────────────────────────────
echo "==> Installing scheduled jobs"
CRON_SECRET_VALUE=$(grep -E '^CRON_SECRET=' "${APP_DIR}/backend/.env" | cut -d= -f2- | tr -d '\r"')
if [ -n "${CRON_SECRET_VALUE}" ]; then
  sudo tee /etc/cron.d/strykd > /dev/null <<CRON
# Strykd scheduled jobs (run against the local FastAPI service)
SHELL=/bin/bash
# Nightly plan generation: 02:10 UTC daily
10 2 * * * root curl -fsS -X POST http://127.0.0.1:8000/cron/nightly -H "X-Cron-Secret: ${CRON_SECRET_VALUE}" >/dev/null 2>&1
# Streak-risk reminders: hourly at :05 (endpoint self-checks 8pm-in-user-timezone + dedupe)
5 * * * * root curl -fsS -X POST http://127.0.0.1:8000/cron/streak-reminders -H "X-Cron-Secret: ${CRON_SECRET_VALUE}" >/dev/null 2>&1
CRON
  sudo chmod 0644 /etc/cron.d/strykd
  sudo systemctl restart cron
else
  echo "  WARNING: CRON_SECRET not found in .env — skipping cron.d install"
fi

# ── 6. Frontend build ───────────────────────────────────────────────────────
echo "==> Building frontend"
cd "${APP_DIR}/frontend"
npm ci || npm install
npm run build

# ── 7. Nginx (HTTP only, by IP / any host) ──────────────────────────────────
echo "==> Configuring Nginx (HTTP)"
sudo tee /etc/nginx/sites-available/strykd > /dev/null <<NGINX
server {
    listen 80 default_server;
    server_name _;

    root ${APP_DIR}/frontend/dist;
    index index.html;

    # Allow base64 avatar uploads (a 5MB image is ~6.7MB once base64-encoded)
    client_max_body_size 8M;

    # Frontend API calls — mirrors the Vite dev proxy: strip the /api prefix.
    # The trailing slash on proxy_pass rewrites /api/public/x -> /public/x.
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # SSE streaming (POST /api/replan)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # Direct server-to-server / ops routes (Stripe webhook, health, cron)
    location ~ ^/(billing|health|cron) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/strykd /etc/nginx/sites-enabled/strykd
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "════════════════════════════════════════════════"
echo "  Strykd is live (HTTP):  http://${PUBLIC_IP}"
echo "  Backend: sudo systemctl status strykd-api"
echo "  Add Namecheap DNS + run the certbot step in setup.sh for SSL."
echo "════════════════════════════════════════════════"
