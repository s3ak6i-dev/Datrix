# Production nginx image — frontend baked in, HTTPS via Let's Encrypt.
# Built from the project root: docker build -f nginx/Dockerfile .
#
# Stage 1 compiles the React/Vite frontend.
# Stage 2 copies the compiled assets into nginx:alpine.
# The nginx.conf is mounted at runtime (so it can be updated without rebuilding).

# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Stage 2: nginx ────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
# nginx.conf is always mounted via docker-compose volume (see docker-compose.production.yml)
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
