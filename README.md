# TaskApp — Django + React (Render Deployment)

TaskApp is a Django REST API with a React SPA (Vite). The repository is configured to build a single Docker image that serves both the frontend and backend from one service. The recommended hosting is Render (free plan supported).

## Features
- Authentication & Authorization
  - Signup (`/auth/register/`) and Login (`/auth/login/`)
  - Logout (`/signout/`) clears HttpOnly cookies
  - JWT (SimpleJWT) with HttpOnly cookies for access/refresh
  - Background token refresh endpoint (`/auth/refresh/`)
  - Admin site at `/admin/` (Django admin, superuser required)
- Cookies & Security
  - Access/Refresh tokens stored as HttpOnly cookies (no JS access)
  - Production cookie settings: `Secure=True`, `SameSite=None` (HTTPS on Render)
  - CORS configured only when needed (same‑origin by default in container)
- Tasks API & Realtime
  - CRUD Tasks (`/tasks/`, `/tasks/<id>/`)
  - Filtering and search (status, priority, due dates, text)
  - Server‑Sent Events (`/tasks/stream/`) for live updates
- Frontend (React + Vite)
  - Local filtering (instant) over a cached task list
  - React Query caching and deduplication
  - Drag‑and‑drop Kanban columns (Pending / In Progress / Completed)
  - Dashboard with charts (Chart.js) and recent activity
  - Virtualized list (react‑window) when many rows for fast rendering
- Production build & Serving
  - SPA bundled into the backend image and served by Django + WhiteNoise
  - SPA fallback route for non‑API paths
  - Single‑container deployment via `render.yaml`

## Demo Login
- Username: `user`
- Password: `user`
- Where: use on the app's login page (SPA) or POST `/auth/login/`
- Note: demo-only credentials — do not use in production

## Deploy on Render (one container)
1) Push this repo to GitHub/GitLab.
2) In Render, click New → Blueprint and select your repo. Render will detect `render.yaml`.
3) On first deploy, set required environment variables in Render → your service → Environment:
   - `DJANGO_SECRET_KEY` — set a strong secret
   - `DJANGO_SUPERUSER_USERNAME` — default: `Admin` (render.yaml)
   - `DJANGO_SUPERUSER_EMAIL` — default: `Admin@mail.com` (render.yaml)
   - `DJANGO_SUPERUSER_PASSWORD` — set a strong password (not in git)
   - `DJANGO_ALLOWED_HOSTS` — defaults to `.onrender.com` (ok for Render URL)
   - Optional: `DATABASE_URL` — if you attach a Postgres (recommended). Without it, SQLite is ephemeral.
4) Create service. Render builds the Dockerfile and starts the app.

Notes
- The Dockerfile builds the React SPA and copies it into Django. The app listens on `$PORT` provided by Render.
- The container’s CMD includes `python manage.py migrate && python manage.py createsuperuser --noinput || true` so the admin user is auto-created on first boot using the three `DJANGO_SUPERUSER_*` env vars.
- For persistence, add a Render Postgres and supply `DATABASE_URL`. Otherwise, SQLite will reset on redeploys.

## Local Development (optional)
- With Docker:
  - `docker compose up --build`
  - Backend: http://localhost:8000
  - Frontend (Nginx static): http://localhost:5173 (if you use the separate frontend container)
- Or run directly:
  - Backend: create venv, `pip install -r backend/requirements.txt`, `python backend/manage.py runserver`
  - Frontend: `cd frontend && npm install && npm run dev`

## Environment Variables
- `DJANGO_SECRET_KEY` (required in prod)
- `DJANGO_DEBUG` (`false` in prod)
- `DJANGO_ALLOWED_HOSTS` (e.g., `.onrender.com`)
- `DATABASE_URL` (optional; Postgres connection string)
- `CORS_ALLOWED_ORIGINS` (if you serve frontend on a different domain; not needed for same-origin)
- `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD` (auto-create admin on first boot)

## SPA Routing
- Non-API routes fall back to `templates/index.html` (see `backend/myproject/urls.py`). API endpoints keep their paths (e.g., `/auth/login/`, `/tasks/`). Static assets are served under `/static/assets/` by WhiteNoise.

## Troubleshooting
- 401 on login in Render: ensure the admin user exists (auto-create on boot) or register a user via `/auth/register/`.
- "key is not defined" in frontend: all server filter code has been removed; ensure you’re running the latest build and hard-refresh the browser (disable cache in DevTools).
- Build errors in fe-build stage: we intentionally use `npm install` in Docker to reconcile lockfile changes.

---
This repo no longer uses Netlify/Firebase; deployment is via Render using `render.yaml`.
