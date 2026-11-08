# Internship Tracker — API

Local mock API powered by `json-server`. Week 4 replaces this with Express + PostgreSQL.

## Run

```bash
cd server
npm install
npm run api
```

The API runs at:

```text
http://localhost:3001/applications
```

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/applications` | List all applications |
| `POST` | `/applications` | Create an application |
| `PATCH` | `/applications/:id` | Update part of an application |
| `DELETE` | `/applications/:id` | Delete an application |

Data is stored in `db.json`.
