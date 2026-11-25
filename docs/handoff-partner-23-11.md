# Handoff cho bên Partner — cập nhật 23/11/2026

> File trao đổi ranh giới giữa 2 bên. Không chứa secret.
> PR #4 (branch `infra/setup` → `main`). Head và số file thay đổi sau mỗi commit fix review — luôn kiểm tra lại trực tiếp trên GitHub trước khi approve.

## 1. Trạng thái phía infra / Trial A

- VM `vm-it-staging`, IP tĩnh **`57.158.81.247`** (từ 25/11; IP cũ `40.83.74.1` đã mất — xem `docs/infra.md` §13.2), Ubuntu 24.04.
- **Nginx + TLS đang chạy**: `https://internship-tracker.duckdns.org/`
  - `/` → 200 (site tĩnh), `/health` → JSON tĩnh
  - HTTP → 301 HTTPS, SSL Labs **A+**, HSTS + security headers
  - UptimeRobot + Discord alert đã test (trễ 6'), reboot test PASS
  - Rate limit Nginx 23/11: 2r/s, burst 5, `limit_req_status 429`; `/health` không bị limit
- Toàn bộ hạ tầng ở **PR #4** (branch `infra/setup`), **chưa review/merge**.
- Repo vẫn **Public**.

## 2. Ranh giới trial (không đổi)

Trial Option A = **Network/Security, 16–29/11**. Quyết định #7: **site tĩnh, không Node/systemd/.env trên VM trong trial**.

Lý do không deploy API ngay: `/health` hiện là JSON tĩnh do Nginx trả. Nếu proxy sang Node mà Node chưa chạy → **502** → UptimeRobot đỏ → Discord alert spam → mất bằng chứng Week 1.

## 3. Trình tự đã chốt (sửa theo góp ý của partner)

1. **Ngay bây giờ — phía partner**: review + approve + **merge PR #4**; xử lý Private/Public (xem mục 4); bật branch protection.
2. **Trong trial (đến 29/11)**: bên API chỉ mở **branch + PR draft** để chuẩn bị — **không cài Node/systemd trên VM, không đổi `/health`, không thêm `.env` lên server**.
3. **Sau 29/11**: merge PR API + deploy thật. Khi đó giữ `/health` tĩnh làm fallback và thêm `/api/health` riêng; app bind `127.0.0.1:3000`; `.env` và private key không commit; cập nhật `docs/infra.md` mục 2/5/6/7.
4. **Chỉ merge vào `main` khi API public chạy thật** — đồng ý với partner.

### Kiến trúc client cần chọn trước khi viết PR API

| Lựa chọn | Hệ quả |
|---|---|
| Client vẫn trên GitHub Pages (`https://anhmy1312.github.io/internship_tracker/`) gọi API DuckDNS | Phải thêm `https://anhmy1312.github.io` vào `CORS_ORIGIN`. `VITE_API_URL` là **build-time** → đổi URL phải build lại client. |
| Client phục vụ từ chính VM | **same-origin**, không cần CORS; nhưng Pages sẽ không còn là đường public chính. |

Cần **chốt một kiến trúc** trước khi viết PR API.

### API trước demo 29/11

API hiện **không có auth** — POST/PATCH/DELETE công khai. Tối thiểu trước demo: rate limit riêng cho `/api/` + backup DB. Auth là Week 5.

> **Cập nhật 21–23/11:** API Express + Neon **đã deploy thật trên VM từ 21/11** (không đợi sau 29/11 như kế hoạch cũ). Client publish lên Pages qua **GitHub Actions (phương án B, partner chốt 22/11)** với `vite.config.ts` `base: '/internship_tracker/'` và `VITE_API_URL` đặt trong workflow. PR deploy: **#7** (`week-4-api → main`, đã merge; run `44880908036` success). PR **#6** trùng → đã đóng, branch xoá. Bằng chứng `docs/evidence/21-api-deploy.txt`.

## 4. Private + branch protection — 3 điều kiện (có thay đổi quan trọng)

1. **GitHub Pages đang bật** (`anhmy1312.github.io/internship_tracker`, source = **GitHub Actions** từ 21/11). Trên tài khoản **Free**, flip Private sẽ **unpublish Pages** → nếu client đang ở Pages thì site client mất. Trước khi flip: kiểm tra `github.com/settings/billing` / Student Pack có **GitHub Pro** không.
   - Có Pro → flip Private, kiểm tra Pages sau khi flip.
   - Không có Pro → **giữ Public** (đã scan, không secret) và bật protection trên public (miễn phí); chuyển Private sau khi Pro duyệt.
2. **Branch protection trên Private** cũng phụ thuộc gói — thử bật sau khi flip; nếu UI không cho → quay lại phương án public.
3. `Require a pull request` + **1 approval** với team 2 người = single point of failure. Giữ **admin bypass** (mặc định) và dùng quy trình khẩn cấp đã ghi trong `docs/infra.md` mục 15 (báo `#chung`, merge, ghi log, review bổ sung).

## 4.1. Publish Pages — chọn B (GitHub Actions), chốt 22/11

- Lý do: repo Public → Actions miễn phí, **không commit `dist/`**, URL production nằm trong workflow, rollback = re-run job.
- Owner đổi **Settings → Pages → Source = GitHub Actions**.
- `client/vite.config.ts` thêm `base: '/internship_tracker/'` (bắt buộc; nếu không asset `/assets/...` bị 404).
- Workflow `.github/workflows/deploy-pages.yml`: trigger `push main` + `workflow_dispatch`, `permissions: pages:write, id-token:write`, env `VITE_API_URL=https://internship-tracker.duckdns.org/applications`.
- PR deploy: **#7** `week-4-api → main` — **đã merge**, run **44880908036** success. PR #6 (`deploy/pages-actions`) là bản trùng → closed, branch xoá. Không cần approve thêm.

## 5. Các lỗi đã sửa theo review (23/11)

| Lỗi | Fix |
|---|---|
| Runbook mục 11 thiếu cài nginx/certbot + copy 3 snippet | Đã bổ sung bước 9–10, 13–14; tổng ~32 phút, đo giờ thật khi drill |
| `infra/scripts/deploy.sh` check HTTP không theo 301, không đọc body → luôn "OK" | Đổi sang `https` + `grep '"status":"ok"'` + kiểm tra `/` |
| `limit_req_status 503` sai ý nghĩa | Đổi **429**, chạy lại evidence `23-rate-limit.txt` |
| `.gitignore` thiếu cert/key | Thêm `*.pem`, `*.key`, `*.p12`, `*.pfx` |
| systemd `ExecStart=dist/index.js`, `Documentation=TODO` | Đổi `src/index.js`, link repo thật; giữ `EnvironmentFile` **không có dấu `-`** để fail-fast; ghi rõ Node 22 LTS qua **NodeSource, không nvm** |
| Comment "đổi 1 chỗ" nhưng host xuất hiện 4 chỗ | Sửa thành "đổi 4 chỗ: 2 server_name + 2 cert path" |
| `/health` hằng số 200 không chứng minh còn file | Thêm monitor thứ 2 vào `/` với keyword trong `index.html` (giữ nguyên monitor `/health`) |

## 6. Webhook Discord — rotate NGAY (không đợi 27–29)

URL webhook đã lộ trong terminal history / log cấu hình (ảnh `21-alert.png` **không** lộ token, nhưng vẫn coi là đã lộ).

1. Discord → `#alert` → Edit Channel → Integrations → **Create Webhook mới**.
2. Copy URL mới → cập nhật Bitwarden item `Trial A — UptimeRobot webhook`.
3. UptimeRobot → Integration Discord → thay URL → **Save**.
4. Test alert (stop nginx 6') → xác nhận tin về kênh.
5. **Xoá webhook cũ**.

## 7. Việc còn lại trong trial (phía infra)

- 24/11: fail2ban jail cho Nginx (bad bots) + log rotation
- 25–26/11: rebuild drill từ VPS trắng (đo giờ thật; mục tiêu 30 phút có thể thành 40–45 do cert + DuckDNS)
- 27–29/11: báo cáo + tổng hợp

## 8. Liên lạc

Discord server **Trial A** → `#chung` / `#alert`. Người infra: Trương Hoài Nam.
