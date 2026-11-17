# Làm network 16 → 22/11 — hướng dẫn từng bước

> Đích của tuần: `https://<host>/health` trả `200` JSON, HTTP trả `301`, SSL Labs ≥ A,
> alert thật đã nhận, `infra/` nằm trong PR.
> Người đọc: người **trực tiếp** gõ lệnh. Không cần biết trước Nginx/systemd.

---

## 0. Bức tranh tổng thể — request đi qua đâu

```text
Trình duyệt
  │ ① DNS: staging.<domain> → ?        (A record, TTL 300)
  ▼
  │ ② TCP :443  → IP VPS              (ufw allow 443)
  ▼
Nginx :443                             (TLS, redirect, headers)
  │ ③ proxy_pass 127.0.0.1:3000
  ▼
Node service (systemd)                 (chỉ bind localhost)
  ▼
200 JSON
```

| Lớp | Khái niệm | Kiểm tra bằng | Hỏng thì thấy gì |
|---|---|---|---|
| DNS | A record trỏ IP, TTL | `Resolve-DnsName`, dnschecker.org | `ERR_NAME_NOT_RESOLVED`, `curl: (6)` |
| Firewall/cloud | port 22/80/443 được mở 2 lớp: cloud + ufw | `Test-NetConnection -Port 80` | timeout (không phải "refused") |
| TCP | có process listen không | `ss -ltnp` | `Connection refused` |
| TLS | cert đúng host, còn hạn | `curl -v`, SSL Labs | `certificate verify failed` |
| HTTP | status code, header | `curl -I` | 301/404/502 |
| Reverse proxy | Nginx → app | `nginx -t`, error log | 502/504 |
| Service | systemd giữ process sống | `systemctl status`, `journalctl` | 502 sau reboot |

**Quy tắc vàng của tuần này:** mỗi ngày chỉ thêm **một lớp**, và lớp mới chỉ được coi là xong khi có **lệnh chứng minh**. Đừng làm DNS + Nginx + Node + TLS trong một buổi.

---

## Ngày 16/11 (T2) — Tạo VPS, chốt sự thật hạ tầng

**Thời lượng:** 60–90'. **Deliverable:** IP công khai + `docs/infra.md` mục 1 đã điền.

> **Trạng thái 15/11:** VM **đã được tạo xong** (`vm-it-staging`, IP `40.83.74.1`, SSH vào được). Hôm nay chỉ cần **xác nhận + thêm swap + ghi chép**, không phải tạo lại. Nếu phải làm lại từ đầu thì theo bảng 1.1.

### 1.1. Nếu phải tạo máy (Azure for Students)

| Chọn | Giá trị |
|---|---|
| Image | **Ubuntu Server 24.04 LTS – x64 Gen2** (không phải ARM) |
| Size | **`Standard_B2ats_v2`** — 1 vCPU / 1 GiB (B-series bị chặn ở Southeast Asia → dùng **East Asia**) |
| Region | **East Asia (Hong Kong)** — B1s/B2ats_v2 chỉ mở ở region này với subscription student |
| Authentication | **SSH public key** → *Use existing public key* → dán `id_ed25519_it.pub` |
| Username | **`deploy`** (không dùng `root`, không dùng password) |
| Inbound ports | **SSH (22), HTTP (80), HTTPS (443)** |
| Public IP (tab Networking) | **Create new** → SKU **Standard** → **Static** |
| OS disk | **Standard SSD** |

### 1.2. Việc đầu tiên sau khi có IP

Mở **Azure Portal ở tab riêng** (đường recovery khi mất SSH). Rồi từ Windows:

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_it" deploy@40.83.74.1
```

Lần đầu hỏi `Are you sure you want to continue connecting?` → gõ **`yes`**.

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y curl vim htop git dnsutils ufw fail2ban unattended-upgrades ca-certificates
sudo timedatectl set-timezone UTC
curl -4 ifconfig.me ; lsb_release -ds ; uname -r ; df -h /
```

Kỳ vọng: IP in ra **40.83.74.1**; `Ubuntu 24.04.x LTS`. Dùng **UTC** để log/alert khớp nhau, đừng để giờ VN rồi lệch 7 tiếng khi đọc `journalctl`.

### 1.3. Thêm swap 2 GB (bắt buộc với máy 1 GiB RAM)

Không có swap thì Node sẽ bị **OOM-kill** đúng lúc demo:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # phải thấy Swap: 2.0Gi
```

### 1.4. Azure có 2 lớp firewall — kiểm tra cả hai

| Lớp | Kiểm tra | Kỳ vọng |
|---|---|---|
| NSG (ngoài) | Portal → VM → **Networking** → Inbound port rules | 3 rule Allow: **22, 80, 443** |
| ufw (trong) | `sudo ufw status verbose` | sẽ cấu hình ngày 17/11 |

Thiếu rule 80/443 ở NSG thì ngày 18–20/11 `curl` từ ngoài sẽ **timeout** dù `ufw` đã mở. Đây là bẫy Azure khác hẳn Oracle (Oracle có `iptables` chặn sẵn, Azure thì không — chỉ cần NSG + ufw).

### 1.5. Ghi lại sự thật (đừng dựa vào trí nhớ)

Điền `docs/infra.md` mục 1: provider, region, spec, IP, OS, console URL, người liên hệ, nơi giữ private key. Chụp 1 ảnh màn hình Portal có IP → `docs/evidence/16-vps-created.png`.

### 1.6. Đừng làm hôm nay

Không cài Nginx, không cài Node, không sửa SSH. Hôm nay chỉ xác nhận máy + swap + ghi chép. Buổi kickoff cũng chiếm thời gian rồi.

> **Cuối buổi nhớ:** Portal → VM → **Stop** → chọn **Deallocate** để giữ credit $100.

---

## Ngày 17/11 (T3) — `deploy` user, SSH key, ufw, fail2ban

**Thời lượng:** 2h. **Deliverable:** SSH key-only, không root, firewall 22/80/443.

> ✅ **Đã hoàn thành 16/11 (sớm 1 ngày)** — SSH key-only, `PermitRootLogin no`, ufw active 22/80/443, fail2ban active, `authorized_keys` đúng 2 key. Bằng chứng: `docs/evidence/17-*.png`, chi tiết trong `docs/infra.md`.
>
> Phần dưới giữ nguyên làm **runbook cho lần dựng lại** (drill 26/11). Ngày 17/11 dùng thời gian này để chốt Issue #1 + chuẩn bị Nginx cho 18/11.

Đây là ngày **nguy hiểm nhất** (dễ tự khoá mình ra ngoài). Làm đúng thứ tự dưới đây.

### 17.1. Chuẩn bị trên máy Windows

```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519_it" `
  "C:\dev\internship_tracker\infra\bootstrap.sh" `
  deploy@40.83.74.1:/tmp/
```

### 17.2. Chạy pha 1 (an toàn: chưa đụng SSH)

> **Khác Oracle:** Azure đã tạo sẵn user `deploy` + `sudo` NOPASSWD (`/etc/sudoers.d/90-cloud-init-users`). Nên phần "tạo user" trong script là **thừa** — chỉ cần ufw + fail2ban. Kiểm tra trước: `sudo -n true && echo "sudo ok"`.

Trên VPS:

```bash
bash /tmp/bootstrap.sh
```

Script làm: cài package → tạo user `deploy` (đã có → bỏ qua) → copy public key sang `/home/deploy/.ssh/authorized_keys` → ufw (allow 22 **trước** rồi mới enable) → fail2ban cho sshd → unattended-upgrades.

Nếu chưa muốn chạy script, làm tay đúng 7 lệnh này:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo systemctl enable --now fail2ban
```

**Thứ tự bắt buộc:** `allow 22` **trước** `enable`. Làm ngược là tự khoá mình ra ngoài.

### 17.3. Test ở TERMINAL MỚI (bắt buộc, trước khi làm gì tiếp)

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_it" deploy@40.83.74.1
```

Trên VPS:

```bash
whoami          # deploy
sudo whoami     # root
```

**Chỉ khi đã vào được** mới chạy hardening:

```bash
bash /tmp/bootstrap.sh --harden
```

`--harden` ghi `/etc/ssh/sshd_config.d/00-hardening.conf` (`PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `MaxAuthTries 3`), `sshd -t` rồi `reload` (không restart → session cũ vẫn sống).

> ⚠️ Tên file **phải là `00-`**, không phải `99-`: sshd đọc `sshd_config.d/*.conf` theo thứ tự chữ cái và lấy **giá trị ĐẦU TIÊN**. Cloud image đã có `50-cloud-init.conf` → file `99-` sẽ thua. Kiểm bằng `sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication'`.

### 17.4. Chứng minh (đây là ảnh chụp cho PR)

```bash
sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|kbdinteractive|maxauthtries'
sudo ufw status verbose
sudo fail2ban-client status sshd
```

Kỳ vọng:

```text
permitrootlogin no
passwordauthentication no
kbdinteractiveauthentication no
maxauthtries 3

Status: active
Default: deny (incoming), allow (outgoing)
22/tcp  ALLOW IN  Anywhere
80/tcp  ALLOW IN  Anywhere
443/tcp ALLOW IN  Anywhere

Status for the jail: sshd
|- Currently banned: 0
```

Và từ Windows:

```powershell
ssh root@40.83.74.1              # phải bị từ chối: Permission denied (publickey)
Test-NetConnection 40.83.74.1 -Port 22   # TcpTestSucceeded : True
```

Chỉ **bây giờ** mới đóng tab root. Ảnh: `17-sshd-ufw-keys.png` + `17-root-denied.png`.

### 17.5. Nếu tự khoá SSH (bình tĩnh, luôn cứu được)

| Triệu chứng | Nguyên nhân | Cứu |
|---|---|---|
| `Permission denied (publickey)` cho `deploy` | key chưa đúng chỗ / sai quyền | vào console provider → `ls -l /home/deploy/.ssh` → `chown -R deploy:deploy`, `chmod 700 .ssh`, `chmod 600 authorized_keys` |
| Không SSH được ai cả | ufw chặn 22 | console → `ufw allow 22/tcp` (hoặc `ufw disable` tạm) |
| `Connection timed out` | cloud firewall/security group chặn 22 | sửa ở console provider, không phải ufw |
| `Too many authentication failures` | Windows gửi nhiều key | `ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519_it deploy@IP` |

Nguyên tắc: **console provider là đường sống**, không phải "may mắn". Mở nó trước khi hardening.

---

## Ngày 18/11 (T4) — DNS + Nginx, `http://<host>` trả 200

**Thời lượng:** 2h. **Deliverable:** DNS trỏ đúng IP, Nginx phục vụ `/health` tĩnh.

### 18.1. Trỏ hostname về IP (DuckDNS)

| Type | Name | Value | TTL |
|---|---|---|---|
| A (DuckDNS) | `internship-tracker.duckdns.org` | **40.83.74.1** | 60 |

DuckDNS không có UI record kiểu A — cập nhật bằng 1 lệnh (dán vào trình duyệt hoặc `curl`), kết quả phải là `OK`:

```text
https://www.duckdns.org/update?domains=internship-tracker&token=<token>&ip=40.83.74.1
```

Hoặc đăng nhập **duckdns.org** → điền IP vào ô `current ip` → **update ip**.

- **Không tạo AAAA** ở DNS khác cho hostname này — VPS không có IPv6 công khai. Một AAAA sai làm hỏng toàn bộ truy cập dù A đúng.
- Sau này đổi IP (rebuild): chạy lại đúng lệnh trên với IP mới.

Kiểm tra từ 2 nơi (đừng tin mỗi máy mình):

```powershell
Resolve-DnsName internship-tracker.duckdns.org -Type A -Server 1.1.1.1
Resolve-DnsName internship-tracker.duckdns.org -Type A -Server 8.8.8.8
```

Hoặc `https://dnschecker.org/#A/internship-tracker.duckdns.org` — phải xanh ở nhiều nước. Chưa xanh thì chờ 1–5 phút, **đừng sửa liên tục**.

### 18.2. Cài Nginx và chứng minh port 80 mở

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
curl -I http://127.0.0.1        # 200, chứng minh nginx sống
```

Từ **Windows** (quan trọng: test bằng IP trước, để tách lỗi mạng khỏi lỗi DNS):

```powershell
curl.exe -I http://40.83.74.1
```

- `200` → port 80 thông, đi tiếp.
- `timeout` → **NSG của Azure chưa mở 80** (Portal → VM → Networking → Inbound port rules). Đây là nguyên nhân số 1 khi lên Azure.

### 18.3. Đưa site config vào

Clone repo lên VPS trước (nếu chưa):

```bash
sudo mkdir -p /opt/internship-tracker
sudo chown deploy:deploy /opt/internship-tracker
sudo -u deploy git clone https://github.com/<org>/<repo>.git /opt/internship-tracker
```

File **pha 1** (HTTP only, chưa cần cert): `infra/nginx/internship-tracker.http.conf`.
File pha 2 (HTTPS): `infra/nginx/internship-tracker.conf` — **hôm nay chưa dùng** (block 443 không nạp được khi chưa có cert).

```bash
sudo cp /opt/internship-tracker/infra/nginx/internship-tracker.http.conf \
        /etc/nginx/sites-available/internship-tracker
sudo ln -sf /etc/nginx/sites-available/internship-tracker /etc/nginx/sites-enabled/internship-tracker
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                 # phải: syntax is ok / test is successful
sudo systemctl reload nginx
```

`server_name` trong file đã là `internship-tracker.duckdns.org` — **không cần `sed`**. Nếu sau này đổi host thì sửa đúng 1 dòng `server_name` trong repo rồi `scp` lại (để repo và server không lệch nhau).

### 18.4. Nếu timeout: kiểm tra NSG của Azure

Chỉ khi `curl http://40.83.74.1` timeout mà `sudo ufw status` đã mở 80:

1. Portal → `vm-it-staging` → **Networking** → **Inbound port rules**.
2. Phải có 3 rule `Allow` cho **22, 80, 443**, Source `Any`.
3. Thiếu → **Add inbound port rule** → Destination port ranges `80` (rồi `443`), Protocol `TCP`, Action `Allow`, Priority `1010`/`1020`, Name `Allow-HTTP`/`Allow-HTTPS`.

Azure Ubuntu **không** có `iptables` chặn sẵn như Oracle — chỉ cần NSG + ufw, đúng 2 lớp. Nếu vẫn timeout sau khi mở NSG, kiểm tra `sudo ss -ltnp | grep :80` (Nginx có listen không).

### 18.5. Chứng minh

```bash
# trên VPS
curl -sS -H 'Host: staging.<domain>' http://127.0.0.1/health
curl -sS -H 'Host: staging.<domain>' -o /dev/null -w '%{http_code}\n' http://127.0.0.1/
```

```powershell
# trên Windows
curl.exe -sS http://staging.<domain>/health     # {"status":"ok",...}
curl.exe -I  http://staging.<domain>/           # 404
```

`-H 'Host: ...'` là cách test Nginx khi DNS chưa lan — hiểu đúng bản chất: `server_name` so khớp **header Host**, không phải "tên miền trong DNS".

### 18.6. Lỗi hay gặp ngày 18

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Vẫn thấy "Welcome to nginx" | còn `sites-enabled/default` | `sudo rm -f /etc/nginx/sites-enabled/default` rồi reload |
| `403 Forbidden` | `root` trỏ thư mục không đọc được | `namei -l <path>`, sửa `chmod`/`chown` |
| 404 mọi đường | sai `server_name` / request vào site khác | `sudo nginx -T \| grep -n server_name` |
| DNS ra IP lạ | Cloudflare proxy đang bật (cam) | đổi sang **DNS only** |
| `curl: (6) Could not resolve` | record chưa lan / sai tên | `Resolve-DnsName`, dnschecker |
| Timeout | cloud firewall / Oracle iptables | mục 18.4 |

Ảnh: `18-dns-dig.png`, `18-curl-http.png`.

---

## Ngày 19/11 (T5) — Node 22 + systemd + proxy `/health`

**Thời lượng:** 2h. **Deliverable:** `http://<host>/health` lấy JSON **từ app**, không phải từ Nginx.

### 19.1. Cài Node 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v      # v22.x
```

### 19.2. Code + thư mục

```bash
sudo mkdir -p /opt/internship-tracker
sudo chown deploy:deploy /opt/internship-tracker
# Đã clone ngày 18/11 -> chỉ cần: sudo -u deploy git -C /opt/internship-tracker pull --ff-only
sudo -u deploy git clone https://github.com/<org>/<repo>.git /opt/internship-tracker
```

Nếu repo/API chưa sẵn sàng, dùng **placeholder 10 dòng** để không bị block (thay bằng code thật ngày 23/11):

```bash
sudo -u deploy mkdir -p /opt/internship-tracker/server/src
sudo -u deploy tee /opt/internship-tracker/server/src/index.js >/dev/null <<'EOF'
const http = require('node:http');
const port = Number(process.env.PORT || 3000);
const t0 = Date.now();
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: Math.round((Date.now() - t0) / 1000) }));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
}).listen(port, '127.0.0.1', () => console.log(`listening on 127.0.0.1:${port}`));
EOF
```

**Bind `127.0.0.1`, không phải `0.0.0.0`.** App chỉ cần Nginx gọi tới; bind public là mở thêm 1 cửa không ai quản lý (và Docker sau này sẽ đi xuyên ufw — xem `docs/infra.md` mục 14).

### 19.3. systemd

```bash
sudo cp /opt/internship-tracker/infra/systemd/internship-tracker-api.service /etc/systemd/system/
sudo sed -i 's#dist/index.js#src/index.js#' /etc/systemd/system/internship-tracker-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now internship-tracker-api
systemctl status --no-pager internship-tracker-api
```

Chứng minh **trước khi** đụng Nginx:

```bash
curl -sS http://127.0.0.1:3000/health
ss -ltnp | grep 3000        # phải thấy 127.0.0.1:3000, KHÔNG phải 0.0.0.0:3000
```

### 19.4. Đổi `/health` sang proxy

Mở `/etc/nginx/sites-available/internship-tracker`, comment 3 dòng block tĩnh, bỏ comment block `proxy_pass`, rồi:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sS http://staging.<domain>/health
```

Kỳ vọng JSON **không còn** `"phase":"static"` → chứng minh request đã đi qua 3 lớp: DNS → Nginx → Node.

### 19.5. Lỗi hay gặp ngày 19

| Mã | Nghĩa | Xem ngay |
|---|---|---|
| 502 | Nginx không gọi được app | `systemctl status`, `journalctl -u internship-tracker-api -n 50`, `ss -ltnp \| grep 3000` |
| 504 | app treo, quá `proxy_read_timeout` | log app, thử `time curl` trực tiếp cổng 3000 |
| 404 | app không có route `/health` | `curl 127.0.0.1:3000/health` |
| `status=203/EXEC` | `ExecStart` sai đường dẫn | `ls -l /usr/bin/node /opt/.../src/index.js` |
| `EADDRINUSE` | process cũ còn giữ port | `sudo ss -ltnp \| grep 3000` → `kill` hoặc `systemctl restart` |
| App chết sau logout | chạy bằng `node` tay, không qua systemd | luôn dùng `systemctl`, không `nohup` |

Ảnh: `19-systemd.png`, `19-proxy.png` (kèm `journalctl` có dòng listen).

---

## Ngày 20/11 (T6) — Certbot, HTTPS, headers, SSL Labs

**Thời lượng:** 2h. **Deliverable:** `https://<host>/health` 200, HTTP 301, SSL Labs ≥ A.

### 20.1. Lấy cert (test trước, thật sau)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d staging.<domain> --dry-run   # KHÔNG tốn quota
sudo certbot certonly --nginx -d staging.<domain>             # cấp thật
sudo certbot certificates
```

Vì sao `certonly` chứ không `--nginx` trơn: `certonly` **chỉ xác thực**, không sửa file Nginx của bạn → config trong repo vẫn là bản thật, rebuild không lệch.

Lỗi hay gặp:

| Lỗi | Nguyên nhân | Sửa |
|---|---|---|
| `Timeout during connect` | :80 không tới được / DNS sai | test `curl -I http://<domain>` từ ngoài; mở 80 |
| `Invalid response ... 404` | Nginx không phục vụ `/.well-known/acme-challenge` | bật proxy Cloudflare? tắt; kiểm tra `server_name` |
| `too many certificates already issued` | đã thử nhiều lần với domain thật | dùng `--staging` đến khi chắc, chờ 1 tuần nếu đã dính |
| `Could not find a virtual host` | `server_name` không khớp | sửa `server_name`, `nginx -t`, reload |

### 20.2. Bật cấu hình HTTPS

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp /opt/internship-tracker/infra/nginx/snippets/*.conf /etc/nginx/snippets/
sudo cp /opt/internship-tracker/infra/nginx/internship-tracker.conf /etc/nginx/sites-available/internship-tracker
sudo sed -i 's/staging\.example\.com/staging.<domain>/g' /etc/nginx/sites-available/internship-tracker
sudo nginx -t && sudo systemctl reload nginx
```

File `.conf` này đã: redirect 80→301, `TLSv1.2 TLSv1.3`, HSTS, security headers qua snippet, `/` trả 404, `/health` proxy.

> **Nếu hôm 19/11 bạn đã chuyển `/health` sang `proxy_pass`** thì trong file `.conf` vừa copy cũng phải làm lại đúng vậy (comment block tĩnh, bỏ comment block proxy). Không làm thì `/health` tự quay về bản tĩnh và mất bằng chứng "request đi qua app".

### 20.3. Chứng minh từ Windows

```powershell
curl.exe -I http://staging.<domain>/health     # 301 + Location: https://...
curl.exe -sS https://staging.<domain>/health   # 200 + JSON
curl.exe -I https://staging.<domain>/          # 404 nhưng VẪN có 4 header
curl.exe -I https://staging.<domain>/health | Select-String -Pattern "strict-transport|x-content-type|x-frame|referrer"
```

Hoặc chạy script có sẵn (kiểm tra 1 lượt DNS/TLS/redirect/headers/404):

```powershell
powershell -File "infra\scripts\verify.ps1" -TargetHost staging.<domain>
```

### 20.4. SSL Labs

Mở `https://www.ssllabs.com/ssltest/analyze.html?d=staging.<domain>&hideResults=on`, chờ 1–3 phút. Lưu ảnh **có ngày** vào `docs/evidence/20-ssllabs.png`.

| Hạng | Nghĩa | Sửa nếu thấp |
|---|---|---|
| A+ | có HSTS dài + chỉ TLS1.2/1.3 | muốn A+ thì tăng `max-age` + thêm `includeSubDomains` (chỉ khi kiểm soát hết subdomain) |
| A | đủ tốt, mục tiêu trial | — |
| B | còn TLS 1.0/1.1 | `ssl_protocols TLSv1.2 TLSv1.3;` |
| C–F | cipher yếu / cert chain thiếu / lỗi | `ssl_ciphers` ECDHE-only, dùng `fullchain.pem` |

**HSTS là một chiều.** Đã bật `max-age` 1 năm thì trình duyệt sẽ luôn đi HTTPS tới host đó; đừng thêm `includeSubDomains`/`preload` trong trial.

### 20.5. Renewal

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Ảnh `20-renew-dryrun.png`. Cert hết hạn = mất HTTPS = mất điểm cả trial, nên bước này **không được bỏ**.

---

## Ngày 21/11 (T7) — Uptime monitor + alert thật

**Thời lượng:** 1h. **Deliverable:** alert tới kênh **chung**, có đo độ trễ.

### 21.1. Tạo monitor

UptimeRobot → Add New Monitor:

| Trường | Giá trị |
|---|---|
| Type | **Keyword** (tốt hơn HTTP: bắt cả trường hợp 200 nhưng body sai) |
| URL | `https://staging.<domain>/health` |
| Keyword | `"status":"ok"` |
| Interval | 5 phút (free) |
| Alert contacts | email chung + **Webhook → Discord URL** |

Thêm monitor thứ 2 (tùy chọn, rất đáng): `http://staging.<domain>/health`, kỳ vọng **301** — bắt được lỗi ai đó tắt redirect.

> Đừng tự host Uptime Kuma trên **cùng** VPS: VPS chết thì monitor chết theo, không ai báo. Uptime Kuma chỉ hợp khi đặt ở máy/host khác (MVP sau).

### 21.2. Test alert thật (đây là bằng chứng, không phải "chắc là chạy")

```bash
# trên VPS, ghi lại giờ
date -u +%FT%TZ
sudo systemctl stop internship-tracker-api
```

Chờ ≥ 6 phút (interval 5' + 1' trễ), xác nhận Discord/email có alert, ghi giờ nhận. Rồi:

```bash
sudo systemctl start internship-tracker-api
curl -sS https://staging.<domain>/health
```

Ghi vào `docs/infra.md` mục 12: **stop lúc ___, nhận alert lúc ___, độ trễ ___ phút**, ảnh `21-alert.png`.

Nếu không thấy alert: kiểm tra monitor đang "Up" giả (do cache), webhook URL sai, hoặc alert contact chưa tick vào monitor.

### 21.3. Ghi chú phạm vi

TLS expiry alert và "deep health" (kiểm tra cả DB) là việc của MVP tuần 1–2, **không** nhét vào tuần này. Nhưng ghi vào `docs/infra.md` mục 14 "việc còn nợ" để không quên.

---

## Ngày 22/11 (CN) — Commit `infra/`, PR, báo cáo

**Thời lượng:** 1h. **Deliverable:** PR Week 1 + báo cáo 10 dòng.

### 22.1. Đồng bộ VPS → repo (bước ai cũng quên)

```powershell
scp -r deploy@<IP>:/etc/nginx/sites-available/internship-tracker trial-a/infra/nginx/internship-tracker.conf
scp -r deploy@<IP>:/etc/nginx/snippets/security.conf trial-a/infra/nginx/snippets/
```

So sánh bằng mắt: `server_name` thật, cert path, block `/health` đang là static hay proxy. Nếu khác repo → sửa repo, **không** để "trên server mới là bản đúng".

### 22.2. Trước khi commit

```powershell
cd "C:\Users\PC\OneDrive\Documents\Default Project"
git status
git diff --stat
```

- [ ] Không có `.env`, `id_ed25519*`, token, `*.pem`.
- [ ] `docs/evidence/` có ≥ 6 ảnh (16, 17, 18, 19, 20, 21).
- [ ] `docs/infra.md` đã điền mục 1, 4, 12 (không còn `[TODO]` ở 3 mục này).
- [ ] PR ≤ 300 dòng thay đổi.

### 22.3. PR

```powershell
git checkout -b infra/week1-edge
git add infra docs
git commit -m "infra: VPS bootstrap, nginx edge, TLS, uptime alert"
git push -u origin infra/week1-edge
gh pr create --fill --base main
```

Body PR tối thiểu 4 mục:

```markdown
## Đã làm
- VPS Ubuntu 24.04, user deploy, SSH key-only, ufw 22/80/443, fail2ban
- DNS A record, Nginx reverse proxy /health, HTTP→HTTPS 301
- Certbot TLS, HSTS + security headers, SSL Labs A
- UptimeRobot keyword monitor + Discord alert (đã test thật)

## Đã test (bằng chứng)
- `curl -I http://...` → 301 ; `curl -sS https://.../health` → 200
- SSL Labs A (ảnh docs/evidence/20-ssllabs.png)
- alert trễ 4 phút (ảnh 21-alert.png)

## Rollback
- Nginx: `sudo cp /etc/nginx/sites-available/internship-tracker.bak ...` → `nginx -t` → reload
- Hỏng cả VPS: snapshot + runbook mục 11

## Rủi ro / việc tiếp
- Chưa có rate limit, fail2ban Nginx jail, TLS expiry alert (tuần 2)
```

### 22.4. Báo cáo tuần (10 dòng)

```text
Tuần: Trial W1 (16–22/11)
Đã xong: VPS hardened, DNS, Nginx /health, TLS A, alert thật
PR: #<số>
Đang làm: rate limit + fail2ban Nginx + backup config
Block: (không có / mô tả + đã báo ngày nào)
Rủi ro: chưa có TLS expiry alert
Cần bạn hỗ trợ: Express skeleton + /health thật để chuyển pha 2 (23/11)
Giờ đã dùng: __/10h
Tuần sau dự kiến: API thật sau Nginx, backup/restore, runbook, rebuild drill
```

---

## Cheat sheet: chứng minh từng acceptance bằng 1 lệnh

| Acceptance | Lệnh | Kỳ vọng |
|---|---|---|
| HTTPS /health 200 | `curl.exe -sS https://<host>/health` | JSON `"status":"ok"` |
| HTTP → HTTPS | `curl.exe -I http://<host>/health` | `301`, `Location: https://` |
| TLS hợp lệ | `curl.exe -vI https://<host> 2>&1 \| Select-String "SSL"` | `SSL certificate verify ok` |
| ufw 3 port | `sudo ufw status verbose` | 22/80/443, default deny |
| SSH hardening | `sudo sshd -T \| Select-String "passwordauthentication"` | `no` |
| Root bị chặn | `ssh root@<host>` | `Permission denied` |
| Cert còn hạn | `sudo certbot certificates` | > 60 ngày |
| Renew chạy được | `sudo certbot renew --dry-run` | `Congratulations` / `simulating` |
| Alert hoạt động | stop service, chờ 6' | có tin Discord |
| DNS đúng | `Resolve-DnsName <host> -Type A` | đúng IP |
| App chỉ nghe localhost | `ss -ltnp \| grep 3000` | `127.0.0.1:3000` |
| 404 vẫn có header | `curl.exe -I https://<host>/` | 404 + 4 header |

---

## 8. Nếu tuần này trễ tiến độ — cắt theo thứ tự này

1. Rate limit (`limit_req`) — tuần 2.
2. fail2ban jail cho Nginx — tuần 2.
3. Log rotation — tuần 2.
4. Monitor thứ 2 (redirect) — bỏ được.
5. **Không bao giờ cắt:** TLS + redirect, firewall, SSH hardening, alert thật, runbook, PR.

Lý do: 3 thứ đầu là "làm chắc"; 3 thứ cuối là "chứng minh năng lực" — rubric go/no-go chấm ở đó.

---

## 9. Tự kiểm tra hiểu bài (trả lời được mới tính là xong)

1. Vì sao phải `ufw allow 22` **trước** `ufw enable`?
2. Vì sao app bind `127.0.0.1` mà browser vẫn vào được?
3. Khác nhau giữa `A record` và `server_name` của Nginx?
4. 502 khác 504 ở đâu, mỗi cái chỉ về lớp nào?
5. Vì sao `add_header` trong `location` làm mất header của `server`?
6. Cert hết hạn thì người dùng thấy gì, và monitor nào bắt được?
7. Vì sao `certbot certonly` thay vì `certbot --nginx` khi config nằm trong repo?
8. Nếu VPS chết lúc 2h sáng, ai biết, biết bằng gì, trong bao lâu?