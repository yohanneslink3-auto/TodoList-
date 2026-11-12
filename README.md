# Taskflow

## Requirements

- Node.js 20+ and npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection URI

## Configure MongoDB

From the project folder, copy the example environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Set a private random `JWT_SECRET` in `backend\.env` (at least 32 characters). Generate one with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the printed value into `JWT_SECRET`. Never commit `backend\.env`.

If MongoDB is not running locally, update `MONGODB_URI` in `backend\.env` with your MongoDB Atlas connection URI.

## Run the application

Open two terminals in the project folder.

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`). Register an account to open your private dashboard.

## Features

- Account registration, login, logout, and session restoration with bcrypt-hashed passwords, 15-minute HTTP-only access cookies, and rotating 7-day refresh sessions.
- User-scoped task CRUD, categories CRUD, due dates, priorities, statuses, and in-app reminders.
- Task search, status/priority/category/date filters, sorting, and server-side pagination.
- Dashboard statistics, reminder/due notifications, and persistent light/dark mode.
- Request validation, ownership checks, centralized JSON errors, security headers, and rate-limited authentication endpoints.
- Interactive API documentation at `http://localhost:5000/api/docs` and its OpenAPI JSON at `/api/docs/openapi.json`.
- MongoDB-backed reminder jobs with atomic worker claims, retry backoff, and recovery after backend restarts.

Tasks and categories always belong to the signed-in user. The reminder scheduler runs in the backend and creates in-app notifications for due reminders and overdue due dates.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/:id`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
- `GET /api/tasks/statistics`
- `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/:id`
- `GET /api/health`

Run backend API and validation tests with `cd backend; npm test`. Run database-backed integration coverage with `npm run test:integration` from `backend` while MongoDB is available.

## Architecture

- `backend/src/config` contains environment validation and database connection setup.
- `backend/src/features` groups API routes and business logic by feature.
- `backend/src/middleware` contains shared request and error handling.
- `backend/src/app.js` configures the Express application; `server.js` connects infrastructure and starts it.
- `frontend/src/app` contains the application shell, while `features` contains feature-specific UI and logic.
- `frontend/src/app/services` contains the shared RTK Query API layer; feature folders own their UI.

For the full data model, API contract, functional workflows, authentication details, and production gaps, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
