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

> **VM đang Stopped/Deallocated (Azure):** Portal (tài khoản Azure của Anh Mỹ) → `vm-it-staging` → **Start**, chờ 1–2 phút rồi mới `ssh`/`curl`. IP tĩnh `40.83.74.1` giữ nguyên; nếu IP đổi thì cập nhật DuckDNS **trước khi** test monitor.

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

---

## 12. Monitoring

| Monitor | URL | Interval | Kênh alert |
|---|---|---|---|
| Health | `https://internship-tracker.duckdns.org/health` | 5' | Discord #alert (webhook) |
| Site | `https://internship-tracker.duckdns.org/` — Keyword `"Internship Tracker"` trong `index.html`; **Start incident when keyword does NOT exist** (keyword mất → DOWN) | 5' | Discord #alert (webhook) |
| Redirect | `http://internship-tracker.duckdns.org/health` (kỳ vọng 301) | 5' | Discord #alert (webhook) |

> `/health` là JSON tĩnh → 200 không chứng minh site còn file. Monitor **Site** bắt trường hợp mất `index.html`; giữ nguyên monitor Health.

> **Trước khi tạo monitor Site:** VM phải **đang chạy**. Azure Portal (tài khoản Anh Mỹ) → `vm-it-staging` → **Start**; chờ 1–2 phút; verify `curl https://.../health` = 200 và `curl https://.../` = 200 rồi mới Add monitor. Tạo monitor khi VM tắt → monitor đỏ ngay, alert giả.
>
> **Trạng thái 20/11 00:35 UTC:** 22/80/443 mở, `/` 200, `/health` 200 (kiểm tra cả từ ngoài). Thông tin "site down từ 18:43 19/11" là trạng thái cũ (VM đã được Start lại) — trước khi kết luận, luôn kiểm tra 3 port + HTTPS.
>
> **Drill 25–26/11:** tạo Maintenance Window cho cả 2 monitor (hoặc Pause trước / Resume sau) để không nhận alert khi VM bị xoá/tạo lại. Ghi giờ thực tế vào bảng dưới.

| Sự kiện | Thời gian (UTC) | Ghi chú |
|---|---|---|
| Rotate webhook Discord | ✅ 20/11 01:01 UTC | Đã tạo webhook mới, cập nhật UptimeRobot, nhận alert thật trong `#alert`; ✅ đã xoá webhook cũ |
| Monitor Site (Keyword) | ✅ 20/11 ~01:04 UTC | URL `/`, keyword `Internship Tracker`, 5'; điều kiện **keyword does NOT exist**; Discord #alert đã tick + test OK lúc 01:15 UTC |
| Quyết định Private/Public | ☐ __/11 | Pro → Private + check Pages 200 trong 10'; Free → giữ Public |
| Maintenance Window drill | 25/11 00:00 → 26/11 00:00 (UTC+7) | Free plan **không có Maintenance Window** (crown/Upgrade) → **Pause/Resume cả 2 monitor**. **Dry-run 20/11 xong**: Pause 01:50 UTC, Resume 01:57 UTC (ảnh + log trong evidence). Drill thật 25–26: ☐ |

> **20/11 01:04 UTC:** monitor Site (Keyword) tạo xong, trạng thái **Up**; monitor `/health` vẫn **Up**. Test notification lúc 01:15 UTC → Discord `#alert` nhận tin **DOWN giả + UP giả** ("was down for N/A" = dấu hiệu test, không phải sự cố thật).

> **Dry-run Pause/Resume 20/11:** Pause lúc 01:50 UTC (ảnh `25-drill-paused.png`), Resume lúc 01:57 UTC (ảnh `26-drill-resumed.png`), log `25-26-drill.txt`. Drill thật 25–26/11 sẽ append entry mới và chụp ảnh ghi đè.

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

---

## 14. Việc còn nợ (ghi rõ để người sau biết)

- [x] Rate limit Nginx `limit_req` — **xong 23/11**: zone `it_limit` 2r/s burst 5, `limit_req_status 429`; file `infra/nginx/snippets/rate-limit.conf` → `/etc/nginx/conf.d/rate-limit.conf`; `/health` nằm location riêng nên không bị limit; bằng chứng `docs/evidence/23-rate-limit.txt`
- [x] fail2ban jail cho Nginx — **xong 20/11** (sớm, kế hoạch 24/11): `infra/fail2ban/jail.d/internship-tracker.local`; jails `nginx-limit-req` (429 → ban 1h) + `nginx-botsearch` (path khai thác 404 → ban 24h); `backend=polling` vì nginx ghi log file; đã ban thật rồi unban; bằng chứng `docs/evidence/24-fail2ban-nginx.txt`
- [x] Log rotation — **xong 20/11**: dùng `/etc/logrotate.d/nginx` có sẵn (daily, rotate 14, compress, delaycompress); đã `logrotate -f`, thấy `.1`/`.2.gz`, nginx vẫn active; cùng evidence 24
- [ ] Tách TLS-expiry alert riêng (hiện có qua Discord integration nhưng chưa có monitor chuyên biệt)
- [ ] API (sau 29/11): auth cho POST/PATCH/DELETE, rate limit riêng `/api/`, backup DB trước demo — auth là Week 5
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
- Nếu client được phục vụ từ Pages, UptimeRobot phải monitor cả 2 endpoint (VM + Pages) để phát hiện việc unpublish.
