#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/moodle-ai}"
REPO_URL="${REPO_URL:-https://github.com/eduardo-milleto/moodle-ai.git}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root on the VPS."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git ufw fail2ban

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
rm -f /etc/apt/sources.list.d/docker.sources
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
systemctl enable --now docker

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "Created $APP_DIR/.env. Fill it before starting the app."
  exit 0
fi

docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/docker-compose.yml" up -d --build
