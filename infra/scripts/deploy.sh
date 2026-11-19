#!/usr/bin/env bash
# Deploy site tinh len staging. Chay tu MAY DEV (khong chay tren VPS).
#
#   bash infra/scripts/deploy.sh
#   TARGET=staging HOST=internship-tracker.duckdns.org bash infra/scripts/deploy.sh
#
# Khong build, khong restart service: chi copy 4 file vao web root.

set -euo pipefail

TARGET="${TARGET:-staging}"
DEST="${DEST:-/var/www/internship-tracker}"
HOST="${HOST:-internship-tracker.duckdns.org}"

cd "$(dirname "$0")/../.."

echo "==> Copy 4 file tinh -> $TARGET:$DEST"
scp index.html styles.css app.js favicon.svg "$TARGET:$DEST/"

echo "==> Kiem tra tu ngoai (HTTPS, khong tin 301)"
# HTTP tra 301 cho moi request -> curl khong co -L se nhan body rong van exit 0.
# Phai dung https + doc body de phat hien site trang / cert hong / proxy sai.
if ! curl -fsSL "https://$HOST/health" | grep -q '"status":"ok"'; then
  echo "FAIL: /health khong tra status ok (site hong hoac cert/proxy sai)" >&2
  exit 1
fi
curl -fsS -o /dev/null -w "GET / -> %{http_code}\n" "https://$HOST/"
curl -fsSL "https://$HOST/health"; echo

echo "OK"
