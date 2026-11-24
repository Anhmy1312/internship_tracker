# Schema — Internship Application Tracker

## 1. Quan hệ

users 1 ─── n applications

Một user có nhiều đơn. Xoá user → xoá toàn bộ đơn của user đó (ON DELETE CASCADE).

## 2. Bảng users

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGSERIAL | PK |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

## 3. Bảng applications

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | BIGINT | NOT NULL, FK users(id) ON DELETE CASCADE |
| company | TEXT | NOT NULL, CHECK length 1..200 |
| role | TEXT | NOT NULL, CHECK length 1..200 |
| jd_url | TEXT | NOT NULL, DEFAULT '' |
| location | TEXT | NOT NULL, DEFAULT '' |
| remote | BOOLEAN | NOT NULL, DEFAULT false |
| deadline | DATE | NULL được |
| status | TEXT | NOT NULL, DEFAULT 'wishlist', CHECK 1 trong 5 giá trị |
| notes | TEXT | NOT NULL, DEFAULT '' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() — app tự set khi PATCH |

## 4. Index

- (user_id, deadline)
- (user_id, status)
- (user_id, created_at)

Cả ba đều bắt đầu bằng user_id vì mọi query của API đều lọc `WHERE user_id = $1` trước.

## 5. Quy ước API

- BIGINT → `pg` trả string, khớp `Application.id: string`
- DATE → select `deadline::text` để tránh lệch timezone
- NULL → `toApi` đổi thành `""` cho `deadline`
- Từ Week 5, `user_id` lấy từ JWT (`Authorization: Bearer`), không lấy từ body/query
- Mọi query lọc `WHERE user_id = $n`; đơn của user khác trả `404`

## 6. Năm query
```sql
-- 1. Danh sách theo deadline
SELECT id, company, role, deadline, status
FROM applications
WHERE user_id = $1
ORDER BY deadline ASC NULLS LAST;

-- 2. Đếm theo status
SELECT status, count(*)::int AS total
FROM applications
WHERE user_id = $1
GROUP BY status
ORDER BY total DESC;

-- 3. Deadline trong 7 ngày tới
SELECT id, company, role, deadline
FROM applications
WHERE user_id = $1
  AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY deadline ASC;

-- 4. Tỷ lệ phản hồi
SELECT
  count(*) FILTER (WHERE status IN ('interview', 'offer'))::int AS responded,
  count(*)::int AS total,
  round(
    100.0 * count(*) FILTER (WHERE status IN ('interview', 'offer'))
    / NULLIF(count(*), 0), 1
  ) AS response_rate
FROM applications
WHERE user_id = $1;

-- 5. Tìm theo company/role
SELECT id, company, role, status, deadline
FROM applications
WHERE user_id = $1
  AND (company ILIKE '%' || $2 || '%' OR role ILIKE '%' || $2 || '%')
ORDER BY deadline ASC NULLS LAST;
```
...