#!/usr/bin/env bash
# Deploy code mới lên staging. Chạy bằng user deploy (hoặc sudo -u deploy).
#
#   bash /opt/internship-tracker/infra/scripts/deploy.sh
#
# Không dùng để cấu hình hạ tầng — chỉ kéo code + build + restart.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/internship-tracker}"
SERVICE="${SERVICE:-internship-tracker-api}"

cd "$APP_DIR"

echo "==> Code hiện tại: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
git pull --ff-only

cd server
npm ci
npm run build

echo "==> Restart $SERVICE"
sudo systemctl restart "$SERVICE"
sleep 2
sudo systemctl --no-pager --lines=15 status "$SERVICE" || true

echo "==> Health check local"
if curl -fsS --max-time 5 http://127.0.0.1:3000/health; then
  echo
  echo "OK. Kiểm tra công khai: curl -I https://<host>/health"
else
  echo "FAIL: app không trả /health. Xem: sudo journalctl -u $SERVICE -n 80 --no-pager" >&2
  exit 1
fi
