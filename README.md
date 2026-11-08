# Internship Application Tracker

A simple app for IT students to track internship applications in one place.

## Live demo

[View the app](https://anhmy1312.github.io/internship_tracker/)

> The public demo is served from `main`, which still uses localStorage.
> This branch (`week-2-api`) reads and writes data through a local REST API.

## Features

- Add, update status, and delete applications
- Filter by status
- Sort by deadline or company
- Loading, error, and empty states
- Data loaded from a REST API
- Responsive layout

## Tech stack

HTML, CSS, JavaScript, REST API, json-server

## Run locally

Requirements: Node.js and Python (or VS Code Live Server).

1. Clone the repo and checkout this branch:

   ```bash
   git clone https://github.com/Anhmy1312/internship_tracker.git
   cd internship_tracker
   git checkout week-2-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the mock API:

   ```bash
   npm run api
   ```

   The API runs at `http://localhost:3001/applications`.

4. Serve the frontend in a second terminal:

   ```bash
   python -m http.server 5500
   ```

   Or open `index.html` with VS Code Live Server.

5. Open `http://localhost:5500`.

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/applications` | List all applications |
| `POST` | `/applications` | Create an application |
| `PATCH` | `/applications/:id` | Update part of an application |
| `DELETE` | `/applications/:id` | Delete an application |

Mock data lives in `db.json`. The frontend keeps all HTTP logic in `api.js`.

## What I learned

### Week 1 — localStorage

- DOM manipulation and event handling
- localStorage persistence
- Form validation
- Responsive layout

### Week 2 — REST API

- HTTP methods and status codes
- `fetch`, `async/await`, `try/catch`
- Loading, error, and empty states
- Separating API logic into `api.js`

## Next steps

- Rebuild the UI with React + TypeScript
- Replace json-server with an Express + PostgreSQL API
- Add authentication
- Add AI-powered JD parsing
