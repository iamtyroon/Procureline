FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL -o /usr/local/bin/cloudflared \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    && chmod +x /usr/local/bin/cloudflared \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/webapp

COPY webapp/package.json webapp/package-lock.json ./
COPY webapp/patches ./patches
RUN npm ci

COPY docker/tunnel-register/register-tunnel.js /opt/procureline/register-tunnel.js
