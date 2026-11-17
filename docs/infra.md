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
| Người liên hệ | [TODO: tên + Discord] |

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

**Nơi giữ bí mật (không nằm trong repo):** private key SSH → [TODO: password manager], token DNS → [TODO: DuckDNS account].

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

`nginx -t` **trước** mọi `reload`. Không có service app nào khác trong trial.

---

## 7. Xem log

```bash
sudo tail -n 100 /var/log/nginx/internship-tracker.error.log    # site
sudo tail -n 100 /var/log/nginx/internship-tracker.access.log   # ai gọi gì
sudo tail -n 100 /var/log/nginx/error.log                       # nginx chung
sudo fail2ban-client status sshd                                # ssh
```

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
| 9 | Nginx site | copy `infra/nginx/internship-tracker.http.conf`, bỏ `sites-enabled/default`, `nginx -t`, reload | 2 | ☐ |
| 10 | Certbot | `certbot certonly --nginx -d <host>` rồi bật site HTTPS | 3 | ☐ |
| 11 | Verify | `curl -I` http/https, SSL Labs, `/health` | 2 | ☐ |
| | **Tổng** | mục tiêu ≤ 30 | **~25** | ☐ |

Nếu vượt 30 phút: ghi rõ bước nào chậm và sửa runbook — **không** sửa bằng cách bỏ bước.

---

## 12. Monitoring

| Monitor | URL | Interval | Kênh alert |
|---|---|---|---|
| Health | `https://<host>/health` | 5' | [TODO: channel chung] |
| Redirect | `http://<host>/health` (kỳ vọng 301) | 5' | [TODO] |

**Đã test alert:** [TODO: ngày] — stop service lúc [TODO], nhận alert lúc [TODO], độ trễ **[TODO] phút**.

Test lại:

```bash
sudo systemctl stop nginx
# chờ ≥ 6 phút, xác nhận có alert
sudo systemctl start nginx
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

- [ ] Rate limit Nginx `limit_req`
- [ ] fail2ban jail cho Nginx (bad bots)
- [ ] Log rotation cho app
- [ ] Docker: **port publish đi xuyên ufw** — khi thêm Docker phải bind `127.0.0.1:PORT:PORT` hoặc thêm rule `DOCKER-USER`
- [ ] Postgres backup + restore drill
