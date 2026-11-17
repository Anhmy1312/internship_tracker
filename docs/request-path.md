# Đường đi của một request — nói trong 2 phút, hiểu để debug

> Dùng cho demo 29/11, cho phần "giải thích request path" ở kickoff, và cho câu hỏi phỏng vấn.
> Nguyên tắc: **mỗi lớp có 1 lệnh kiểm tra và 1 kiểu lỗi đặc trưng**. Debug = đi từ ngoài vào, dừng ở lớp đầu tiên sai.

---

## 1. Sơ đồ

```text
Người dùng gõ https://internship-tracker.duckdns.org/
        │
   ①   DNS     A record → 40.83.74.1     (DuckDNS)
        │
   ②   TCP     mở 443 tới IP             (NSG Azure + ufw)
        │
   ③   TLS     SNI = internship-tracker.duckdns.org
               cert Let's Encrypt (fullchain) + TLS 1.2/1.3
        │
   ④   HTTP    GET /   Host: internship-tracker.duckdns.org
        │
   ⑤   Nginx   :443, server_name khớp → location /
        │
   ⑥   File    root /var/www/internship-tracker
               try_files $uri → index.html
        │
   ⑦   200 HTML  (site tĩnh)   —   /health → 200 JSON tĩnh
        │
   ⑧   Nginx thêm HSTS + security headers → trình duyệt
```

Trial chạy **site tĩnh**: không Node, không systemd, không proxy. Khi có API thật (sau trial), chỉ thêm một `location /api/` trỏ tới app — các lớp ①–⑤ và ⑧ giữ nguyên.

---

## 2. Từng lớp: kiểm tra gì, hỏng thì thấy gì

| # | Lớp | Lệnh kiểm tra | Lỗi đặc trưng | Nghĩa |
|---|---|---|---|---|
| ① | DNS | `Resolve-DnsName <host> -Type A` | `curl: (6)`, `ERR_NAME_NOT_RESOLVED` | record sai / chưa lan / AAAA sai |
| ② | TCP | `Test-NetConnection 40.83.74.1 -Port 443` | **timeout** | firewall (NSG hoặc ufw) chặn |
| ② | TCP | `ss -ltnp` rồi lọc `:443` | **Connection refused** | không có process listen (nginx chết) |
| ③ | TLS | `curl.exe -vI https://<host>` | `certificate verify failed`, `expired` | sai host trong cert / hết hạn / thiếu chain |
| ④ | HTTP | `curl.exe -I https://<host>/health` | 301 vòng lặp, 404 | redirect sai, `server_name` không khớp |
| ⑤ | Nginx | `nginx -T`, `tail error.log` | 404 | request vào sai server block |
| ⑥ | Web root | `ls -l /var/www/internship-tracker` | **403** | thiếu file / `www-data` không đọc được |
| ⑥ | `try_files` | `nginx -T \| grep -E 'root\|try_files'` | 404 dù file có thật | sai `root` hoặc thiếu `index` |
| ⑦ | Nội dung | `curl -sS https://<host>/health` | JSON sai `phase` | đang nạp nhầm config phase |
| ⑧ | Header | `curl.exe -I` trên cả 200 và 404 | thiếu HSTS/XCTO | `add_header` bị location ghi đè |

Hai chỗ người mới hay nhầm:

- **Timeout vs refused.** Timeout = gói tin bị chặn (firewall/cloud). Refused = tới được máy nhưng không ai nghe cổng đó (service chết). Sửa hai thứ khác nhau.
- **403 vs 404.** 403 = Nginx tìm thấy đường dẫn nhưng user `www-data` không đọc được (quyền file). 404 = Nginx không tìm thấy file (`root`/`try_files` sai, hoặc file chưa deploy). Sửa hai thứ khác nhau.

---

## 3. Script 2 phút cho demo/buổi nói chuyện

> Nói theo thứ tự này, chỉ tay vào sơ đồ, không đọc thuộc lòng:

1. "Trình duyệt hỏi DNS: `internship-tracker.duckdns.org` là IP nào? A record trả về IP tĩnh của VPS."
2. "Nó mở TCP tới cổng 443. Firewall mở đúng 22, 80, 443 ở hai lớp: NSG của Azure và ufw trên máy — không cổng nào khác lộ ra Internet."
3. "TLS bắt tay: SNI cho Nginx biết người dùng muốn host nào, Nginx trả cert Let's Encrypt của đúng host đó. TLS 1.0/1.1 đã tắt."
4. "Nginx so `Host` với `server_name`; khớp thì vào `location /`."
5. "Nginx lấy file từ `/var/www/internship-tracker`: `/` ra `index.html`, file có thật thì trả file, còn lại 404."
6. "Đây là site tĩnh nên không có app phía sau; `/health` là JSON tĩnh để monitor kiểm tra DNS + Nginx + TLS."
7. "Trên đường về, Nginx thêm HSTS và security headers; cổng 80 chỉ tồn tại để trả 301."
8. "Cả chuỗi này kiểm được bằng 4 lệnh: `Resolve-DnsName`, `curl -I`, `ss -ltnp`, `ls /var/www`. Đó cũng là checklist khi có sự cố."

---

## 4. Câu hỏi tiếp theo sẽ bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời ngắn |
|---|---|
| Site tĩnh sao vẫn cần Nginx, sao không dùng GitHub Pages? | Có chủ đích: học TLS, firewall, redirect, header, log, rate limit trên máy tự vận hành; sau này thêm API cùng host không phải đổi kiến trúc. |
| Vì sao không mở cổng nào ngoài 22/80/443? | Mỗi cổng mở là một bề mặt tấn công. Site chỉ cần 80/443; SSH chỉ 22 và đã key-only + fail2ban. |
| HSTS để làm gì, rủi ro gì? | Ép browser luôn HTTPS, chống hạ cấp. Rủi ro: một chiều — bật `includeSubDomains`/`preload` sai là subdomain hỏng, khó lùi. |
| Cert hết hạn thì sao? | Browser cảnh báo đỏ, client fail. Certbot timer tự renew; `certbot renew --dry-run` chứng minh; MVP thêm alert trước 14 ngày. |
| Site 403 lúc 2h sáng, bạn làm gì? | `curl` từ ngoài → `systemctl status nginx` → `ls -l /var/www` + `namei -l` → `nginx -T \| grep root` → `df -h`; khôi phục, xác nhận monitor xanh, ghi lại nguyên nhân. |
| Vì sao không dùng PaaS cho nhanh? | Đánh đổi có chủ ý: học được TLS/firewall/reverse proxy/backup, kiểm soát chi phí; đổi lại phải tự vận hành và tự chịu downtime. |
| Bảo mật ở lớp network gồm những gì? | 3 port, key-only SSH, fail2ban, TLS hiện đại, HSTS, rate limit (tuần 2), secret ngoài repo, log đủ để truy vết. |

---

## 5. Bài tập tự kiểm (làm trước 21/11)

Vẽ lại sơ đồ trên giấy trắng, rồi với mỗi mũi tên viết:

1. Giao thức + cổng là gì.
2. Lệnh chứng minh lớp đó đang đúng.
3. Kiểu lỗi đặc trưng của lớp đó.

Không mở tài liệu. Nếu viết được 8/8 mũi tên → bạn đã nắm phần network của dự án, không chỉ chạy được lệnh.
