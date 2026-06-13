FROM node:26-slim AS base
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl sqlite3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- builder ---
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build
# Generate SQL schema for DB init at runtime
RUN npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/schema.sql

# --- runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Prisma schema + migrations + init SQL
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.mjs ./
COPY --from=builder /tmp/schema.sql ./

# Next.js standalone output (includes traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Overlay root-scope node_modules for packages marked serverExternalPackages
# Prisma with libsql adapter
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/@prisma/adapter-libsql ./node_modules/@prisma/adapter-libsql
COPY --from=builder /app/node_modules/@prisma/driver-adapter-utils ./node_modules/@prisma/driver-adapter-utils
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/@neon-rs ./node_modules/@neon-rs
COPY --from=builder /app/node_modules/js-base64 ./node_modules/js-base64
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/tslib ./node_modules/tslib
COPY --from=builder /app/node_modules/async-mutex ./node_modules/async-mutex
COPY --from=builder /app/node_modules/promise-limit ./node_modules/promise-limit
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql

# Static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Scripts
COPY --from=builder /app/scripts/init.mjs ./init.mjs
COPY --from=builder /app/scripts/backup.mjs ./backup.mjs

# Script dependencies (not traced by Next.js standalone)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/data/koalanews.db"

CMD ["sh", "-c", "if ! sqlite3 /data/koalanews.db \"SELECT count(*) FROM sqlite_master WHERE type='table'\" 2>/dev/null | grep -q '^[1-9]'; then sqlite3 /data/koalanews.db < /app/schema.sql 2>/dev/null || true; fi && node /app/init.mjs && node /app/server.js"]
