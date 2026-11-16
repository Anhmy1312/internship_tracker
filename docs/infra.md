# Runbook — Hạ tầng Internship Tracker (staging)

> Người đọc giả định: **không biết gì về VPS này**, chỉ có file này + quyền vào repo.
> Mục tiêu: dựng lại từ VPS trắng trong **≤ 30 phút**.
> Điền hết `[TODO]` trước 28/11.

**Cập nhật lần cuối:** [TODO: ngày] — người cập nhật: [TODO]

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

**Host key của server — KHÁC 2 key trên** (đây mới là cái hiện ra ở prompt `The authenticity of host '40.83.74.1'` lần SSH đầu):

| Loại | Fingerprint | Lấy bằng lệnh |
|---|---|---|
| ED25519 host key | `SHA256:JoDCMLRp+BPRUnLYhPhnu7YnNgLAfr19dh5aoJdSURM8` | `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` |

> Ranh giới cần nhớ: **key user** (bảng trên) = ai được đăng nhập; **host key** = có đúng là máy chủ không (chống MITM). Prompt "authenticity of host" hiện **host key**, không phải key user.
> ⚠️ Rebuild drill (25–26/11) tạo máy mới → **host key đổi** → máy nào từng SSH sẽ báo `REMOTE HOST IDENTIFICATION HAS CHANGED`. Xoá dòng cũ: `ssh-keygen -R 40.83.74.1` rồi vào lại, so fingerprint mới (SSH sẽ tự ghi vào `known_hosts`).
**Lệnh SSH:** `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_it" deploy@40.83.74.1`.

**Nơi giữ bí mật (không nằm trong repo):** private key SSH → [TODO: password manager], token DNS → [TODO: DuckDNS account].

> **Giữ credit:** khi không làm việc → Portal → VM → **Stop** → chọn **Deallocate** (Stop thường vẫn tính tiền CPU/RAM). IP tĩnh + disk vẫn giữ (~$6/tháng).

---

## 2. Đường đi của một request

```text
browser
  → DNS (A record → IP)
  → TCP 443 (ufw allow 443)
  → Nginx :443 (TLS, HSTS, security headers)
  → proxy_pass 127.0.0.1:3000
  → Node service (systemd: internship-tracker-api)
  → response
```

HTTP :80 chỉ tồn tại để trả `301` sang HTTPS.

---

## 3. Port đang mở

| Port | Dịch vụ | Ai cần |
|---|---|---|
| 22 | sshd | deploy |
| 80 | Nginx | redirect → 443 |
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

```bash
sudo -u deploy bash -lc 'cd /opt/internship-tracker && git pull --ff-only'
sudo -u deploy bash -lc 'cd /opt/internship-tracker/server && npm ci && npm run build'
sudo systemctl restart internship-tracker-api
```

Hoặc: `bash /opt/internship-tracker/infra/scripts/deploy.sh`

Kiểm tra: `curl -sS https://<host>/health`

---

## 6. Restart / stop service

```bash
sudo systemctl status internship-tracker-api
sudo systemctl restart internship-tracker-api
sudo systemctl stop internship-tracker-api     # dùng để test alert
```

---

## 7. Xem log

```bash
sudo journalctl -u internship-tracker-api -n 100 --no-pager   # app
sudo journalctl -u internship-tracker-api -f                   # follow
sudo tail -n 100 /var/log/nginx/error.log                      # nginx
sudo tail -n 100 /var/log/nginx/access.log
sudo fail2ban-client status sshd                               # ssh
```

| Triệu chứng | Xem gì trước |
|---|---|
| 502 Bad Gateway | `systemctl status` → `journalctl -u` → `ss -ltnp \| grep 3000` |
| 404 toàn bộ | `nginx -T \| grep server_name`, đúng site chưa |
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
| Deploy làm hỏng app | `cd /opt/internship-tracker && git log --oneline -5` → `git checkout <commit-tốt>` → build → restart |
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
  /etc/nginx /etc/systemd/system/internship-tracker-api.service \
  /etc/ssh/sshd_config.d /etc/fail2ban/jail.d

# restore
sudo tar xzf /opt/backup/etc-<ngày>.tar.gz -C /
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload && sudo systemctl restart internship-tracker-api
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
| 4 | Copy + chạy bootstrap | `scp -i <key> infra/scripts/bootstrap.sh deploy@IP:/tmp/` → `sudo bash /tmp/bootstrap.sh` | 6 | ☐ |
| 5 | Test key login ở terminal mới | `ssh -i <key> deploy@IP` | 2 | ☐ |
| 6 | Chạy hardening | `sudo bash /tmp/bootstrap.sh --harden` | 1 | ☐ |
| 7 | Clone repo | `sudo -u deploy git clone <repo> /opt/internship-tracker` | 2 | ☐ |
| 8 | Swap 2 GB (B-series chỉ 1 GiB RAM) | `fallocate -l 2G /swapfile && mkswap && swapon && ghi /etc/fstab` | 1 | ☐ |
| 9 | Cài Node 22 | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs` | 3 | ☐ |
| 10 | Build + systemd | `npm ci && npm run build`, cài unit, `enable --now` | 4 | ☐ |
| 11 | Nginx site | copy từ `infra/nginx/`, `nginx -t`, reload | 2 | ☐ |
| 12 | Certbot | `certbot certonly --nginx -d <host>` rồi bật site HTTPS | 3 | ☐ |
| 13 | Verify | `curl -I` http/https, SSL Labs, `/health` | 2 | ☐ |
| | **Tổng** | mục tiêu ≤ 30 | **~31** | ☐ |

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
sudo systemctl stop internship-tracker-api
# chờ ≥ 6 phút, xác nhận có alert
sudo systemctl start internship-tracker-api
```

---

## 13. Incident checklist (khi /health đỏ)

- [ ] Xác nhận từ ngoài: `curl -sS -o /dev/null -w '%{http_code}\n' https://<host>/health`
- [ ] Phân biệt: TLS lỗi / 502 / 404 / timeout → xem bảng mục 7.
- [ ] `systemctl status internship-tracker-api`
- [ ] `journalctl -u internship-tracker-api -n 100 --no-pager`
- [ ] `ss -ltnp | grep 3000` — app có listen không.
- [ ] `systemctl status nginx`, `nginx -t`
- [ ] `sudo ufw status` — port còn mở không.
- [ ] `df -h` — đầy disk cũng gây 502.
- [ ] Khôi phục → xác nhận monitor xanh → ghi lại nguyên nhân + thời gian.

---

## 14. Việc còn nợ (ghi rõ để người sau biết)

- [ ] Rate limit Nginx `limit_req`
- [ ] fail2ban jail cho Nginx (bad bots)
- [ ] Log rotation cho app
- [ ] Docker: **port publish đi xuyên ufw** — khi thêm Docker phải bind `127.0.0.1:PORT:PORT` hoặc thêm rule `DOCKER-USER`
- [ ] Postgres backup + restore drill
