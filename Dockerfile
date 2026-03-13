# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim

# Install system dependencies: ffmpeg, python3, pip, curl, git, ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp via pip into a venv (avoids externally-managed-environment error)
RUN python3 -m venv /opt/yt-dlp-env && \
    /opt/yt-dlp-env/bin/pip install --no-cache-dir -U yt-dlp && \
    ln -s /opt/yt-dlp-env/bin/yt-dlp /usr/local/bin/yt-dlp && \
    yt-dlp --version

# Install bgutil-ytdlp-pot-provider plugin (PO Token provider - fixes bot detection)
RUN /opt/yt-dlp-env/bin/pip install --no-cache-dir bgutil-ytdlp-pot-provider

# Clone and build the bgutil POT HTTP server
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-pot && \
    cd /opt/bgutil-pot/server && \
    npm ci --omit=dev && \
    npx tsc

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start both the POT server (background) and the main API
CMD ["sh", "-c", "node /opt/bgutil-pot/server/build/main.js &  node src/index.js"]
