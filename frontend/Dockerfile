FROM node:20-alpine AS build
WORKDIR /app

# Set build-time API base if desired (optional)
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

COPY package*.json ./
# Use npm install to allow lockfile updates inside the container
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Use a lightweight runtime image to serve built files via Vite preview
FROM nginx:alpine AS runtime

# Copy built static files to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Prepare shared log directory expected by nginx.conf
RUN mkdir -p /logs/frontend \
    && touch /logs/frontend/access.log /logs/frontend/error.log \
    && chown -R nginx:nginx /logs

# Custom nginx config for SPA routing (fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
