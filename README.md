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

2) Configure environment

Copy the example env and set a strong secret key:

```
copy backend\.env.example backend\.env
# then edit backend\.env and set DJANGO_SECRET_KEY
```

3) Install requirements

```
pip install -r requirements.txt
```

4) Migrate and run

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

Set the API base for production builds:

```
# frontend/.env
VITE_API_BASE=https://your-backend.example.com/
```

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

## Deploy (Render + Netlify)

Backend (Render):
- Create a new Web Service from the `backend` folder.
- Environment: Python 3.x
- Build command:
  - `pip install -r backend/requirements.txt && python backend/manage.py collectstatic --noinput && python backend/manage.py migrate`
- Start command:
  - `cd backend && gunicorn myproject.wsgi --workers=2 --timeout=120 --log-file -`
- Env vars:
  - `DJANGO_SECRET_KEY`=your-long-random
  - `DJANGO_DEBUG`=false
  - `DJANGO_ALLOWED_HOSTS`=<your_render_hostname>
  - `CORS_ALLOWED_ORIGINS`=https://your-frontend-domain

Frontend (Netlify/Vercel):
- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Env var:
  - `VITE_API_BASE`=https://your-backend-domain/

Cookie tips:
- In production, the backend sets secure cookies if you set `DJANGO_DEBUG=false`. Ensure you are on HTTPS and that the frontend origin is listed in `CORS_ALLOWED_ORIGINS`.
