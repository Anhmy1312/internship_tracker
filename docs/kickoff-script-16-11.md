# Kịch bản kickoff 16/11 — 60 phút, bấm giờ

> Mục đích buổi họp: **không phải kỹ thuật**. Chỉ 3 việc: (1) cả hai hiểu "đích" là gì,
> (2) chốt 5 quyết định, (3) biết tuần này ai làm gì.
> Không cài gì trong buổi họp. Không SSH. Không sửa config.

---

## Trước giờ họp 15 phút — chuẩn bị

Mở sẵn 5 tab:

| Tab | Để làm gì |
|---|---|
| `trial-a/kickoff-16-11.md` | bảng 5 quyết định (khối 4) |
| `trial-a/docs/01-network-week1.md` | lịch 16–22/11 (khối 5) |
| `trial-a/docs/request-path.md` | vẽ request path (khối 3) |
| `trial-a/infra/nginx/internship-tracker.http.conf` | chứng minh `/health` tĩnh có sẵn |
| Azure Portal → `vm-it-staging` | chứng minh máy thật (IP 40.83.74.1) |

Gửi partner trước 15 phút:

```text
15 phút nữa mình bắt đầu nhé. Bạn chuẩn bị:
1. App hiện tại chạy được trên máy bạn (React + API) — để demo 2 phút.
2. Trả lời giúp: bạn rảnh tối thứ mấy trong tuần này?
3. Biết trước: hôm nay KHÔNG cài gì, chỉ chốt quyết định + chia việc.
   Kỹ thuật bắt đầu 17/11.
```

---

## Luật của buổi họp

1. **60 phút là cứng.** Hết giờ dừng, phần chưa xong chuyển sang chat.
2. **Bạn dẫn, partner trả lời.** Đừng để biến thành buổi giảng.
3. **Quyết định ghi ngay tại chỗ**, không "tí nữa ghi lại".
4. **Không tranh luận kỹ thuật chi tiết** — câu nào khó thì "để 17–18/11 xử lý".

---

## Khối 1 — 0–5' · Mở đầu

Nói đúng 4 câu này (đừng dài hơn):

> "Trial 16–29/11, mỗi tuần 8–10 tiếng. Cuối trial phải có 6 thứ: VPS hardened
> (SSH key, không root, ufw 22/80/443), `https://internship-tracker.duckdns.org/health`
> trả 200, HTTP chuyển 301 sang HTTPS, SSL Labs ≥ A, alert uptime đã test thật, và
> runbook để **người khác** dựng lại trong 30 phút.
> Mình lo phần hạ tầng, bạn lo phần app + kiểm tra chéo.
> Hôm nay chỉ chốt quyết định, không cài gì."

**Kết quả cần đạt:** partner nói lại được ít nhất 4/6 mục. Nếu họ không nói lại được → đọc chậm lại 1 lần.

---

## Khối 2 — 5–15' · Xem app hiện có

Partner demo 2 phút, bạn hỏi đúng 6 câu và **ghi vào giấy**:

| # | Câu hỏi | Vì sao cần |
|---|---|---|
| 1 | Chạy bằng lệnh gì? (`npm run dev` / `npm start`) | 19/11 dựng systemd |
| 2 | Port mặc định? (3000?) | `proxy_pass 127.0.0.1:3000` |
| 3 | Build production bằng lệnh gì? (`npm run build`) | 19/11 |
| 4 | Có `/health` chưa? Trả gì? | nếu chưa → 18/11 dùng bản tĩnh của Nginx |
| 5 | Có database chưa? | nếu có → `/health` **không** được phụ thuộc DB |
| 6 | Máy bạn Windows hay Mac? | để gửi đúng lệnh PowerShell/bash |

**Kết quả cần đạt:** 6 dòng giấy. Đây là input cho ngày 19/11, thiếu là 19/11 phải hỏi lại.

> Nếu app chưa chạy được: không sao. Ghi "chưa chạy", 18/11 vẫn dựng Nginx với `/health` tĩnh, 19/11 mới cần app thật.

---

## Khối 3 — 15–25' · Vẽ chung request path

**Việc làm:** partner vẽ, bạn sửa. Không bạn vẽ một mình.

Cho họ vẽ 5 bước này, mỗi bước hỏi "cái gì xảy ra ở đây?":

```text
1. Gõ https://internship-tracker.duckdns.org/health
2. DNS trả gì?  → A record → 40.83.74.1
3. Máy nào nhận? → TCP 443 vào Azure NSG → ufw → Nginx
4. Ai mã hoá?   → Nginx dùng cert Let's Encrypt cho đúng hostname
5. Ai trả JSON? → Nginx → proxy_pass 127.0.0.1:3000 → Node
```

Rồi hỏi 3 câu "bẫy":

- "Nếu DNS sai thì lỗi hiện ra thế nào?" → `NXDOMAIN` / trình duyệt không tìm thấy
- "Nếu NSG chưa mở 443 thì sao?" → **timeout**, không phải lỗi cert
- "Nếu cert hết hạn thì sao?" → trình duyệt cảnh báo, `curl` báo lỗi verify

**Kết quả cần đạt:** 1 ảnh chụp bảng vẽ → `docs/evidence/16-request-path.png`.
Đây là thứ dùng lại trong demo 29/11 — phần "hiểu hệ thống" ăn điểm nhất.

---

## Khối 4 — 25–40' · Chốt 5 quyết định (khối quan trọng nhất)

Đi từng dòng. Mỗi dòng: đọc lựa chọn → hỏi "ok không?" → ghi.

| # | Quyết định | Đọc nguyên văn | Nếu partner "sao cũng được" |
|---|---|---|---|
| 1 | Ngân sách | "0đ. Azure for Students, credit $100, không cần thẻ, hết hạn 14/11/2027. Không ai phải trả tiền." | Chốt luôn 0đ |
| 2 | Ai đứng tên cloud | "Mình đứng tên vì mình đã có subscription. Bạn không cần thẻ, không cần vào Portal." | Chốt: bạn đứng tên |
| 3 | Domain | "DuckDNS, 0đ: `internship-tracker.duckdns.org`. Nhược điểm: URL không có chữ `staging`. Mua domain thật ~$10/năm thì đẹp hơn nhưng cần thẻ." | Chốt: DuckDNS |
| 4 | Khung giờ | "Cần 3–4 buổi/tuần. Bạn rảnh tối thứ mấy?" | Đề xuất: T3, T5, T7 20:00–21:30 |
| 5 | Kênh alert | "Alert uptime phải tới kênh **cả hai** đều ở trong, không phải mail riêng. Discord hay Telegram?" | Đề xuất: Discord server chung |

**Câu hỏi phải hỏi thêm (để tránh hiểu nhầm sau này):**

> "Bạn có muốn tự tay làm phần nào không? Vì 26/11 bạn phải tự dựng lại toàn bộ một lần — nếu tuần này bạn chỉ ngồi xem, hôm đó sẽ rất khó."

**Kết quả cần đạt:** 5 dòng ghi rõ, có giờ cụ thể cho #4 và tên kênh cho #5.

---

## Khối 5 — 40–50' · 3 issue + `/health` 2 pha

Nói ngắn, mỗi issue 2 câu:

| Issue | Nội dung | Ai làm | Xong khi |
|---|---|---|---|
| 01 | Dựng VPS + hardening + Nginx HTTP | Bạn | `curl http://.../health` = 200, ufw chỉ 22/80/443 |
| 02 | HTTPS + 301 + headers | Bạn (partner chạy SSL Labs) | SSL Labs ≥ A, `http://` → 301 |
| 03 | Uptime monitor + alert thật | Bạn (partner nhận alert) | Stop service → có alert trong ≤ 5 phút |

**Giải thích `/health` 2 pha** (đây là chỗ partner hay hiểu sai):

> "Ngày 18/11 mình chưa cần app của bạn. Nginx tự trả JSON tĩnh
> `{"status":"ok","phase":"static-http"}` — để chứng minh DNS + port 80 + Nginx chạy.
> Ngày 19/11 mình chuyển sang app thật của bạn. Lúc đó `/health` phải trả 200 nhanh,
> **không phụ thuộc database** — vì monitor gọi mỗi 5 phút, DB chậm là báo động giả."

**Kết quả cần đạt:** partner biết 18/11 họ **không** bị chặn, và biết 19/11 họ phải giao gì.

---

## Khối 6 — 50–55' · Cách làm việc (4 luật)

Đọc 4 dòng, giải thích 1 câu mỗi dòng:

1. **Không push thẳng `main`** — mọi thay đổi qua PR nhỏ. *Vì: có lịch sử, và người kia review được.*
2. **Review trong 24h** — quá 24h thì nhắc. *Vì: 2 tuần rất ngắn, chờ 2 ngày là mất 1/7 thời gian.*
3. **Bí quá 2 ngày thì báo ngay** — không im lặng. *Vì: im lặng đến cuối tuần là không kịp.*
4. **Không commit secret** — token DuckDNS, `.env` chỉ trên server/vault. *Vì: repo có thể public sau này.*

Thêm 1 luật riêng cho hạ tầng:

5. **Chỉ 1 người sửa `sshd`/`ufw`/nginx tại 1 thời điểm** (là bạn). Partner verify sau, không tự sửa. *Vì: 2 người cùng sửa thì không ai biết state thật.*

---

## Khối 7 — 55–60' · Chốt lịch + bước tiếp

| Việc | Nói gì |
|---|---|
| 3 buổi/tuần | "Chốt: [T3, T5, T7] 20:00–21:30. Mình gửi calendar invite tối nay." |
| Check-in | "22/11 30 phút — tuần 1 đạt gì. 26/11 30 phút — chạy thử demo." |
| Demo | "29/11, 15 phút. Bạn nói phần app, mình nói phần hạ tầng." |
| Việc của partner tuần này | "17/11 test SSH (đã có key). 18/11 `curl` từ máy bạn. 20/11 chạy SSL Labs. 22/11 review PR." |
| Việc của bạn tuần này | "17/11 hardening + ufw. 18/11 DNS + Nginx. 19/11 Node. 20/11 TLS. 21/11 alert." |

Kết thúc bằng 1 câu:

> "Hôm nay hết. Tối nay mình gửi link repo + 3 issue. Có gì vướng thì nhắn luôn, đừng chờ buổi sau."

---

## Sau họp 15 phút — 6 việc

- [ ] Tạo repo (nếu chưa) → invite **Write** → bật branch protection `main`
- [ ] Tạo 3 issue, assign, label `trial`
- [ ] Gửi partner: link repo + 3 issue + lịch + 2 fingerprint (user key của họ, host key server)
- [ ] Calendar invite: 22/11, 26/11, 29/11
- [ ] Ghi biên bản (mẫu dưới) vào chat chung để cả hai cùng có
- [ ] Ghi 5 quyết định vào `docs/decisions/` (nếu chưa có file thì tạo `0001-vps-provider.md`)

---

## Biên bản mẫu (copy, điền, gửi chat chung)

```text
BIÊN BẢN KICKOFF — 16/11/2026

Có mặt: [tên bạn], [tên partner]

ĐÍCH (6 acceptance):
1. VPS hardened: SSH key-only, no root, ufw chỉ 22/80/443
2. https://internship-tracker.duckdns.org/health = 200
3. http:// → 301 https://
4. SSL Labs ≥ A
5. Uptime alert đã test thật (stop service → nhận alert)
6. Runbook: người khác dựng lại ≤ 30 phút

QUYẾT ĐỊNH:
1. Ngân sách: 0đ (Azure for Students, $100, không thẻ)
2. Tài khoản cloud: [bạn] đứng tên
3. Domain: DuckDNS internship-tracker.duckdns.org
4. Lịch: [T3, T5, T7] 20:00–21:30, 3 buổi/tuần
5. Kênh alert: [Discord server chung / kênh #alert]

CHIA VIỆC:
- [bạn]: VM, ufw, SSH hardening, Nginx, TLS, monitor, runbook
- [partner]: /health thật (19/11), SSL Labs + curl test, review PR, tự dựng lại 26/11

MỐC:
- 18/11: /health tĩnh qua HTTP = 200
- 20/11: HTTPS + SSL Labs A
- 21/11: alert thật
- 22/11: PR infra merge + check-in
- 26/11: partner tự dựng lại ≤ 30 phút
- 29/11: demo 15 phút

LUẬT: PR nhỏ + review 24h · không push main · bí > 2 ngày thì báo ·
không commit secret · chỉ 1 người sửa sshd/ufw/nginx tại 1 thời điểm.
```

---

## 5 câu partner dễ hỏi — trả lời sẵn

| Họ hỏi | Bạn trả lời |
|---|---|
| "Sao không có `staging.` trước tên miền?" | "DuckDNS chỉ cấp 1 cấp tên. Domain thật thì có, nhưng $10/năm + cần thẻ." |
| "Ai trả tiền?" | "Không ai. Credit $100 của trường, không gắn thẻ nên không thể phát sinh phí." |
| "Tôi có phải vào Azure không?" | "Không. Bạn SSH bằng key riêng. Máy hỏng thì mình bật lại." |
| "Bao giờ tôi cần `/health` thật?" | "19/11. 18/11 mình dùng bản tĩnh của Nginx, bạn không bị chặn." |
| "Nếu tôi không làm kịp 26/11 thì sao?" | "Thì mình dựng lại lần 2 và ghi thời gian thật. Nhưng rubric chấm 'người khác dựng được', nên cố đừng để trượt." |

---

## Nếu buổi họp bị lệch

| Tình huống | Xử lý |
|---|---|
| Partner không có ý kiến gì | Dùng cột "nếu sao cũng được", chốt luôn, đọc lại 1 lần |
| Hỏi sâu kỹ thuật (TLS, Nginx…) | "Cái này để 18–20/11 mình làm rồi giải thích, hôm nay chốt trước" |
| Hết giờ mà chưa xong khối 4 | Cắt khối 2 (demo app) — quyết định quan trọng hơn demo |
| Partner đến muộn 15 phút | Vẫn kết thúc đúng giờ; dồn khối 5–6 nói nhanh, gửi biên bản qua chat |
| Partner muốn làm hết phần của bạn | Cho họ làm 18/11 (Nginx) dưới giám sát — nhưng 20/11 TLS vẫn do bạn, vì cần cert |
