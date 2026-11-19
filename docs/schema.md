- Quan hệ: `users 1 ─── n applications`.
- `users`: `id`, `email` (unique), `password_hash`, `name`, `created_at`.
- `applications`: `id`, `user_id` (FK, cascade), `company`, `role`, `jd_url`, `location`, `remote`, `deadline`, `status`, `notes`, `created_at`, `updated_at`.
- Status: `wishlist`, `applied`, `interview`, `offer`, `rejected`.
- Index: `(user_id, deadline)`, `(user_id, status)`, `(user_id, created_at)` — vì mọi query đều lọc `user_id` trước.
- `BIGSERIAL` cho id; `pg` trả `BIGINT` dạng string, khớp `Application.id: string`.
- `deadline` là `DATE`, select bằng `deadline::text` để tránh lệch timezone.
- Week 4 chưa có auth, `user_id` lấy từ `DEMO_USER_ID`.


- kiểu dữ liệu trong database và kiểu trong API không nhất thiết giống nhau. toApi chính là chỗ chuyển đổi (jd_url → jdUrl, null → "")