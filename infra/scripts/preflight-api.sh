#!/usr/bin/env bash
# Chạy TRÊN VM sau khi deploy API: bash infra/scripts/preflight-api.sh
# Mục đích: bắt đúng 6 lỗi hay gặp trước khi báo "deploy xong".

HOST='internship-tracker.duckdns.org'
SVC='internship-tracker'
ENV='/opt/internship-tracker/server/.env'

echo "=== 1. Node / npm ==="
NODE=$(node -v 2>/dev/null || echo FAIL)
NPM=$(npm -v 2>/dev/null || echo FAIL)
echo "node=$NODE npm=$NPM"
case "$NODE" in v22.*|v23.*|v24.*) echo "OK node>=22" ;; *) echo "FAIL: can Node 22 LTS qua NodeSource (/usr/bin/node), khong dung nvm" ;; esac

echo "=== 2. systemd ==="
systemctl is-active "$SVC" || echo "FAIL: service khong chay -> systemctl status $SVC; journalctl -u $SVC -n 30"
if systemctl status "$SVC" 2>&1 | grep -q '203/EXEC'; then
  echo "FAIL: 203/EXEC -> systemd khong thay node. Cai NodeSource apt."
fi

echo "=== 3. .env (khong in gia tri secret) ==="
if [ -f "$ENV" ]; then
  echo "OK .env ton tai"
  grep -q '^DATABASE_URL=' "$ENV" && echo "OK DATABASE_URL co" || echo "FAIL: thieu DATABASE_URL"
  grep -q '^CORS_ORIGIN=' "$ENV" && echo "OK CORS_ORIGIN co" || echo "FAIL: thieu CORS_ORIGIN"
  if grep -q '^CORS_ORIGIN=http://localhost' "$ENV"; then
    echo "FAIL: CORS_ORIGIN van la localhost -> phai la https://anhmy1312.github.io"
  else
    echo "OK CORS_ORIGIN khong phai localhost"
  fi
else
  echo "FAIL: khong co $ENV"
fi

echo "=== 4. API local (port 3000) ==="
LOCAL=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/health 2>/dev/null)
echo "GET http://127.0.0.1:3000/health -> $LOCAL"
[ "$LOCAL" = "200" ] && echo "OK API local 200" || echo "FAIL: 502/local -> kiem tra service + proxy_pass"

echo "=== 5. Nginx ==="
sudo nginx -t 2>&1 | tail -2
DUP=$(sudo nginx -T 2>/dev/null | grep -c 'location = /health {')
echo "so location = /health : $DUP (phai = 1)"
[ "$DUP" = "1" ] && echo "OK khong duplicate location" || echo "FAIL: duplicate location /health"
sudo systemctl is-active nginx

echo "=== 6. Tu ngoai qua HTTPS ==="
for p in /health /applications; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$HOST$p")
  echo "GET https://$HOST$p -> $code"
done
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$HOST/health")
echo "GET http://$HOST/health -> $code (phai 301)"

echo "=== 7. Firewall: khong mo 3000 ==="
if sudo ufw status | grep -q '3000'; then
  echo "FAIL: ufw dang mo 3000 (khong can, Nginx proxy 127.0.0.1)"
else
  echo "OK: ufw chi 22/80/443"
fi

echo "=== XONG. Doc ky dong FAIL neu co. ==="
