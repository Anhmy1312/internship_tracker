# Internship Tracker — Client

React + TypeScript frontend for the Internship Application Tracker.

## Requirements

- Node.js 20.19+ or 22.12+
- The mock API running at `http://localhost:3001`

## Run locally

From the repository root, start the API:

```bash
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

## Environment

Copy `.env.example` to `.env` if you need a different API URL:

```bash
VITE_API_URL=http://localhost:3001/applications
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |
