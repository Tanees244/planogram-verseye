# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Planogram (Next.js, standalone output, npm workspaces monorepo)
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base
# libc6-compat helps some native deps (e.g. onnxruntime / sharp) run on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# 1. Install dependencies (cached unless manifests change)
# ---------------------------------------------------------------------------
FROM base AS deps

# Root manifests
COPY package.json package-lock.json ./
# Workspace manifests (needed so `npm ci` can resolve the workspaces)
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/auth-client/package.json ./packages/auth-client/package.json

RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build the application
# ---------------------------------------------------------------------------
FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY --from=deps /app/node_modules ./node_modules
# Copies the whole app, including .env so NEXT_PUBLIC_* values get inlined at build
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# 3. Production runner (minimal standalone server)
# ---------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder /app/public ./public

# Standalone server + traced node_modules, then static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# .env so the standalone server can read runtime vars (e.g. API_BASE_URL)
COPY --from=builder --chown=nextjs:nodejs /app/.env ./.env

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
