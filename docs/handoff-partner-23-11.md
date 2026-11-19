# Handoff cho bên Partner — 23/11/2026

> File này để trao đổi ranh giới deploy giữa 2 bên. Không chứa secret.

## 1. Trạng thái hiện tại (phía infra / Trial A)

- VM `vm-it-staging`, IP tĩnh `40.83.74.1`, Ubuntu 24.04.
- **Nginx + TLS đã chạy**: `https://internship-tracker.duckdns.org/`
  - `/` → 200 (site tĩnh), `/health` → JSON tĩnh
  - HTTP → 301 HTTPS, SSL Labs **A+**, HSTS + security headers
  - UptimeRobot + Discord alert đã test (trễ 6'), reboot test PASS
  - Rate limit Nginx vừa bật 23/11 (2r/s, burst 5; `/health` không bị limit)
- Toàn bộ hạ tầng đang ở **PR #4** (branch `infra/setup`), **chưa được review/merge**.
- Repo vẫn **Public** — cần partner đổi Private + bật branch protection.

## 2. Ranh giới trial (quan trọng)

Trial Option A là **Network/Security, 16–29/11**. Theo quyết định #7 đã thống nhất:

- Trial chạy **site tĩnh**, **không cài Node, không systemd service, không DB/.env trong giai đoạn 16–29/11**.
- Vì vậy kế hoạch deploy API/Node (`/opt/internship-tracker/server`, `node src/index.js`, systemd unit, `EnvironmentFile=.env`, proxy `/health` và `/applications` sang `:3000`, build client `VITE_API_URL=...`) **không thực hiện trong lúc này**.

Lý do kỹ thuật nếu làm ngay:
- `/health` hiện là JSON **tĩnh** do Nginx trả; nếu proxy sang Node mà Node chưa chạy → **502** → UptimeRobot chuyển ĐỎ → Discord alert liên tục, mất bằng chứng Week 1.
- `.env` tạo ra secret mới phải quản lý (Bitwarden, `.gitignore`, phân quyền 600) — ngoài phạm vi network trial.
- Trộn API deploy vào PR #4 đang chờ review sẽ làm PR đã 29 file phình thêm và xung đột `docs/infra.md`.

## 3. Đề xuất trình tự

1. **Ngay bây giờ (phía partner)**: review + approve + **merge PR #4**; đổi repo sang **Private**; bật branch protection (`Require a pull request`, 1 approval).
2. **Sau khi PR #4 merge**: mở branch/PR **riêng** cho API deploy (không đụng branch `infra/setup` nữa).
3. Khi deploy API thật:
   - Giữ `/health` tĩnh làm fallback, hoặc thêm route `/api/health` riêng để monitor không bị ảnh hưởng.
   - Dùng `127.0.0.1:3000` (không bind `0.0.0.0`) — ufw vẫn chỉ mở 22/80/443.
   - `.env` và private key **không commit**; tạo secrets trong Bitwarden.
   - Cập nhật `docs/infra.md` mục 2 (request path), 5 (deploy), 6 (service), 7 (log) từ bản tĩnh sang bản có API.
4. **Chỉ merge vào `main` khi API public chạy thật** — như bên partner đã đề xuất. Điều này không xung đột với việc merge PR #4 (PR #4 là hạ tầng network, không phải app).

## 4. Việc còn lại trong trial (phía infra)

- 24/11: fail2ban jail cho Nginx (bad bots) + log rotation
- 25–26/11: rebuild drill từ VPS trắng (mục tiêu ≤ 30 phút)
- 27–29/11: tổng hợp báo cáo + rotate webhook Discord (đã lộ trong lúc cấu hình)

## 5. Liên lạc

Discord server **Trial A** → `#chung` / `#alert`. Người infra: Trương Hoài Nam.
