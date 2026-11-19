# Làm network 16 → 22/11 — hướng dẫn từng bước

> Đích của tuần: `https://<host>/health` trả `200` JSON, HTTP trả `301`, SSL Labs ≥ A,
> alert thật đã nhận, `infra/` nằm trong PR.
> Người đọc: người **trực tiếp** gõ lệnh. Không cần biết trước Nginx/systemd.

---

## 0. Bức tranh tổng thể — request đi qua đâu

```text
Trình duyệt
  │ ① DNS: internship-tracker.duckdns.org → IP   (A record DuckDNS)
  ▼
  │ ② TCP :80 (18–19/11) / :443 (từ 20/11)      (NSG + ufw allow)
  ▼
Nginx
  │ ③ đọc 4 file tĩnh trong /var/www/internship-tracker
  ▼
200 HTML  (và 200 JSON ở /health)
```

> Trial chạy **site tĩnh** — không Node, không systemd unit (quyết định #7).

| Lớp | Khái niệm | Kiểm tra bằng | Hỏng thì thấy gì |
|---|---|---|---|
| DNS | A record trỏ IP, TTL | `Resolve-DnsName`, dnschecker.org | `ERR_NAME_NOT_RESOLVED`, `curl: (6)` |
| Firewall/cloud | port 22/80/443 được mở 2 lớp: cloud + ufw | `Test-NetConnection -Port 80` | timeout (không phải "refused") |
| TCP | có process listen không | `ss -ltnp` | `Connection refused` |
| TLS | cert đúng host, còn hạn | `curl -v`, SSL Labs | `certificate verify failed` |
| HTTP | status code, header | `curl -I` | 301/404/403 |
| Nginx config | `root` + `try_files` đúng | `nginx -t`, `nginx -T \| grep root` | 404 dù file có thật |
| File tĩnh | 4 file đọc được bởi `www-data` | `ls -l /var/www/internship-tracker` | 403 Forbidden |

**Quy tắc vàng của tuần này:** mỗi ngày chỉ thêm **một lớp**, và lớp mới chỉ được coi là xong khi có **lệnh chứng minh**. Đừng làm DNS + Nginx + file tĩnh + TLS trong một buổi.

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

Máy chỉ có 1 GiB RAM — swap để `apt`/`certbot` không bị **OOM-kill** đúng lúc demo:

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

## Ngày 18/11 (T4) — Nginx phục vụ site tĩnh, `http://<host>` trả 200

> ✅ **Đã làm 18/11** — Nginx 1.24, site tĩnh trong `/var/www/internship-tracker`: `/` → 200 HTML, `/health` → 200 JSON, `/khong-co` → 404. Bằng chứng: `docs/evidence/18-curl-http.txt`.

**Thời lượng:** 2h. **Deliverable:** `http://internship-tracker.duckdns.org/` trả **200** (`index.html`), `/health` trả JSON tĩnh.

### 18.1. Trỏ hostname về IP (DuckDNS)

> ✅ **Đã làm 16/11**: `internship-tracker.duckdns.org` → `40.83.74.1`, kiểm chứng ở `docs/evidence/16-dns.png`. Giữ phần dưới để dựng lại khi rebuild.

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

### 18.3. Đưa site tĩnh + site config vào

Site chỉ có 4 file ở gốc repo: `index.html`, `styles.css`, `app.js`, `favicon.svg`.
Không clone repo lên VPS, không cần Node: deploy bằng `scp` từ máy dev.

**a) Tạo web root và copy file:**

```bash
ssh staging "sudo mkdir -p /var/www/internship-tracker && sudo chown -R deploy:deploy /var/www/internship-tracker"
```

```powershell
# trên Windows, tại C:\dev\internship_tracker
scp index.html styles.css app.js favicon.svg staging:/var/www/internship-tracker/
```

Kiểm tra quyền — Nginx chạy bằng `www-data` phải đọc được:

```bash
namei -l /var/www/internship-tracker/index.html
```

**b) Site config pha 1 (HTTP only, chưa cần cert):**

```powershell
scp infra\nginx\internship-tracker.http.conf staging:/tmp/internship-tracker.http.conf
```

```bash
sudo cp /tmp/internship-tracker.http.conf /etc/nginx/sites-available/internship-tracker
sudo ln -sf /etc/nginx/sites-available/internship-tracker /etc/nginx/sites-enabled/internship-tracker
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                 # phải: syntax is ok / test is successful
sudo systemctl reload nginx
```

File pha 2 (HTTPS) `internship-tracker.conf` — **hôm nay chưa dùng** (block 443 không nạp được khi chưa có cert).

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
H='Host: internship-tracker.duckdns.org'
curl -sS -H "$H" -o /dev/null -w '/health  -> %{http_code} %{content_type}\n' http://127.0.0.1/health
curl -sS -H "$H" http://127.0.0.1/health; echo
curl -sS -H "$H" -o /dev/null -w '/        -> %{http_code} %{content_type}\n' http://127.0.0.1/
curl -sS -H "$H" -o /dev/null -w '/khong-co-> %{http_code}\n' http://127.0.0.1/khong-co
```

Kỳ vọng:

```text
/health  -> 200 application/json
{"status":"ok","service":"internship-tracker","phase":"static-http"}
/        -> 200 text/html
/khong-co-> 404
```

```powershell
# trên Windows — phải chạy được bằng cả IP và tên miền
curl.exe -sS -o NUL -w "IP  / -> %{http_code}\n"        http://40.83.74.1/
curl.exe -sS -o NUL -w "DNS / -> %{http_code}\n"        http://internship-tracker.duckdns.org/
curl.exe -sS http://internship-tracker.duckdns.org/health
```

`-H 'Host: ...'` là cách test Nginx khi DNS chưa lan — hiểu đúng bản chất: `server_name` so khớp **header Host**, không phải "tên miền trong DNS".

### 18.6. Lỗi hay gặp ngày 18

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Vẫn thấy "Welcome to nginx" | còn `sites-enabled/default` | `sudo rm -f /etc/nginx/sites-enabled/default` rồi reload |
| `403 Forbidden` | `root` trỏ thư mục không đọc được | `namei -l <path>`, sửa `chmod`/`chown` |
| 404 mọi đường | sai `server_name` / request vào site khác | `sudo nginx -T \| grep -n server_name` |
| `/` 404 nhưng `/health` 200 | thiếu file trong `/var/www/internship-tracker` hoặc sai `root` | `ls -l /var/www/internship-tracker`; `sudo nginx -T \| grep -n 'root '` |
| DNS ra IP lạ | Cloudflare proxy đang bật (cam) | đổi sang **DNS only** |
| `curl: (6) Could not resolve` | record chưa lan / sai tên | `Resolve-DnsName`, dnschecker |
| Timeout | cloud firewall / Oracle iptables | mục 18.4 |

Bằng chứng: `docs/evidence/18-curl-http.txt` (curl từ VPS + Windows, `nginx -t`, `nginx -T`), ảnh tuỳ chọn `18-curl-http.png`.

---

## Ngày 19/11 (T5) — Deploy site tĩnh + kiểm tra sống sót sau reboot

**Thời lượng:** 1–2h. **Deliverable:** deploy lại được bằng 1 lệnh, site + `/health` trả 200 sau khi reboot VPS.

> Quyết định #7: trial chạy **site tĩnh** — không cài Node, không systemd unit.
> `infra/systemd/internship-tracker-api.service` để nguyên trong repo cho giai đoạn sau, **không dùng trong 16–29/11**.

### 19.1. Deploy lại (quy trình chuẩn)

Từ Windows, tại `C:\dev\internship_tracker`:

```powershell
scp index.html styles.css app.js favicon.svg staging:/var/www/internship-tracker/
```

- Repo **Private** không ảnh hưởng cách này: máy dev đã có code, VPS không cần token GitHub.
- Không sửa file trực tiếp trên VPS rồi quên copy về repo.

Kiểm tra nhanh:

```powershell
curl.exe -sS -o NUL -w "%{http_code}\n" http://internship-tracker.duckdns.org/
curl.exe -sS http://internship-tracker.duckdns.org/health
```

### 19.2. Reboot test (quan trọng)

Mục đích: chứng minh Nginx, ufw, fail2ban tự bật lại — không cần ai đăng nhập.

```bash
sudo reboot
```

Chờ ~60–90 giây, SSH lại:

```powershell
ssh staging "systemctl is-active nginx; sudo ufw status | head -1; sudo fail2ban-client status sshd | head -2; uptime -p"
```

Kỳ vọng: `active` / `Status: active` / jail `sshd` / uptime vài phút.

Rồi test từ ngoài:

```powershell
curl.exe -sS -o NUL -w "/ -> %{http_code}\n" http://internship-tracker.duckdns.org/
curl.exe -sS http://internship-tracker.duckdns.org/health
```

### 19.3. Lỗi hay gặp

| Mã | Nghĩa | Xem ngay |
|---|---|---|
| 403 | `www-data` không đọc được file | `namei -l /var/www/internship-tracker/index.html`, `chmod 644`, `chown deploy:deploy` |
| 404 ở `/` | thiếu `index.html` hoặc sai `root` | `ls -l /var/www/internship-tracker`; `sudo nginx -T \| grep -n 'root '` |
| Site cũ vẫn hiện | trình duyệt cache | Ctrl+F5 / `curl -H 'Cache-Control: no-cache'` |
| Sau reboot mất site | nginx không `enabled` | `systemctl is-enabled nginx` → `sudo systemctl enable nginx` |
| 502/504 | không còn dùng trong trial (site tĩnh) | nếu thấy: đang nạp nhầm config phase 2/Node |

Bằng chứng: `docs/evidence/19-reboot-test.txt` (log `systemctl is-active` + curl trước/sau reboot).

---

## Ngày 20/11 (T6) — Certbot, HTTPS, headers, SSL Labs

> ✅ **Đã làm 19/11 (sớm 1 ngày)** — Let's Encrypt cert còn 89 ngày, HTTP → 301, HTTPS → 200 JSON, HSTS + 3 security headers, **SSL Labs A+** (TLS 1.2 + 1.3). Bằng chứng: `docs/evidence/20-curl-https.txt`, `20-ssllabs.png`.

**Thời lượng:** 2h. **Deliverable:** `https://<host>/health` 200, HTTP 301, SSL Labs ≥ A.

### 20.1. Lấy cert (test trước, thật sau)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d internship-tracker.duckdns.org --dry-run   # KHÔNG tốn quota
sudo certbot certonly --nginx -d internship-tracker.duckdns.org             # cấp thật
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

```powershell
# trên Windows, tại C:\dev\internship_tracker
scp infra\nginx\snippets\tls.conf infra\nginx\snippets\security.conf staging:/tmp/
scp infra\nginx\internship-tracker.conf staging:/tmp/internship-tracker.https.conf
```

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp /tmp/tls.conf /tmp/security.conf /etc/nginx/snippets/
sudo cp /tmp/internship-tracker.https.conf /etc/nginx/sites-available/internship-tracker
sudo nginx -t && sudo systemctl reload nginx
```

File `.conf` này đã: redirect 80→301, `TLSv1.2 TLSv1.3`, HSTS, security headers qua snippet, `/` phục vụ site tĩnh, `/health` JSON tĩnh.

> Cùng một `root /var/www/internship-tracker` cho cả HTTP và HTTPS — đổi phase không phải copy lại file.

### 20.3. Chứng minh từ Windows

```powershell
curl.exe -I http://internship-tracker.duckdns.org/health     # 301 + Location: https://...
curl.exe -sS https://internship-tracker.duckdns.org/health   # 200 + JSON
curl.exe -I https://internship-tracker.duckdns.org/          # 200 + 4 header
curl.exe -I https://internship-tracker.duckdns.org/health | Select-String -Pattern "strict-transport|x-content-type|x-frame|referrer"
```

Hoặc chạy script có sẵn (kiểm tra 1 lượt DNS/TLS/redirect/headers/404):

```powershell
powershell -File "infra\scripts\verify.ps1" -TargetHost internship-tracker.duckdns.org
```

### 20.4. SSL Labs

Mở `https://www.ssllabs.com/ssltest/analyze.html?d=internship-tracker.duckdns.org&hideResults=on`, chờ 1–3 phút. Lưu ảnh **có ngày** vào `docs/evidence/20-ssllabs.png`.

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

> ✅ **Đã làm 19/11 (sớm 2 ngày)** — UptimeRobot monitor Keyword trên `/health` (5'), integration Discord #alert, test alert thật: stop nginx → nhận alert sau **6 phút** → start lại; cert expiry cũng được bật. Bằng chứng: `docs/evidence/21-alert.png`, chi tiết trong `docs/infra.md` mục 12.

**Thời lượng:** 1h. **Deliverable:** alert tới kênh **chung**, có đo độ trễ.

### 21.1. Tạo monitor

UptimeRobot → Add New Monitor:

| Trường | Giá trị |
|---|---|
| Type | **Keyword** (tốt hơn HTTP: bắt cả trường hợp 200 nhưng body sai) |
| URL | `https://internship-tracker.duckdns.org/health` |
| Keyword | `"status":"ok"` |
| Interval | 5 phút (free) |
| Alert contacts | email chung + **Webhook → Discord URL** |

Thêm monitor thứ 2 (tùy chọn, rất đáng): `http://internship-tracker.duckdns.org/health`, kỳ vọng **301** — bắt được lỗi ai đó tắt redirect.

> Đừng tự host Uptime Kuma trên **cùng** VPS: VPS chết thì monitor chết theo, không ai báo. Uptime Kuma chỉ hợp khi đặt ở máy/host khác (MVP sau).

### 21.2. Test alert thật (đây là bằng chứng, không phải "chắc là chạy")

```bash
# trên VPS, ghi lại giờ
date -u +%FT%TZ
sudo systemctl stop nginx
```

Chờ ≥ 6 phút (interval 5' + 1' trễ), xác nhận Discord/email có alert, ghi giờ nhận. Rồi:

```bash
sudo systemctl start nginx
curl -sS https://internship-tracker.duckdns.org/health
```

Ghi vào `docs/infra.md` mục 12: **stop lúc ___, nhận alert lúc ___, độ trễ ___ phút**, ảnh `21-alert.png`.

Nếu không thấy alert: kiểm tra monitor đang "Up" giả (do cache), webhook URL sai, hoặc alert contact chưa tick vào monitor.

### 21.3. Ghi chú phạm vi

TLS expiry alert và "deep health" (kiểm tra cả DB) là việc của MVP tuần 1–2, **không** nhét vào tuần này. Nhưng ghi vào `docs/infra.md` mục 14 "việc còn nợ" để không quên.

---

## Ngày 22/11 (CN) — Commit `infra/`, PR, báo cáo

> ✅ **Đã làm 19/11 (sớm 3 ngày)** — mọi file `infra/` + docs + evidence đã nằm trong **PR #4** (không tạo PR mới). Config server ↔ repo đối chiếu giống hệt; đã kiểm tra không có secret trong repo. Báo cáo tuần ở cuối mục này.

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
- DNS A record, Nginx phục vụ site tĩnh + `/health` JSON, HTTP→HTTPS 301
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
Cần bạn hỗ trợ: nội dung/trang cho site tĩnh (không cần API trong trial)
Giờ đã dùng: __/10h
Tuần sau dự kiến: API thật sau Nginx, backup/restore, runbook, rebuild drill
```

### 22.5. Báo cáo tuần đã nộp (19/11/2026)

```text
Tuần: Trial W1 (16–22/11) — hoàn thành sớm 19/11
Đã xong: VPS hardened, DNS A record, Nginx tĩnh /health, TLS A+ (SSL Labs),
         HTTP→HTTPS 301, UptimeRobot + Discord alert (test trễ 6'), reboot test PASS
PR: #4 (open, head b685e8f, 28 file) — Closes #1
Đang làm: chờ partner review/merge; đổi repo Private; bật branch protection
Block: PR chưa được approve (đã nhắc Anh Mỹ các ngày 17–19/11)
Rủi ro: Discord webhook đã lộ trong lúc cấu hình → cần rotate trước bàn giao;
        chưa tách TLS-expiry alert riêng (đã bật qua Discord integration)
Cần bạn hỗ trợ: review + merge PR #4, đổi Private, bật branch protection (1 approval)
Giờ đã dùng: ~6/10h (xong sớm 2 ngày so với kế hoạch)
Tuần sau dự kiến: tuần 2 Network — rate limit Nginx, fail2ban Nginx jail,
        backup/restore config, TLS expiry alert, rebuild drill 25–26/11
```

### 22.6. Lưu ý về PR #4

- Không tạo PR mới (`infra/week1-edge`) — toàn bộ Week 1 đã gom trong **PR #4** (branch `infra/setup`) để tránh xung đột `docs/infra.md`.
- PR có **~2316 dòng thay đổi / 28 file**, phần lớn là ảnh evidence (`docs/evidence/*.png`) — không phải code application.
- **Không xoá branch `infra/setup`** sau merge (giữ đến hết trial).

---

## Ngày 23/11 (T2 tuần 2) — Rate limit Nginx

> ✅ **Đã làm 23/11** — `limit_req` 2r/s, burst 5, trả 503; `/health` nằm location riêng nên monitor không bị ảnh hưởng. Bằng chứng `docs/evidence/23-rate-limit.txt`.

### 23.1. Ý nghĩa

Chống spam / brute force / bot gọi liên tục làm nghẽn máy 1 GiB RAM. Khác với ufw (chặn port), rate limit **chặn tần suất request**.

### 23.2. Cấu hình

- Zone (http context): `infra/nginx/snippets/rate-limit.conf` → copy vào `/etc/nginx/conf.d/rate-limit.conf`
  (Ubuntu `nginx.conf` đã `include /etc/nginx/conf.d/*.conf` trong block `http`).
- Trong `location /` của cả 2 site config:
  ```nginx
  limit_req zone=it_limit burst=5 nodelay;
  limit_req_status 503;
  ```

> ⚠️ Copy zone file **trước** site config, nếu không `nginx -t` sẽ fail (chưa có zone).

### 23.3. Test (bằng chứng)

```bash
# qua HTTPS vì HTTP đã redirect 301
for i in {1..15}; do curl -k -s -H 'Host: internship-tracker.duckdns.org' -o /dev/null -w '%{http_code} ' https://127.0.0.1/; done
```

Kỳ vọng: `200 200 200 200 200 200 503 503 ...` (burst 5 + 2r/s).

`/health` vẫn `200` mọi lần → UptimeRobot không bị ảnh hưởng.

### 23.4. Rollback

```bash
sudo rm /etc/nginx/conf.d/rate-limit.conf   # nhưng phải bỏ 2 dòng limit_req trong site config trước
sudo nginx -t && sudo systemctl reload nginx
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
| Site tĩnh đủ file | `ls -l /var/www/internship-tracker` | 4 file, `www-data` đọc được |
| 404 vẫn có header | `curl.exe -I https://<host>/khong-co` | 404 + 4 header |

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