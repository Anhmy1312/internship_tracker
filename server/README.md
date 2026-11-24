# Internship Tracker — API

Express 5 + PostgreSQL (Neon) API for the Internship Application Tracker.

## Run

    cd server
    npm install
    cp .env.example .env   # dien DATABASE_URL
    npm run dev            # http://127.0.0.1:3000

Production:

    npm start

The API runs at http://127.0.0.1:3000.

## Endpoints

Public:

| Method | Path | Body | Success | Loi |
|---|---|---|---|---|
| GET | /health | — | 200 JSON | — |
| POST | /auth/register | JSON `{email,password,name}` | 201 `{token,user}` | 400, 409 |
| POST | /auth/login | JSON `{email,password}` | 200 `{token,user}` | 401 |

Protected — can header `Authorization: Bearer <token>`:

| Method | Path | Body | Success | Loi |
|---|---|---|---|---|
| GET | /auth/me | — | 200 `{user}` | 401 |
| GET | /applications | — | 200 array | 401, 500 |
| GET | /applications/:id | — | 200 object | 400, 401, 404 |
| POST | /applications | JSON | 201 object | 400, 401 |
| PATCH | /applications/:id | JSON | 200 object | 400, 401, 404 |
| DELETE | /applications/:id | — | 204 | 400, 401, 404 |

- JWT HS256, het han theo `JWT_EXPIRES_IN` (mac dinh 1h).
- `user_id` lay tu token, khong lay tu body/query. Moi query loc `WHERE user_id = $n`.
- Truy cap don cua user khac tra `404` de khong lo don co ton tai.
- Register trung email tra `409`; login sai email hoac sai password deu tra `401 Invalid credentials`.

## Environment

Xem .env.example: DATABASE_URL, PORT (3000), CORS_ORIGIN (http://localhost:5173), API_VERSION, JWT_SECRET, JWT_EXPIRES_IN (1h).

## Scripts

| Lenh | Mo ta |
|---|---|
| npm run dev | node --watch src/index.js |
| npm start | production |
| npm run db:check | kiem ket noi DB |
| npm run db:setup | apply schema |
