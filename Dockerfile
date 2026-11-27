# syntax=docker/dockerfile:1
# Compatible multi-arquitectura: linux/amd64, linux/arm64 y linux/arm/v7 (armhf 32 bits)

# 1) Dependencias SOLO de producción (JS puro, sin compiladores nativos)
FROM node:22-bookworm-slim AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Compilación del frontend (recomendado en servidores x64/arm64 con >= 2 GB RAM libre)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY server ./server
RUN npm run build

# 3) Imagen base de ejecución compartida
FROM node:22-bookworm-slim AS runtime-base
WORKDIR /app

ENV NODE_ENV=production \
    LIAA_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=512

COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
COPY public ./public

RUN mkdir -p /app/server/data /app/public/images/uploads \
    && chown -R node:node /app

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/content').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.mjs"]

# Target por defecto ("runner"): compila dist/ dentro de Docker (x64 / arm64)
FROM runtime-base AS runner
COPY --from=builder --chown=node:node /app/dist ./dist

# Target ligero ("prebuilt"): usa dist/ precompilado en PC (ideal para Tinker Board S armhf 32 bits / 2 GB RAM)
FROM runtime-base AS prebuilt
COPY --chown=node:node dist ./dist
