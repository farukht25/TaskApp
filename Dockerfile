FROM node:20-alpine AS fe-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
# Use npm install to reconcile lockfile differences in container
RUN npm install --no-audit --no-fund
COPY frontend/ .

# Build SPA with same-origin API
ENV VITE_API_BASE=/
RUN npm run build

# Adjust asset paths in index.html to be served under /static/assets by Django/WhiteNoise
RUN sed -i 's|/assets/|/static/assets/|g' dist/index.html

FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install backend deps
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY backend/ /app/

# Copy SPA artifacts into Django
RUN mkdir -p /app/templates /app/static/assets
COPY --from=fe-build /app/frontend/dist/index.html /app/templates/index.html
COPY --from=fe-build /app/frontend/dist/assets /app/static/assets

# Collect static so WhiteNoise can serve them efficiently in production
RUN python manage.py collectstatic --noinput

# Start the app (Render/Cloud Run set $PORT). Run migrations before Gunicorn.
CMD ["sh", "-c", "python manage.py migrate && python manage.py createsuperuser --noinput || true && gunicorn myproject.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
