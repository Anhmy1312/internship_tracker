# Internship Tracker — Client

React + TypeScript frontend for the Internship Application Tracker.

## Features

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
| Mock API | json-server |

## Structure

```text
client/
├── src/
│   ├── api/applications.ts      # fetch wrapper and CRUD calls
│   ├── components/
│   │   ├── ApplicationForm.tsx  # add-application form
│   │   ├── ApplicationList.tsx  # list and empty state
│   │   ├── ApplicationItem.tsx  # one row: status and delete
│   │   └── Filters.tsx          # status filter and sort controls
│   ├── constants.ts             # status labels
│   ├── types.ts                 # shared types
│   ├── utils/format.ts          # deadline and URL helpers
│   ├── App.tsx                  # state, data loading, handlers
│   └── styles.css
├── .env.example
└── package.json
```

`App.tsx` loads applications once on mount. Create, status, and delete handlers call
`src/api/applications.ts` and update state only after the API succeeds, so a reload
always reflects the server data.

## Requirements

- Node.js 20.19+ or 22.12+
- The mock API running at `http://localhost:3001`

## Run locally

From the repository root, start the API:

```bash
cd server
npm install
npm run api
```

In another terminal, start the client:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build and preview

The dev server does not type-check. Run the production build before pushing:

```bash
cd client
npm run build
npm run preview
```

Open `http://localhost:4173`. This serves the real production bundle; the API must
still be running. If `4173` is already in use, Vite prints the next available port.
The preview reads the same `.env` values as the dev server, so `VITE_API_URL` must
point at a reachable API for the build you are testing.

## Environment

Copy `.env.example` to `.env` if you need a different API URL:

```bash
VITE_API_URL=http://localhost:3001/applications
```

When unset, the client falls back to `http://localhost:3001/applications`.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/applications` | List all applications |
| `POST` | `/applications` | Create an application |
| `PATCH` | `/applications/:id` | Update fields, including `status` |
| `DELETE` | `/applications/:id` | Delete an application |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |
