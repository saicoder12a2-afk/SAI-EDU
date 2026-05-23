FROM node:18-slim

# Install system dependencies (build tools for native modules + Chromium for Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer Chromium Environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

WORKDIR /app

# Copy package files first for caching
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm install --production
RUN cd frontend && npm install

# Copy all project files
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite fallback and auth storage
RUN mkdir -p ./backend/data \
    && mkdir -p ./backend/.wwebjs_auth

WORKDIR /app/backend

EXPOSE 3001

# Seed database (non-fatal if already seeded) and start server
CMD ["sh", "-c", "npm run seed || true && npm start"]
