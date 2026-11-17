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

echo "==> Kiem tra tu ngoai"
curl -fsS "http://$HOST/health"; echo
curl -fsS -o /dev/null -w "GET / -> %{http_code}\n" "http://$HOST/"

echo "OK"
