# Runbook — Hạ tầng Internship Tracker (staging)

> Người đọc giả định: **không biết gì về VPS này**, chỉ có file này + quyền vào repo.
> Mục tiêu: dựng lại từ VPS trắng trong **≤ 30 phút**.
> Điền hết `[TODO]` trước 28/11.

**Cập nhật lần cuối:** 18/11/2026 — người cập nhật: bạn (infra)

---

## 1. Thông tin hạ tầng

| Mục | Giá trị |
|---|---|
| Provider / region | **Azure for Students** — region **East Asia (Hong Kong)** |
| Gói / spec | `Standard_B2ats_v2` — **1 vCPU (constrained) / 1 GiB RAM**, OS disk 30 GiB Standard SSD |
| IP công khai | **40.83.74.1** (Static, gắn NIC `vm-it-staging130`) |
| IP private | 172.16.0.4 (`vnet-eastasia-1/snet-eastasia-1`) |
| OS | Ubuntu **24.04.5** LTS, x64 Gen2, kernel 7.0.0-1017-azure |
| Hostname phục vụ | `internship-tracker.duckdns.org` (DuckDNS, A record) |
| Resource group / VM | `rg-internship-tracker` / `vm-it-staging` |
| Subscription ID | xem Portal → **Subscriptions** (không ghi vào repo public) |
| Provider console URL | https://portal.azure.com → `rg-internship-tracker` → `vm-it-staging` — **đường recovery khi mất SSH** (dùng **Reset password → SSH public key** hoặc **Serial console**) |
| Ngân sách / ai trả | Credit **$100 Azure for Students** (hết hạn 14/11/2027, **không thẻ** → không thể phát sinh phí). ~$10.8/tháng khi chạy 24/7 |
| Người liên hệ | Trương Hoài Nam (infra) — Discord server **Trial A**, channel `#chung` / `#alert` |

**Tài khoản đăng nhập:** user `deploy` (có `sudo`), **không dùng `root`**, không bật password auth.
**SSH key (mỗi người 1 key riêng, cả 2 nằm trong `/home/deploy/.ssh/authorized_keys`):**

| Ai | Comment | Fingerprint | Private key ở đâu |
|---|---|---|---|
| Bạn (infra) | `it-staging` | `SHA256:e0tJwyu3C0Ph8gL7OWyZunje3X141jCPqY0lTATJ61k` | `C:\Users\PC\.ssh\id_ed25519_it` |
| Partner | `admin@Admin-PC` | `SHA256:MHV8W6eJwCKWz1HTeNgC+nvScbgykLhQCV1VBLXApTM` | máy partner — **không** ai khác giữ |

Kiểm tra lại bất cứ lúc nào: `ssh-keygen -lf /home/deploy/.ssh/authorized_keys` (phải ra **đúng 2 dòng**).

**Hardening đã áp dụng 16/11/2026** — file `/etc/ssh/sshd_config.d/00-hardening.conf`:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

> ⚠️ Tên file phải là **`00-hardening.conf`**, không phải `99-`: sshd đọc `sshd_config.d/*` theo thứ tự chữ cái và lấy **giá trị đầu tiên**. Cloud image đã có `50-cloud-init.conf` (set `PasswordAuthentication no`) → đặt `00-` để file của mình luôn thắng.

Kiểm **giá trị hiệu lực**, không kiểm nội dung file:

```bash
sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|kbdinteractive'
# permitrootlogin no
# passwordauthentication no
# kbdinteractiveauthentication no
```

Đã verify 16/11: `ssh root@40.83.74.1` → `Permission denied (publickey)`; `ssh staging` (deploy, key) → OK.

**ufw:** `deny incoming`, `allow outgoing`, chỉ mở `22/80/443/tcp` (cả IPv6), bật cùng boot:

```bash
sudo ufw status verbose     # Status: active + đúng 6 dòng rule (3 v4 + 3 v6)
systemctl is-enabled ufw    # enabled
```

**Host key của server — KHÁC 2 key trên** (đây mới là cái hiện ra ở prompt `The authenticity of host '40.83.74.1'` lần SSH đầu):

| Loại | Fingerprint | Lấy bằng lệnh |
|---|---|---|
| ED25519 host key | `SHA256:JoDCMLRp+BPRUnLYhPhnu7YnNgLAfr19dh5aoJdSURM8` | `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` |

> Ranh giới cần nhớ: **key user** (bảng trên) = ai được đăng nhập; **host key** = có đúng là máy chủ không (chống MITM). Prompt "authenticity of host" hiện **host key**, không phải key user.
> ⚠️ Rebuild drill (25–26/11) tạo máy mới → **host key đổi** → máy nào từng SSH sẽ báo `REMOTE HOST IDENTIFICATION HAS CHANGED`. Xoá dòng cũ: `ssh-keygen -R 40.83.74.1` rồi vào lại, so fingerprint mới (SSH sẽ tự ghi vào `known_hosts`).
**Lệnh SSH:** `ssh staging` (alias trong `C:\Users\PC\.ssh\config`), hoặc đầy đủ `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_it" deploy@40.83.74.1`.

**Nơi giữ bí mật (không nằm trong repo):**

| Secret | Nơi lưu (Bitwarden) |
|---|---|
| Private key SSH (`id_ed25519_it`) | item `Trial A — SSH key` |
| Token DuckDNS | item `Trial A — DuckDNS` |
| Discord webhook (UptimeRobot) | item `Trial A — UptimeRobot webhook` |

> ⚠️ Discord webhook đã từng xuất hiện trong ảnh chụp lúc cấu hình — nên **rotate** (xoá webhook cũ, tạo mới, cập nhật Bitwarden + UptimeRobot) trước khi bàn giao.

> **Giữ credit:** khi không làm việc → Portal → VM → **Stop** → chọn **Deallocate** (Stop thường vẫn tính tiền CPU/RAM). IP tĩnh + disk vẫn giữ (~$6/tháng).

---

## 2. Đường đi của một request

```text
browser
  → DNS (A record → IP)
  → TCP 80/443 (ufw allow, NSG allow)
  → Nginx (TLS, HSTS, security headers)
  → đọc file trong /var/www/internship-tracker
  → response
```

- **18–19/11:** chỉ HTTP :80, phục vụ site tĩnh (`/` → `index.html`).
- **Từ 20/11:** HTTP :80 chỉ còn để trả `301` sang HTTPS; nội dung vẫn là 4 file tĩnh.
- **Không có Node/systemd trong trial** — quyết định #7 (site tĩnh).

---

## 3. Port đang mở

| Port | Dịch vụ | Ai cần |
|---|---|---|
| 22 | sshd | deploy |
| 80 | Nginx | 18–19/11: phục vụ site tĩnh; từ 20/11: redirect → 443 |
| 443 | Nginx | public |

Kiểm tra: `sudo ufw status verbose` — **chỉ được thấy 3 port này**.

**Azure có 2 lớp firewall — phải mở ở cả hai:**

| Lớp | Ở đâu | Kiểm tra |
|---|---|---|
| Ngoài (NSG) | Portal → VM → **Networking** → Inbound port rules | phải có 3 rule Allow: 22, 80, 443 |
| Trong (ufw) | trên máy | `sudo ufw status verbose` |

Thiếu rule ở NSG thì `curl` từ ngoài sẽ **timeout** dù `ufw` đã mở — đây là bẫy hay gặp nhất khi lên Azure.

---

## 4. DNS

| Type | Name | Value | TTL |
|---|---|---|---|
| A (DuckDNS) | `internship-tracker.duckdns.org` | **40.83.74.1** (Static — không đổi khi reboot) | 60 (DuckDNS cố định) |

- Cập nhật IP khi rebuild: Portal → VM → Public IP → copy → dán vào DuckDNS:
  `curl "https://www.duckdns.org/update?domains=internship-tracker&token=<token>&ip=<IP>"`.
- Kiểm tra: `nslookup internship-tracker.duckdns.org` (Windows) hoặc `dig +short internship-tracker.duckdns.org`.
- Lý do dùng `*.duckdns.org` thay vì `sslip.io`: `duckdns.org` nằm trong **Public Suffix List** → rate limit Let's Encrypt tính riêng cho tên của bạn; `sslip.io`/`nip.io` thì dùng chung rate limit với cả thế giới.

---

## 5. Deploy / cập nhật code

Site tĩnh — **không build, không restart service**. Chạy trên máy dev (Windows), tại `C:\dev\internship_tracker`:

```powershell
scp index.html styles.css app.js favicon.svg staging:/var/www/internship-tracker/
```

- Tạo web root lần đầu: `ssh staging "sudo mkdir -p /var/www/internship-tracker && sudo chown -R deploy:deploy /var/www/internship-tracker"`.
- Repo Private **không ảnh hưởng**: file đi từ máy dev, VPS không cần token GitHub.
- Kiểm tra: `curl.exe -sS http://internship-tracker.duckdns.org/health` và `curl.exe -sS -o NUL -w "%{http_code}\n" http://internship-tracker.duckdns.org/`.

---

## 6. Restart / stop service

```bash
sudo systemctl status nginx
sudo systemctl reload nginx      # sau mỗi lần sửa config, sau khi nginx -t OK
sudo systemctl stop nginx        # dùng để test alert (site chết)
sudo systemctl start nginx
```

> **VM đang Stopped/Deallocated (Azure):** Portal (tài khoản Azure của **Nam**) → `vm-it-staging` → **Start**, chờ 1–2 phút rồi mới `ssh`/`curl`. IP tĩnh `40.83.74.1` giữ nguyên; nếu IP đổi thì cập nhật DuckDNS **trước khi** test monitor.

`nginx -t` **trước** mọi `reload`. Không có service app nào khác trong trial.

---

## 7. Xem log

```bash
sudo tail -n 100 /var/log/nginx/internship-tracker.error.log    # site
sudo tail -n 100 /var/log/nginx/internship-tracker.access.log   # ai gọi gì
sudo tail -n 100 /var/log/nginx/error.log                       # nginx chung
sudo fail2ban-client status sshd                                # ssh
sudo fail2ban-client status nginx-limit-req                     # 429 → ban
sudo fail2ban-client status nginx-botsearch                     # 404 bot → ban
```

Bị ban oan: `sudo fail2ban-client set <jail> unbanip <IP>` (xem IP ở dòng `Banned IP list`).

| Triệu chứng | Xem gì trước |
|---|---|
| 403 Forbidden | `namei -l /var/www/internship-tracker/index.html` → `chown deploy:deploy`, `chmod 644` |
| 404 toàn bộ | `nginx -T \| grep server_name`, đúng site chưa; `ls /var/www/internship-tracker` |
| Trang mặc định Nginx | còn `sites-enabled/default` |
| Cert hết hạn | `sudo certbot certificates` |

---

## 8. TLS

```bash
sudo certbot certificates          # ngày hết hạn
sudo certbot renew --dry-run       # test renew
sudo certbot renew                 # gia hạn thật (thường timer tự làm)
```

- Cert ở `/etc/letsencrypt/live/<host>/`.
- Timer: `systemctl list-timers | grep certbot`.
- Cảnh báo: nếu `certbot renew` fail quá 30 ngày, site sẽ mất HTTPS.
- Config TLS: `infra/nginx/snippets/tls.conf` + `infra/nginx/internship-tracker.conf` — chỉ `TLSv1.2 TLSv1.3`, HSTS `max-age=31536000`.

---

## 9. Rollback

| Tình huống | Cách làm |
|---|---|
| Deploy làm hỏng site | Trong repo: `git checkout <commit-tốt>` → `scp` lại 4 file → Ctrl+F5 |
| Nginx config hỏng | `sudo cp /etc/nginx/sites-available/<site>.bak /etc/nginx/sites-available/<site>` → `nginx -t` → reload |
| Hỏng cả VPS | Snapshot provider [TODO: tên snapshot] hoặc làm mục 11 (rebuild) |
| Mất SSH | Vào console provider → [TODO: cách] |

**Nguyên tắc:** `nginx -t` trước mọi `reload`. Không sửa trực tiếp trên server rồi quên commit vào `infra/`.

---

## 10. Backup / restore

| Thứ | Ở đâu | Tần suất |
|---|---|---|
| Config (`infra/`) | git repo | mỗi thay đổi (PR) |
| Config đang chạy | `/opt/backup/etc-<ngày>.tar.gz` | [TODO] |
| Snapshot VPS | provider | [TODO] |

```bash
# backup
sudo tar czf /opt/backup/etc-$(date +%F).tar.gz \
  /etc/nginx /etc/ssh/sshd_config.d /etc/fail2ban/jail.d
sudo tar czf /opt/backup/www-$(date +%F).tar.gz /var/www/internship-tracker

# restore
sudo tar xzf /opt/backup/etc-<ngày>.tar.gz -C /
sudo tar xzf /opt/backup/www-<ngày>.tar.gz -C /
sudo nginx -t && sudo systemctl reload nginx
```

DB Postgres: chưa có trong trial. Giai đoạn sau: `pg_dump` hàng ngày + đã thử restore (ghi vào đây khi làm).

---

## 11. Rebuild từ VPS trắng — bấm giờ

> Đây là bài kiểm tra chính của trial. Ghi giờ thật vào cột cuối.

| # | Bước | Lệnh / việc | Phút | Giờ thật |
|---|---|---|---|---|
| 1 | Hạ TTL DNS (làm trước ≥ 24h) | — | 0 | ☐ |
| 2 | Tạo VPS Ubuntu 24.04 | Portal → VM → image Ubuntu 24.04, size `B2ats_v2`, **NSG mở 22/80/443**, Public IP **Static** | 5 | ☐ |
| 3 | Trỏ DNS về IP mới | DuckDNS update bằng `curl` (mục 4) | 1 | ☐ |
| 4 | Copy + chạy bootstrap | `scp -i <key> infra/bootstrap.sh deploy@IP:/tmp/` → `sudo bash /tmp/bootstrap.sh` | 6 | ☐ |
| 5 | Test key login ở terminal mới | `ssh -i <key> deploy@IP` | 2 | ☐ |
| 6 | Chạy hardening | `sudo bash /tmp/bootstrap.sh --harden` | 1 | ☐ |
| 7 | Tạo web root + deploy 4 file tĩnh | `sudo mkdir -p /var/www/internship-tracker && sudo chown deploy:deploy ...`; `scp index.html styles.css app.js favicon.svg deploy@IP:/var/www/internship-tracker/` | 2 | ☐ |
| 8 | Swap 2 GB (B-series chỉ 1 GiB RAM) | `fallocate -l 2G /swapfile && mkswap && swapon && ghi /etc/fstab` | 1 | ☐ |
| 9 | **Cài Nginx + Certbot** | `sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx` — bootstrap **KHÔNG cài 2 gói này** | 3 | ☐ |
| 10 | **Copy snippets** | `sudo mkdir -p /etc/nginx/snippets`; copy `tls.conf`, `security.conf` → `/etc/nginx/snippets/`; copy `rate-limit.conf` → `/etc/nginx/conf.d/rate-limit.conf` (zone `it_limit` nằm ở `http` context). **Thiếu = `nginx -t` fail** | 1 | ☐ |
| 11 | Site config pha 1 (HTTP) | copy `internship-tracker.http.conf` → `/etc/nginx/sites-available/internship-tracker`; symlink `sites-enabled`; xoá `default`; `nginx -t`, reload | 2 | ☐ |
| 12 | Certbot | `certbot certonly --nginx -d internship-tracker.duckdns.org --dry-run` rồi bỏ `--dry-run`; kiểm tra `certbot certificates` | 3 | ☐ |
| 13 | Đổi sang config pha 2 (HTTPS) | copy `internship-tracker.conf` → `sites-available/internship-tracker`; `nginx -t`, reload | 1 | ☐ |
| 14 | **Fail2ban jail cho Nginx** | Copy `infra/fail2ban/jail.d/internship-tracker.local` → `/etc/fail2ban/jail.d/`; `sudo fail2ban-client -t`; `sudo systemctl restart fail2ban`; `sudo fail2ban-client status` phải thấy `nginx-limit-req` + `nginx-botsearch` (chi tiết §11.1) | 3 | ☐ |
| 15 | **Kiểm tra log rotation** | `sudo logrotate -d /etc/logrotate.d/nginx`; `sudo logrotate -f /etc/logrotate.d/nginx`; `ls -lh /var/log/nginx/internship-tracker.*` thấy `.1`/`.2.gz`; `df -h /` | 1 | ☐ |
| 16 | Verify thật | `curl -sS https://.../health` (đọc **body**, không chỉ `curl -I`); `curl -sS -o /dev/null -w '%{http_code}' https://.../`; HTTP phải 301; test rate limit **15 request liên tục → 6 × 200 rồi 429** (burst 5 + 1 request đầu); SSL Labs | 3 | ☐ |
| | **Tổng** | mục tiêu ≤ 35 (thực tế có thể 35–45 do cert issuance + DuckDNS lan) | **~36** | ☐ |

Nếu vượt 35 phút: ghi rõ bước nào chậm và sửa runbook — **không** sửa bằng cách bỏ bước. Đo **giờ thật**, đừng ước lượng.

> ⚠️ Ba lỗi chỉ lộ khi rebuild từ máy trắng (đã phát hiện trước drill 25–26):
> 1. `bootstrap.sh` **không cài nginx/certbot** → phải có bước 9.
> 2. Thiếu `tls.conf`/`security.conf` → `include` báo file not found; thiếu `rate-limit.conf` → `zone "it_limit" does not exist`.
> 3. Copy zone file **trước** site config, nếu không `nginx -t` fail.

### 11.1. Chi tiết bước 14–15 (fail2ban + logrotate)

`bootstrap.sh` chỉ cấu hình jail `sshd`; VM rebuild **không tự có** jail Nginx. Copy file:

```bash
scp -i <key> infra/fail2ban/jail.d/internship-tracker.local deploy@IP:/tmp/
ssh -i <key> deploy@IP "sudo install -m 644 -o root -g root /tmp/internship-tracker.local /etc/fail2ban/jail.d/ && sudo fail2ban-client -t && sudo systemctl restart fail2ban && sudo fail2ban-client status"
```

Kỳ vọng: `Number of jail: 3` và danh sách có `nginx-botsearch`, `nginx-limit-req`, `sshd`.

Vì sao `backend = polling`: Ubuntu đặt `backend = systemd`; nginx ghi log ra file nên phải đọc file, không đọc journal. `ignoreip` giữ localhost để curl nội bộ không bị ban.

Test thật (làm trên VM, không cần mở firewall thêm):

```bash
# 1) Rate limit: 20 request qua hostname công khai → 200/429 rồi bị ban
for i in {1..20}; do curl -s -o /dev/null -w '%{http_code} ' --max-time 5 \
  https://internship-tracker.duckdns.org/; done; echo
sudo fail2ban-client status nginx-limit-req
sudo fail2ban-client set nginx-limit-req unbanip <IP trong Banned IP list>

# 2) Bot search: 3 request path khai thác → 404 rồi bị ban
for i in 1 2 3; do curl -s -o /dev/null -w '%{http_code}\n' \
  https://internship-tracker.duckdns.org/wp-login.php; done
sudo fail2ban-client status nginx-botsearch
sudo fail2ban-client set nginx-botsearch unbanip <IP>
```

> Test từ VM qua hostname sẽ ban IP công khai của chính VM (`40.83.74.1`), **không ảnh hưởng người dùng thật**; unban ngay. Không test bằng `127.0.0.1` vì nằm trong `ignoreip`.

Log rotation: **không tạo file mới**, dùng `/etc/logrotate.d/nginx` có sẵn (`daily`, `rotate 14`, `compress`, `delaycompress`, `notifempty`, `create 0640 www-data adm`, `postrotate invoke-rc.d nginx rotate`). Nó áp cho `*.log`, gồm cả `internship-tracker.*.log`. Kiểm tra:

```bash
sudo logrotate -d /etc/logrotate.d/nginx     # dry-run: xem log nào sẽ xoay
sudo logrotate -f /etc/logrotate.d/nginx     # xoay thật
ls -lh /var/log/nginx/internship-tracker.*   # phải có .1 và .2.gz
sudo nginx -t && sudo systemctl reload nginx
```

> Không thêm entry logrotate trùng đường dẫn — logrotate báo `duplicate log entry` và bỏ qua.

Bằng chứng: `docs/evidence/24-fail2ban-nginx.txt` (20/11/2026).

### 11.2. Checklist bổ sung cho drill 25–26 (review 20/11)

1. **SSH host key đổi sau rebuild:** `ssh staging` báo `REMOTE HOST IDENTIFICATION HAS CHANGED` → chạy `ssh-keygen -R 40.83.74.1` rồi SSH lại. **Không phải bị tấn công.**
2. **Certbot rate limit:** tối đa 5 cert trùng/tuần. Chỉ chạy lại `certbot certonly` **sau khi** `curl http://<host>/` đã 200 qua DNS mới; không gọi lại liên tục lúc rebuild hỏng.
3. **Thứ tự sau rebuild (IP tĩnh giữ nguyên):**
   `IP tĩnh → DNS DuckDNS → bootstrap.sh → nginx config (snippets) → deploy.sh → TLS/certbot → 3 jail fail2ban → ufw/NSG → verify /health, /, 301 → resume monitor.`
4. **Evidence:** file `docs/evidence/25-26-drill.txt` — khi drill thật **append entry mới**, KHÔNG ghi đè (giữ lại entry dry-run 20/11).
5. **Pause/Resume:** đúng **4 monitor đang có** (Health + Site + Redirect + Pages) — tất cả đều gửi alert Discord; xem §12.
6. **Cửa sổ Pause:** 25/11 **00:00 → 02:00** (2 giờ), rebuild xong resume + verify ngay; không pause 24h.
7. **Negative test Pause — ✅ ĐÃ TEST 20/11:** Pause 4 monitor → `sudo systemctl stop nginx` → chờ 7' → Discord `#alert` **KHÔNG** có tin mới → resume + start nginx. Kết quả PASS, evidence `20-negative-pause.txt`. Nếu có tin → Pause hỏng, drill sẽ bắn alert giả.

### 11.3. Drill 27/11 — đo thời gian phản ứng alert thật

Làm **sau** rebuild 25–26, trước demo 29/11. Mục tiêu: đo SLA phản ứng 15 phút của người trực.

```bash
# T0 — giả lập sự cố
date -u +%FT%TZ
sudo systemctl stop nginx

# Chờ Discord #alert + email tới (không pause monitor). Ghi T1 = thời điểm tin tới.
# Người trực xác nhận trong #alert, ghi T2 = thời điểm xác nhận.

# Khôi phục
sudo systemctl start nginx
curl -sS https://internship-tracker.duckdns.org/health
```

| Chỉ số | Công thức | Mục tiêu |
|---|---|---|
| Độ trễ alert | `T1 - T0` | ≤ 10' (interval 5' + trễ) |
| Thời gian phản ứng | `T2 - T0` | **≤ 15'** |
| Kênh nhận | Discord + email | Cả 2 |

Ghi `T0/T1/T2`, người trực, độ trễ và ảnh chụp `#alert` vào `docs/evidence/27-alert-response.txt`. Nếu `T2-T0 > 15'` → sửa lịch trực/notify trước demo 29/11.

---

## 12. Monitoring

| Monitor | URL | Interval | Kênh alert / trạng thái |
|---|---|---|---|
| Health | `https://internship-tracker.duckdns.org/health` | 5' | Discord #alert — ✅ Up |
| Site | `https://internship-tracker.duckdns.org/` — Keyword `"Internship Tracker"` trong `index.html`; **Start incident when keyword does NOT exist** (keyword mất → DOWN) | 5' | Discord #alert — ✅ Up |
| Redirect | `http://internship-tracker.duckdns.org/health` (kỳ vọng 301) | 5' | Discord #alert — ✅ Up (tạo 20/11) |
| Pages | `https://anhmy1312.github.io/internship_tracker/` — Keyword `Internship Tracker`, **keyword does NOT exist** | 5' | Discord #alert — ✅ Up (tạo 20/11) |

> `/health` giờ là JSON của API (`{"status":"ok","uptime":...,"version":"0.1.0"}`) sau khi deploy 21/11 — 200 không chứng minh site còn file. Monitor **Site** bắt trường hợp mất `index.html`; giữ nguyên monitor Health. *(Trước deploy: JSON tĩnh có `"phase":"static"`.)*

> **Trước khi tạo monitor Site:** VM phải **đang chạy**. Azure Portal (tài khoản Azure của **Nam**) → `vm-it-staging` → **Start**; chờ 1–2 phút; verify `curl https://.../health` = 200 và `curl https://.../` = 200 rồi mới Add monitor. Tạo monitor khi VM tắt → monitor đỏ ngay, alert giả.
>
> **Trạng thái 20/11 00:35 UTC:** 22/80/443 mở, `/` 200, `/health` 200 (kiểm tra cả từ ngoài). Thông tin "site down từ 18:43 19/11" là trạng thái cũ (VM đã được Start lại) — trước khi kết luận, luôn kiểm tra 3 port + HTTPS.
>
> **Drill 25–26/11:** Free plan không có Maintenance Window → **Pause/Resume đúng 4 monitor đang có** (Health + Site + Redirect + Pages). Khung Pause đề xuất: **25/11 00:00 → 02:00** (2 giờ), rebuild xong resume ngay — không pause 24h. Ghi giờ thực tế vào bảng dưới.

| Sự kiện | Thời gian (UTC) | Ghi chú |
|---|---|---|
| Rotate webhook Discord | ✅ 20/11 01:01 UTC | Đã tạo webhook mới, cập nhật UptimeRobot, nhận alert thật trong `#alert`; ✅ đã xoá webhook cũ |
| Monitor Site (Keyword) | ✅ 20/11 ~01:04 UTC | URL `/`, keyword `Internship Tracker`, 5'; điều kiện **keyword does NOT exist**; Discord #alert đã tick + test OK lúc 01:15 UTC |
| Quyết định Private/Public | ✅ 20/11 — **Free** | Chủ repo `Anhmy1312` dùng GitHub **Free** (không Pro/Student Pack) → **giữ Public**, giữ branch protection, **KHÔNG flip Private** |
| Maintenance Window drill | 25/11 **00:00 → 02:00** (UTC+7) | Free plan **không có Maintenance Window** → **Pause/Resume đúng 4 monitor đang có** (Health + Site + Redirect + Pages). **Dry-run 20/11 xong**: Pause 01:50 UTC, Resume 01:57 UTC (ảnh + log). **Negative test Pause ✅ PASS 20/11 08:41→08:48 UTC** (`20-negative-pause.txt`) — nginx tắt 7' mà Discord không có alert giả. Drill thật 25–26: ☐ |

> **20/11 01:04 UTC:** monitor Site (Keyword) tạo xong, trạng thái **Up**; monitor `/health` vẫn **Up**. Test notification lúc 01:15 UTC → Discord `#alert` nhận tin **DOWN giả + UP giả** ("was down for N/A" = dấu hiệu test, không phải sự cố thật).

> **Dry-run Pause/Resume 20/11:** Pause lúc 01:50 UTC (ảnh `25-drill-paused.png`), Resume lúc 01:57 UTC (ảnh `26-drill-resumed.png`), log `25-26-drill.txt`. *(Lúc đó mới chỉ có 2 monitor; hiện đã có 4: Health + Site + Redirect + Pages.)* Drill thật 25–26/11 sẽ **append** entry mới, KHÔNG ghi đè.

> **Pages monitor (liên kết §16):** Pages đang Public và 200 (`https://anhmy1312.github.io/internship_tracker/`). Monitor Pages (keyword `Internship Tracker`, điều kiện **keyword does NOT exist**, 5', Discord) đã tạo lúc 20/11 và **Up** — không còn rủi ro unpublish không biết.

> **Negative test Pause ✅ PASS 20/11:** Pause 4 monitor lúc 08:41:51 UTC → `sudo systemctl stop nginx` → chờ 7' → Discord `#alert` **KHÔNG có tin mới** (tin cuối vẫn là 14:52 local) → start nginx lúc 08:48:53 UTC → Resume 4 monitor. Verify: nginx active, `/health` 200, `/` 200. Evidence: `docs/evidence/20-negative-pause.txt`. Drill 25/11 có thể Pause an toàn.

> **Alert contacts — chốt 20/11:** email của Nam (lưu Bitwarden) (event: Up + Down) **đã verify và nhận test notification thành công**; **Discord integration #1** được tick trên **cả 4 monitor** (đã kiểm tra từng monitor qua UI). Test gửi cả 2 kênh cùng lúc → email + Discord đều nhận. Cấu hình email tổng tại `dashboard.uptimerobot.com/account/notifications`. SMS/Voice không dùng (cần plan trả phí).

### 12.1. Trực #alert 28–29/11 (SLA 15 phút)

| Khung (UTC+7) | Người trực | Trách nhiệm |
|---|---|---|
| 28/11 20:00 → 29/11 08:00 | **Nam** | Theo dõi `#alert`, xác nhận trong vòng **15 phút**, báo Anh Mỹ nếu không tự xử lý được |
| 29/11 08:00 → demo xong | **Anh Mỹ** | Như trên; là đầu mối trong buổi demo |

- Quá **15 phút** không ai xác nhận → **gọi điện** cho người còn lại (Discord có thể bị trễ/điện thoại tắt thông báo).
- **⚠️ Quyền Start VM:** **Nam là owner tài khoản Azure** (`2451052160nam@ou.edu.vn`) → tự Start được VM, không cần Anh Mỹ add role. Anh Mỹ chỉ là owner **repo GitHub** (approve/merge PR). Việc cần chốt trước **23/11**:
  - **Không deallocate VM** từ 23→29/11; nếu bắt buộc tắt → Pause cả 4 monitor trước (negative test đã PASS) (☐).
  - Dùng **budget alert** nếu cần kiểm soát credit, không dùng Stop/Deallocate.
- Discord **mobile push** cho `#alert` phải bật trước 29/11 (xem §13.1). Email là kênh dự phòng đã verify.

**Đã test alert:** 21/11/2026 (làm sớm 19/11) — stop nginx lúc 00:00 UTC, nhận alert lúc 00:06 UTC, độ trễ **6 phút**. Ảnh `docs/evidence/21-alert.png`.

> Webhook URL là secret — lưu trong Bitwarden (item `Trial A — UptimeRobot webhook`), **không** commit vào repo. Nếu lộ: Discord → Edit Channel → Webhooks → Delete → tạo webhook mới → cập nhật Bitwarden + UptimeRobot.

Test lại:

```bash
date -u +%FT%TZ
sudo systemctl stop nginx
# chờ >= 6 phút (interval 5' + 1' trễ), xác nhận có alert trong Discord #alert
sudo systemctl start nginx
curl -sS https://internship-tracker.duckdns.org/health
```

---

## 13. Incident checklist (khi /health đỏ)

- [ ] Xác nhận từ ngoài: `curl -sS -o /dev/null -w '%{http_code}\n' https://<host>/health`
- [ ] Phân biệt: TLS lỗi / 404 / timeout → xem bảng mục 7.
- [ ] `systemctl status nginx`, `nginx -t`
- [ ] `ls -l /var/www/internship-tracker` — còn đủ 4 file không.
- [ ] `sudo ufw status` — port còn mở không.
- [ ] `df -h` — đầy disk cũng gây lỗi ghi log.
- [ ] Khôi phục → xác nhận monitor xanh → ghi lại nguyên nhân + thời gian.

### 13.1. Incident 19–20/11/2026 — VM shutdown 5h05m

**Triệu chứng:** Discord `#alert` báo DOWN lúc **09:46 local**, UP lúc **14:52 local**, duration **5h06m** (cả `/health` lẫn `/`).

**Timeline (VM log + UptimeRobot):**

| Giờ local (UTC+7) | Giờ UTC | Sự kiện |
|---|---|---|
| 09:43 | 02:43:07 | Kernel: `hv_utils: Shutdown request received - graceful shutdown initiated` → **Azure host** gửi lệnh tắt, không phải lệnh từ trong VM (`systemctl poweroff` không xuất hiện) |
| 09:43 | 02:43:09 | `systemd-poweroff` xong, VM tắt |
| 09:46 | 02:46 | UptimeRobot phát hiện DOWN (Connection Timeout) |
| 14:48 | 07:48:52 | VM boot lại (`journalctl --list-boots`, boot `63da14db…`) |
| 14:52 | 07:52 | UptimeRobot báo UP, `down for 5 hours and 6 minutes` |

**Nguyên nhân ĐÃ CHỐT 21/11:** Activity log Azure cho thấy cả 4 lần là **“Deallocate Virtual Machine – Succeeded”**, **Event initiated by = tài khoản Azure của Nam (owner)** — tức **deallocate thủ công** (khả năng cao để tiết kiệm credit), **KHÔNG phải auto-shutdown policy**. VM log (`hv_utils: Shutdown request received`) chỉ là hệ quả của lệnh từ Azure control plane.

**Việc còn phải làm trước 29/11:**

- [x] Activity log đã check: Caller = **Nam (owner Azure)**, 4 lần `Deallocate Virtual Machine` vào 17/11, 18/11, 19/11, 20/11. Không có policy auto-shutdown trong log.
- [x] Auto-shutdown đã verify **Off** lúc 21/11 12:31 (Azure Portal → Operations → Auto-shutdown). Không có lịch tắt tự động.
- [x] Từ giờ đến demo: **không deallocate VM**. Nếu cần tiết kiệm credit → dùng **budget alert**, không tắt VM.
- [x] Discord **mobile push** cho `#alert` đã bật + test notification nhận được.
- [x] Nguyên tắc: **không Deallocate VM khi monitor đang bật**; nếu bắt buộc tắt → Pause cả 4 monitor trước (negative test Pause đã PASS, §12).

---

## 14. Việc còn nợ (ghi rõ để người sau biết)

- [x] Rate limit Nginx `limit_req` — **xong 23/11**: zone `it_limit` 2r/s burst 5, `limit_req_status 429`; file `infra/nginx/snippets/rate-limit.conf` → `/etc/nginx/conf.d/rate-limit.conf`; `/health` nằm location riêng nên không bị limit; bằng chứng `docs/evidence/23-rate-limit.txt`
- [x] fail2ban jail cho Nginx — **xong 20/11** (sớm, kế hoạch 24/11): `infra/fail2ban/jail.d/internship-tracker.local`; jails `nginx-limit-req` (429 → ban 1h) + `nginx-botsearch` (path khai thác 404 → ban 24h); `backend=polling` vì nginx ghi log file; đã ban thật rồi unban; bằng chứng `docs/evidence/24-fail2ban-nginx.txt`
- [x] Log rotation — **xong 20/11**: dùng `/etc/logrotate.d/nginx` có sẵn (daily, rotate 14, compress, delaycompress); đã `logrotate -f`, thấy `.1`/`.2.gz`, nginx vẫn active; cùng evidence 24
- [ ] Tách TLS-expiry alert riêng (hiện có qua Discord integration nhưng chưa có monitor chuyên biệt)
- [x] Deploy API Express + Neon lên VM — **xong 21/11** (sớm, kế hoạch 22/11): Node 22 LTS, systemd `internship-tracker`, Neon `neondb` (schema + seed), Nginx proxy `/health` + `/applications`; nguồn `week-4-api` commit `189056f`; evidence `docs/evidence/21-api-deploy.txt`
- [ ] API Week 5: auth cho POST/PATCH/DELETE, TLS-expiry monitor riêng, backup DB trước demo — auth là Week 5
- [ ] Chọn kiến trúc client: GitHub Pages (cần CORS `https://anhmy1312.github.io`) hay phục vụ từ VM (same-origin, không cần CORS). `VITE_API_URL` là build-time → đổi URL phải build lại.
- [ ] Docker: **port publish đi xuyên ufw** — khi thêm Docker phải bind `127.0.0.1:PORT:PORT` hoặc thêm rule `DOCKER-USER`
- [ ] Postgres backup + restore drill

---

## 15. Quy trình khẩn cấp khi branch protection chặn hotfix

Branch protection: `Require a pull request` + **1 approval**. Với team 2 người, nếu người kia offline → **single point of failure**.

**Trạng thái 19/11/2026** (partner bật qua UI, tài khoản admin): `main.protected = true`. Token infra chỉ có quyền `write` nên `GET /branches/main/protection` trả 404 và `/rulesets` trả rỗng — không tự verify chi tiết bằng API được; cần partner xác nhận bằng admin/UI. Cấu hình: 1 approval, dismiss stale, require conversation resolution; status checks/linear history OFF; force push/deletion OFF; admin bypass giữ nguyên.

**Bằng chứng protection hoạt động:** push trực tiếp vào `main` bị từ chối `protected branch hook declined` (19/11/2026) — mọi thay đổi phải đi qua PR.

- Giữ **admin bypass** (mặc định của GitHub) — đừng tắt.
- Khi cần hotfix mà không có reviewer:
  1. Báo vào Discord `#chung` trước (ai, việc gì, lý do hotfix).
  2. Dùng quyền admin để merge trực tiếp **hoặc** approve PR của chính mình bằng tài khoản admin (nếu policy cho phép).
  3. **Ghi lại ngay** vào `#chung`: thời gian, người merge, lý do, và tạo issue theo dõi review bổ sung.
  4. Sau khi có reviewer, mở PR nhỏ xác nhận lại thay đổi (`docs:` / `infra:`).

> Không được lạm dụng bypass để bỏ review thông thường — 24h review là quy tắc của trial.

## 16. Cảnh báo trước khi chuyển repo sang Private

- GitHub Pages **đang bật**: `https://anhmy1312.github.io/internship_tracker/` (source `main`).
- Trên tài khoản **Free**, chuyển repo sang **Private** sẽ **unpublish Pages**.
- Trước khi flip: kiểm tra `github.com/settings/billing` / Student Pack xem có **GitHub Pro** không.
  - **Có Pro** → flip Private an toàn, kiểm tra lại Pages sau khi flip.
  - **Không có Pro** → **giữ Public** (đã scan: không secret trong repo) và bật branch protection trên public (miễn phí). Chuyển Private sau khi Pro được duyệt.

> **Quyết định 20/11/2026:** account chủ repo `Anhmy1312` là **GitHub Free** (partner xác nhận, không Pro/Student Pack). Vì Pages đang bật → **giữ repo Public**, **không flip Private**. Branch protection trên public vẫn giữ nguyên; secret scan sạch. Nếu sau này có Pro mới xem lại.

> **PII scan 20/11:** repo Public đã rà lại. Email cá nhân + email trường (kèm MSSV) trong `docs/` thay bằng **“email của Nam — lưu Bitwarden”**; ảnh `15-nsg.png` đã crop bỏ thanh account Azure (lộ email trường + MSSV). Các ảnh evidence còn lại đã kiểm tra, không chứa email/MSSV. Trước PR close-out phải scan lại một lần nữa.

- Nếu client được phục vụ từ Pages, UptimeRobot phải monitor cả 2 endpoint (VM + Pages) để phát hiện việc unpublish. **Hiện đã giữ Public + Pages (200) và monitor Pages ở §12 đã ✅ Up (tạo 20/11).**

---

## 17. Deploy API lên VM (kế hoạch 22/11 — cập nhật theo partner)

> ⚠️ Kế hoạch gốc ghi “Node/systemd chỉ sau 29/11”. Partner đổi sang deploy 22/11 → phải cập nhật `docs/handoff-partner-23-11.md` trong PR close-out cho khớp.

### 17.1. Chuẩn bị

- Code API nằm ở branch **`week-4-api`** (`server/`, `client/`, `deploy/`). `main` hiện vẫn là site tĩnh.
- VM hiện: **chưa có Node/npm**, `/opt` trống, Nginx đang serve tĩnh + `/health` JSON tĩnh.
- DB là **PostgreSQL ngoài (Neon)** — không cài DB trên VM. Cần `DATABASE_URL` (secret, lưu Bitwarden).
- Biến môi trường production:

```text
DATABASE_URL=postgresql://...      (Neon — Bitwarden)
PORT=3000
CORS_ORIGIN=https://anhmy1312.github.io
API_VERSION=0.1.0
DEMO_USER_ID=1

# Client build (baked tại build-time):
VITE_API_URL=https://internship-tracker.duckdns.org/applications
```

### 17.2. File đã chuẩn bị sẵn trong repo

| File | Dùng để |
|---|---|
| `infra/nginx/internship-tracker-api.conf` | Thay hẳn config tĩnh: `/health` proxy sang API, thêm `/applications`, giữ TLS/HSTS/rate limit |
| `infra/scripts/preflight-api.sh` | Chạy trên VM sau deploy, bắt 6 lỗi hay gặp |
| `deploy/internship-tracker.service` (branch `week-4-api`) | systemd unit — dùng cái này, không dùng `infra/systemd/...` (chỉ là template review) |
| `deploy/nginx-locations.conf` (branch `week-4-api`) | Tham khảo 2 location proxy |

### 17.3. Thứ tự deploy (tóm tắt 8 bước partner)

1. `git fetch origin && git switch -c week-4-api origin/week-4-api`.
2. `ssh staging "sudo mkdir -p /opt/internship-tracker && sudo chown deploy:deploy /opt/internship-tracker"`.
3. Cài **Node 22 LTS qua NodeSource**: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`.
4. `scp -r server deploy@40.83.74.1:/opt/internship-tracker/`.
5. `cd /opt/internship-tracker/server && cp .env.example .env` → điền biến ở 17.1 → `npm ci` → `npm run db:check` → `npm run db:setup`.
6. `scp deploy/internship-tracker.service staging:/tmp/` → `sudo install -m 644 /tmp/internship-tracker.service /etc/systemd/system/` → `daemon-reload` → `enable --now internship-tracker` → phải `active (running)`.
7. Copy `infra/nginx/internship-tracker-api.conf` → `/etc/nginx/sites-available/internship-tracker` → `nginx -t` → `reload nginx`.
8. Chạy `bash infra/scripts/preflight-api.sh` trên VM. Tất cả dòng phải **OK**, không có **FAIL**.
9. Chỉ sau đó: PR `week-4-api → main` → approve → merge → build Pages với `VITE_API_URL` ở 17.1 → smoke test thêm/sửa/xoá đơn.

### 17.4. 6 lỗi hay gặp và cách use preflight bắt

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Nginx `duplicate location` | Thêm `location = /health` mới trong khi cái tĩnh còn lại | **Thay** bằng file `internship-tracker-api.conf`; preflight đếm `location = /health` phải = 1 |
| `502` | Service chưa chạy / `proxy_pass` sai port | `systemctl status internship-tracker`; `curl http://127.0.0.1:3000/health` trên VM |
| CORS error | `CORS_ORIGIN` để `localhost:5173` | Đổi thành `https://anhmy1312.github.io` (preflight check) |
| `203/EXEC` | systemd không thấy node (dùng nvm) | Cài NodeSource apt → `/usr/bin/node` |
| UptimeRobot /health đỏ sau proxy | Nhầm thêm `limit_req` vào `/health` | `/health` **không** rate-limit (file API đã làm đúng) |
| Mất HSTS/security header | `add_header` trong `location /health` ghi đè server | File API **không** dùng `add_header` trong location proxy |

> `/health` sau deploy đã là JSON API — §12 đã cập nhật tương ứng.

### 17.5. Kết quả deploy thật 21/11/2026 04:45 UTC

| Hạng mục | Kết quả |
|---|---|
| Node | `v22.23.5` tại `/usr/bin/node` (NodeSource) |
| Code | `week-4-api` commit `189056f` → `/opt/internship-tracker/server` |
| DB | Neon `neondb`, `db:check` OK, `db:setup` applied schema + seed |
| Service | `internship-tracker.service` **active (running)**, `/usr/bin/node src/index.js`, listen `127.0.0.1:3000` |
| Nginx | Bản API thay bản tĩnh; `nginx -t` OK; `location = /health` đếm = 1; HTTP vẫn 301 |
| Preflight | **Không có dòng FAIL** — đầy đủ Node, .env, API local, HTTPS ngoài, ufw không mở 3000 |
| Ngoài | `https://.../health` → `{"status":"ok","uptime":...,"version":"0.1.0"}`; `/applications` → 200 array |
| Evidence | `docs/evidence/21-api-deploy.txt` |

> Backup config tĩnh: `/etc/nginx/sites-available/internship-tracker.static.bak` (để rollback nếu cần).

**Tiếp theo (phía bạn/Anh Mỹ):** approve PR **#6** (`deploy/pages-actions → main`) → merge commit → **Settings → Pages → Source = GitHub Actions** → kiểm tra Action xanh → smoke test thêm/sửa/xoá đơn.

> **Quyết định 22/11 — chọn B (GitHub Actions):** repo Public → Actions miễn phí, không commit `dist/`, URL production nằm trong workflow, rollback = re-run job. `client/vite.config.ts` thêm `base: '/internship_tracker/'` (đã verify build trên VM Node 22: `dist/index.html` trỏ `/internship_tracker/assets/...`, bundle chứa URL API). Workflow `.github/workflows/deploy-pages.yml` trigger `push main`, `permissions: pages:write + id-token:write`, env `VITE_API_URL=https://internship-tracker.duckdns.org/applications`. PR #6 head `436b7eb`.
