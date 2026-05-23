FROM node:18-slim

WORKDIR /app

# Install system dependencies (build tools for native modules like better-sqlite3 + Chromium for Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer Chromium Environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

# Copy entire backend and frontend directories early (identical to original successful copy structure)
COPY backend ./backend
COPY frontend ./frontend

# Install backend dependencies
RUN cd backend && npm install --production

# Install frontend dependencies
RUN cd frontend && npm install

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite fallback and wwebjs session storage
RUN mkdir -p ./backend/data \
    && mkdir -p ./backend/.wwebjs_auth

WORKDIR /app/backend

EXPOSE 3001

# Seed database (non-fatal if already seeded) and start server
CMD ["sh", "-c", "npm run seed || true && npm start"]
