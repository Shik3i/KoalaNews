FROM node:26-alpine AS base

RUN apk add --no-cache openssl sqlite

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Prisma-Schema + Config zuerst kopieren (für postinstall prisma generate)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.mjs ./

# Production-Dependencies
# postinstall (prisma generate) + @prisma/engines laufen normal durch
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && \
    rm -rf node_modules/typescript && \
    rm -rf node_modules/next && \
    rm -rf node_modules/@next && \
    rm -rf node_modules/@swc && \
    rm -f node_modules/@prisma/engines/query-engine* && \
    rm -f node_modules/@prisma/engines/libquery_engine* && \
    rm -f node_modules/@prisma/engines/prisma-fmt*

# App-Assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/scripts/init.mjs ./init.mjs
COPY --from=builder /app/scripts/backup.mjs ./backup.mjs

RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/data/koalanews.db"

CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js db push && node init.mjs && node server.js"]
