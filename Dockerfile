FROM node:18-slim

WORKDIR /app

# Install build tools required for native modules like better-sqlite3.
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Copy and install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Remove build tools after dependencies are installed to keep the image smaller.
RUN apt-get purge -y --auto-remove python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy all source code (cache bust: v3)
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite fallback
RUN mkdir -p /app/backend/data

WORKDIR /app/backend

EXPOSE 3001

# Seed database (non-fatal if already seeded) and start server
CMD ["sh", "-c", "npm run seed || true && npm start"]
