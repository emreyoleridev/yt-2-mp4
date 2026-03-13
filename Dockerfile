# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim

# Install ffmpeg, python3, curl, ca-certificates
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

# Create downloads temp dir
RUN mkdir -p /tmp/downloads

# Render injects PORT at runtime — use ENV default only as fallback
ENV NODE_ENV=production \
    DOWNLOADS_DIR=/tmp/downloads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "src/index.js"]
