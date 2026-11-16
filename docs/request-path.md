# Đường đi của một request — nói trong 2 phút, hiểu để debug

> Dùng cho demo 29/11, cho phần "giải thích request path" ở kickoff, và cho câu hỏi phỏng vấn.
> Nguyên tắc: **mỗi lớp có 1 lệnh kiểm tra và 1 kiểu lỗi đặc trưng**. Debug = đi từ ngoài vào, dừng ở lớp đầu tiên sai.

---

## 1. Sơ đồ

```text
Người dùng gõ https://staging.example.com/health
        │
   ①   DNS     A record → 203.0.113.10   (TTL 300)
        │
   ②   TCP     mở 443 tới IP             (ufw + cloud firewall)
        │
   ③   TLS     SNI = staging.example.com
               cert Let's Encrypt (fullchain) + TLS 1.2/1.3
        │
   ④   HTTP    GET /health   Host: staging.example.com
        │
   ⑤   Nginx   :443, server_name khớp → location = /health
        │      (thêm X-Forwarded-For, X-Forwarded-Proto)
   ⑥   proxy_pass → 127.0.0.1:3000
        │
   ⑦   Node (systemd) trả 200 {"status":"ok"}
        │
   ⑧   Nginx thêm HSTS + security headers → trình duyệt
```

Sau MVP, `⑦` gọi tiếp PostgreSQL → đường đi thành 9 lớp. Lúc đó phải quyết định `/health` chỉ báo "process sống" hay báo cả "DB sống" (deep health).

---

## 2. Từng lớp: kiểm tra gì, hỏng thì thấy gì

| # | Lớp | Lệnh kiểm tra | Lỗi đặc trưng | Nghĩa |
|---|---|---|---|---|
| ① | DNS | `Resolve-DnsName <host> -Type A` | `curl: (6)`, `ERR_NAME_NOT_RESOLVED` | record sai / chưa lan / AAAA sai |
| ② | TCP | `Test-NetConnection <IP> -Port 443` | **timeout** | firewall (cloud hoặc ufw) chặn |
| ② | TCP | `ss -ltnp` rồi lọc `:443` | **Connection refused** | không có process listen (nginx chết) |
| ③ | TLS | `curl.exe -vI https://<host>` | `certificate verify failed`, `expired` | sai host trong cert / hết hạn / thiếu chain |
| ④ | HTTP | `curl.exe -I https://<host>/health` | 301 vòng lặp, 404 | redirect sai, `server_name` không khớp |
| ⑤ | Nginx | `nginx -T`, `tail error.log` | 404 | request vào sai server block |
| ⑥ | Proxy | `ss -ltnp`, `journalctl -u <svc>` | **502** | app chết / sai port / bind sai |
| ⑥ | Proxy | `time curl -sS 127.0.0.1:3000/health` | **504** | app treo, vượt `proxy_read_timeout` |
| ⑦ | Service | `systemctl status`, `journalctl` | 502 sau reboot | unit không `enable` / crash loop |
| ⑧ | Header | `curl.exe -I` trên cả 200 và 404 | thiếu HSTS/XCTO | `add_header` bị location ghi đè |

Hai chỗ người mới hay nhầm:

- **Timeout vs refused.** Timeout = gói tin bị chặn (firewall/cloud). Refused = tới được máy nhưng không ai nghe cổng đó (service chết). Sửa hai thứ khác nhau.
- **404 vs 502.** 404 = Nginx trả lời (lớp ⑤ đúng, sai route). 502 = Nginx gọi app và app không trả lời (lớp ⑥ sai). Thấy 502 thì **đừng** sửa Nginx trước.

---

## 3. Script 2 phút cho demo/buổi nói chuyện

> Nói theo thứ tự này, chỉ tay vào sơ đồ, không đọc thuộc lòng:

1. "Trình duyệt hỏi DNS: `staging.<domain>` là IP nào? A record trả về IP VPS, TTL 300 giây để mình đổi IP mà không phải chờ lâu."
2. "Nó mở TCP tới cổng 443. Firewall chỉ mở 22, 80, 443 — 3000 không bao giờ lộ ra Internet."
3. "TLS bắt tay: SNI cho Nginx biết người dùng muốn host nào, Nginx trả cert Let's Encrypt của đúng host đó. TLS 1.0/1.1 đã tắt."
4. "Nginx so `Host` với `server_name`; khớp thì vào `location = /health`."
5. "Nginx không tự trả lời — nó `proxy_pass` sang `127.0.0.1:3000`, thêm `X-Forwarded-For` và `X-Forwarded-Proto` để app biết IP thật và biết request gốc là HTTPS."
6. "Node chạy dưới systemd, tự restart khi crash và tự lên sau reboot."
7. "Trên đường về, Nginx thêm HSTS và security headers; cổng 80 chỉ tồn tại để trả 301."
8. "Cả chuỗi này kiểm được bằng 4 lệnh: `Resolve-DnsName`, `curl -I`, `ss -ltnp`, `journalctl`. Đó cũng là checklist khi có sự cố."

---

## 4. Câu hỏi tiếp theo sẽ bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời ngắn |
|---|---|
| Vì sao cần Nginx, sao không cho Node nghe 443? | Node không cần quyền root cho 443, không phải lo cert/reload; Nginx lo TLS, redirect, header, rate limit, log tập trung; đổi app không đụng cổng public. |
| Vì sao app bind `127.0.0.1`? | Chỉ Nginx trên cùng máy cần gọi. Bind `0.0.0.0` là mở thêm cửa mà ufw không quản (nhất là khi có Docker). |
| HSTS để làm gì, rủi ro gì? | Ép browser luôn HTTPS, chống hạ cấp. Rủi ro: một chiều — bật `includeSubDomains`/`preload` sai là subdomain hỏng, khó lùi. |
| Cert hết hạn thì sao? | Browser cảnh báo đỏ, API client fail. Certbot timer tự renew; `certbot renew --dry-run` chứng minh; MVP thêm alert trước 14 ngày. |
| 502 lúc 2h sáng, bạn làm gì? | `curl` từ ngoài → `systemctl status` → `journalctl -u` → `ss -ltnp` → `df -h`; khôi phục, xác nhận monitor xanh, ghi `docs/incidents/`. |
| Vì sao không dùng PaaS cho nhanh? | Đánh đổi có chủ ý: học được TLS/firewall/reverse proxy/backup, kiểm soát chi phí; đổi lại phải tự vận hành và tự chịu downtime. |
| Bảo mật ở lớp network gồm những gì? | 3 port, key-only SSH, fail2ban, TLS hiện đại, HSTS, rate limit, không lộ app port, secret ngoài repo, log đủ để truy vết. |

---

## 5. Bài tập tự kiểm (làm trước 21/11)

Vẽ lại sơ đồ trên giấy trắng, rồi với mỗi mũi tên viết:

1. Giao thức + cổng là gì.
2. Lệnh chứng minh lớp đó đang đúng.
3. Kiểu lỗi đặc trưng của lớp đó.

Không mở tài liệu. Nếu viết được 8/8 mũi tên → bạn đã nắm phần network của dự án, không chỉ chạy được lệnh.