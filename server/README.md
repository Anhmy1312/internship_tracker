# Internship Tracker — API

Express API for the Internship Application Tracker.

The old `json-server` mock is still available on port `3001` while the Express
API is being built. Week 4 replaces it with Express + PostgreSQL.

## Run

```bash
cd server
npm install
npm run dev
```

The Express API runs at:

```text
http://127.0.0.1:3000
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

```json
{ "status": "ok", "uptime": 1, "version": "0.1.0" }
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Express with file watching |
| `npm start` | Start Express for deployment |
| `npm run api` | Start the legacy json-server mock on port 3001 |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `API_VERSION` | `0.1.0` | Value returned by `/health` |

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check, no database dependency |

CRUD endpoints for `/applications` and PostgreSQL will be added next.
