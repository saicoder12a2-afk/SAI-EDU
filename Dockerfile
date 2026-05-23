FROM node:18-slim

WORKDIR /app

# Install build tools required for native modules like better-sqlite3.
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy entire backend and frontend directories early to ensure all files are available
COPY backend ./backend
COPY frontend ./frontend

# Install backend dependencies
RUN cd backend && npm install --production

# Install frontend dependencies
RUN cd frontend && npm install

# Remove build tools after dependencies are installed to keep the image smaller.
RUN apt-get purge -y --auto-remove python3 make g++ && rm -rf /var/lib/apt/lists/*

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite fallback
RUN mkdir -p ./backend/data

WORKDIR /app/backend

EXPOSE 3001

# Seed database (non-fatal if already seeded) and start server
CMD ["sh", "-c", "npm run seed || true && npm start"]
