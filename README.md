# Task Manager (React + Django)

Collaborative task management app with JWT auth (HttpOnly cookies), real‑time updates via SSE, Kanban drag‑and‑drop, and a dashboard.

## Stack

- Backend: Django, Django REST Framework, SimpleJWT, CORS Headers
- Frontend: React (Vite), React Router, Axios, Bootstrap, Chart.js

## Quick Start

### Backend

1) Create and activate a virtualenv

```
cd backend
python -m venv venv
venv\Scripts\activate
```

2) Install requirements

```
pip install -r requirements.txt
```

3) Migrate and run

```
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://127.0.0.1:8000/`.

### Frontend

```
cd frontend
npm ci   # or: npm install
npm run dev
```

Frontend runs at `http://localhost:5173/`.

## Auth Model

- JWT access and refresh tokens are set as HttpOnly cookies on login/register.
- A lightweight middleware maps the `access` cookie to an `Authorization: Bearer` header for DRF.
- `POST /auth/refresh/` refreshes the access token using the `refresh` cookie.

Dev cookie notes:
- For localhost dev (same site), cookies use `SameSite=Lax; Secure=False`.
- If you serve FE/BE on different origins or HTTPS, set `SameSite=None; Secure=True` and ensure CORS is configured.

## Endpoints

- Auth
  - `POST /auth/register/` → create user, set cookies
  - `POST /auth/login/` → login, set cookies
  - `POST /auth/refresh/` → refresh access cookie
  - `POST /signout/` → clear cookies
  - `GET /user/me/` → current user profile

- Tasks
  - `GET /tasks/` → list (admins: all, users: own) with filters: `status`, `priority`, `due_before`, `due_after`, `search`
  - `POST /tasks/` → create (owner = current user)
  - `GET /tasks/{id}/`, `PUT /tasks/{id}/`, `DELETE /tasks/{id}/`
  - `GET /tasks/stream/` → Server‑Sent Events (SSE) live updates

## Frontend Features

- Auth: Sign up, Sign in, redirect if unauthenticated
- Tasks: Table + filters, overdue highlighting, CRUD
- Kanban: Drag cards across Pending/In‑Progress/Completed to update status
- Dashboard: Status bar chart + Due doughnut chart (Chart.js)
- Real‑time: Auto refresh Tasks/Dashboard on SSE updates

## Configuration

- CORS (backend/myproject/settings.py):
  - `CORS_ALLOW_CREDENTIALS = True`
  - Add your frontend origin(s) to `CORS_ALLOWED_ORIGINS` (e.g., `http://localhost:5173`)
- Cookies:
  - Adjust `_set_auth_cookies` in `backend/myapp/views.py` for `SameSite`/`Secure` based on environment

## Optional (Pin Dependencies)

We include `backend/requirements.in` with minimal deps. To produce a fully pinned `requirements.txt` using pip‑tools:

```
pip install pip-tools
pip-compile backend/requirements.in -o backend/requirements.txt
```

## Production Notes

- Use a production WSGI/ASGI server (e.g., Gunicorn/Daphne + reverse proxy)
- Serve over HTTPS and set cookies to `SameSite=None; Secure=True`
- Harden CORS to exact origins
- Consider Redis + Django Channels for WebSockets (if needed)

