#!/usr/bin/env bash
#
# Strykd production server setup
# ------------------------------
# Run on a fresh Ubuntu 22.04 EC2 instance as the `ubuntu` user:
#
#   scp -i strykd-key.pem deploy/setup.sh ubuntu@98.84.244.237:~
#   ssh -i strykd-key.pem ubuntu@98.84.244.237
#   chmod +x setup.sh && ./setup.sh
#
# Installs Docker + Compose, Nginx, Certbot; clones the repo; writes .env;
# starts Postgres + Redis + the FastAPI backend; configures Nginx wildcard
# routing for strykdapp.com and *.strykdapp.com; obtains a Let's Encrypt wildcard
# cert via DNS-01 challenge.
#
# Idempotent where practical — safe to re-run.
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Config — edit these before running, or export them in the environment first
# ─────────────────────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-strykdapp.com}"
REPO="${REPO:-https://github.com/Edger-98/strykd.git}"
APP_DIR="${APP_DIR:-/home/ubuntu/strykd}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-chinemenwatu98@gmail.com}"

# Secrets — MUST be provided via environment, never hard-code in the repo:
#   ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
#   STRIPE_PRICE_ID, JWT_SECRET, CRON_SECRET
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
STRIPE_PRICE_ID="${STRIPE_PRICE_ID:-}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 16)}"

echo "==> Strykd setup starting for ${DOMAIN}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. System packages
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y \
  ca-certificates curl gnupg git nginx \
  software-properties-common ufw

# ─────────────────────────────────────────────────────────────────────────────
# 2. Docker + Docker Compose plugin (official repo)
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker ubuntu
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Certbot (via snap, with the nginx + DNS plugins)
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v certbot >/dev/null 2>&1; then
  echo "==> Installing Certbot"
  sudo snap install core && sudo snap refresh core
  sudo snap install --classic certbot
  sudo ln -sf /snap/bin/certbot /usr/bin/certbot
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Clone (or update) the repository
# ─────────────────────────────────────────────────────────────────────────────
if [ ! -d "${APP_DIR}/.git" ]; then
  echo "==> Cloning ${REPO}"
  git clone "${REPO}" "${APP_DIR}"
else
  echo "==> Updating existing checkout"
  git -C "${APP_DIR}" pull --ff-only
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Write backend/.env  (production)
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Writing backend/.env"
cat > "${APP_DIR}/backend/.env" <<ENV
DATABASE_URL=postgresql://strykd:strykd@localhost:5432/strykd
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_PRICE_ID=${STRIPE_PRICE_ID}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://${DOMAIN}
BASE_DOMAIN=${DOMAIN}
CRON_SECRET=${CRON_SECRET}
ENV
chmod 600 "${APP_DIR}/backend/.env"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Start Postgres + Redis via Docker Compose
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Starting Postgres + Redis"
cd "${APP_DIR}"
sudo docker compose up -d
echo "==> Waiting for Postgres to be healthy"
until sudo docker exec strykd_postgres pg_isready -U strykd >/dev/null 2>&1; do
  sleep 2
done

# ─────────────────────────────────────────────────────────────────────────────
# 7. Run the FastAPI backend as a systemd service (in its own venv)
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Setting up the backend service"
sudo apt-get install -y python3-venv python3-pip
cd "${APP_DIR}/backend"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

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
sudo systemctl enable --now strykd-api

# ─────────────────────────────────────────────────────────────────────────────
# 8. Build the frontend (served as static files by Nginx)
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Building the frontend"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
cd "${APP_DIR}/frontend"
npm ci || npm install
npm run build   # → frontend/dist

# ─────────────────────────────────────────────────────────────────────────────
# 9. Obtain the Let's Encrypt WILDCARD cert via DNS-01
#    Wildcards CANNOT use HTTP-01 — DNS-01 is mandatory.
#    This is interactive: certbot prints a TXT record you must add at Namecheap
#    (_acme-challenge.strykdapp.com), then you press Enter to continue.
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Obtaining wildcard SSL certificate (DNS-01 challenge)"
echo "    You will be asked to create a TXT record at your DNS provider."
sudo certbot certonly --manual --preferred-challenges dns \
  --agree-tos -m "${LETSENCRYPT_EMAIL}" --no-eff-email \
  -d "${DOMAIN}" -d "*.${DOMAIN}"

# ─────────────────────────────────────────────────────────────────────────────
# 10. Nginx — wildcard routing.
#     ALL hosts (strykdapp.com and every {slug}.strykdapp.com) proxy to the FastAPI
#     backend; the app does slug lookup internally. Static frontend assets are
#     served directly, with SPA fallback to index.html.
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Configuring Nginx"
sudo tee /etc/nginx/sites-available/strykd > /dev/null <<NGINX
# Redirect all HTTP to HTTPS
server {
    listen 80;
    server_name ${DOMAIN} *.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} *.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root ${APP_DIR}/frontend/dist;
    index index.html;

    # Allow avatar (base64) and daily proof uploads (videos up to 50MB)
    client_max_body_size 60M;

    # Frontend API calls — mirrors the Vite dev proxy: trailing slash on
    # proxy_pass strips the /api prefix (/api/public/x -> /public/x).
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # SSE streaming (POST /api/replan) — disable buffering
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

    # SPA — serve built frontend, fall back to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/strykd /etc/nginx/sites-enabled/strykd
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Strykd is live."
echo "  Main site:   https://${DOMAIN}"
echo "  Subdomains:  https://<slug>.${DOMAIN}"
echo ""
echo "  Backend:  sudo systemctl status strykd-api"
echo "  Logs:     sudo journalctl -u strykd-api -f"
echo "  Cert renewal: certbot renew  (wildcard needs the DNS-01 hook re-run)"
echo "════════════════════════════════════════════════════════════════"
