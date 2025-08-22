# ---------- build React ----------
FROM node:18-alpine AS build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ---------- final Django ----------
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential libpq-dev netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Django backend
COPY backend/ .

# Copy React build into Django
RUN mkdir -p /app/react_static
COPY --from=build /frontend/dist/ /app/react_static/

# Collect static + migrate at container startup (from docker-compose.yml)
# -> no need to embed in entrypoint

EXPOSE 8000

CMD ["gunicorn", "api.wsgi:application", "-b", "0.0.0.0:8000", "--workers", "3"]
  