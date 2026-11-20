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

| Method | Path | Body | Success | Loi |
|---|---|---|---|---|
| GET | /health | — | 200 JSON | — |
| GET | /applications | — | 200 array | 500 |
| GET | /applications/:id | — | 200 object | 400, 404 |
| POST | /applications | JSON | 201 object | 400 |
| PATCH | /applications/:id | JSON | 200 object | 400, 404 |
| DELETE | /applications/:id | — | 204 | 400, 404 |

user_id lay tu DEMO_USER_ID (Week 4 chua co auth). Tat ca query loc user_id truoc.

## Environment

Xem .env.example: DATABASE_URL, PORT (3000), CORS_ORIGIN (http://localhost:5173), API_VERSION, DEMO_USER_ID.

## Scripts

| Lenh | Mo ta |
|---|---|
| npm run dev | node --watch src/index.js |
| npm start | production |
| npm run db:check | kiem ket noi DB |
| npm run db:setup | apply schema |
