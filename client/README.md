# Internship Tracker — Client

React + TypeScript frontend for the Internship Application Tracker.

- **API:** Express 5 + PostgreSQL at `http://localhost:3000`.
- **Requirements:** Node 20.19+/22.12+.
- **Run locally:** API `cd server && npm run dev`; client `cd client && npm run dev`; open `http://localhost:5173`.
- **Environment:** `VITE_API_URL=http://localhost:3000/applications` (default in code).

## Features

- Register and sign in with JWT; the session persists in `localStorage` under `it_token`
- Add applications, update their status, and delete them through a REST API
- Filter by status and sort by deadline or company
- Loading, error, and empty states
- Accessible announcements for loading (`role="status"`) and errors (`role="alert"`)
- Responsive layout that stacks cleanly on mobile

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 |
| Language | TypeScript |
| Build tool | Vite 8 |
| Linting | Oxlint |
| API | Express 5 + PostgreSQL |

## Structure

```text
client/
├── src/
│   ├── api/
│   │   ├── client.ts            # shared fetch wrapper, API_BASE, ApiError
│   │   ├── applications.ts      # CRUD calls
│   │   └── auth.ts              # register, login, me
│   ├── auth/token.ts            # it_token storage
│   ├── components/
│   │   ├── ApplicationForm.tsx  # add-application form
│   │   ├── ApplicationList.tsx  # list and empty state
│   │   ├── ApplicationItem.tsx  # one row: status and delete
│   │   ├── Filters.tsx          # status filter and sort controls
│   │   └── LoginPage.tsx        # login/register form
│   ├── constants.ts             # status labels
│   ├── types.ts                 # shared types
│   ├── utils/format.ts          # deadline and URL helpers
│   ├── App.tsx                  # state, auth gate, data loading, handlers
│   └── styles.css
├── .env.example
└── package.json
```

`App.tsx` checks the stored token on mount, then loads applications once the user
is authenticated. Create, status, and delete handlers call `src/api/applications.ts`
and update state only after the API succeeds, so a reload always reflects the
server data.

## Requirements

- Node.js 20.19+ or 22.12+
- The Express API running at `http://localhost:3000`

## Run locally

From the repository root, start the API:

```bash
cd server
npm install
npm run dev
```

In another terminal, start the client:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment

Copy `.env.example` to `.env` if you need a different API URL:

```bash
VITE_API_URL=http://localhost:3000/applications
```

When unset, the client falls back to `http://localhost:3000/applications`.

## Auth

The app requires a signed-in user.

- `LoginPage.tsx` calls `POST /auth/login` or `POST /auth/register`.
- On success the JWT is stored in `localStorage` under `it_token`.
- `api/client.ts` reads the token per request and sends
  `Authorization: Bearer <token>`.
- On mount, `App.tsx` calls `GET /auth/me` when a token exists. A `401` clears the
  token and returns to the login page.
- Sign out removes `it_token` and clears the application list.

## Build and preview

The dev server does not type-check. Run the production build before pushing:

```bash
cd client
npm run build
npm run preview
```

Open `http://localhost:4173`. This serves the real production bundle; the API must
still be running. `VITE_API_URL` is baked into the bundle at build time, so rebuild
after changing `.env` or the client will keep calling the old API URL.
