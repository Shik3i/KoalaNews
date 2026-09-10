# syntax=docker/dockerfile:1

# --- frontend build (SvelteKit adapter-static) ---
FROM node:24-slim AS web
WORKDIR /web
COPY web/ ./
# Build the SvelteKit static output if the project is scaffolded; otherwise the
# committed web/build placeholder is used. Either way build/ exists for go:embed.
RUN if [ -f package.json ]; then npm ci && npm run build; fi && mkdir -p build

# --- go build ---
FROM golang:1.27.0 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Overlay the freshly built frontend so go:embed picks it up.
COPY --from=web /web/build ./web/build
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/koalanews ./cmd/koalanews
# Pre-create the data dir so it can be copied with nonroot ownership below.
RUN mkdir -p /data

# --- runtime: distroless static (no shell, no libc, tiny) ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/koalanews /app/koalanews
COPY --from=build --chown=nonroot:nonroot /data /data
EXPOSE 3000
ENV ADDR=":3000" \
    DATABASE_URL="file:/data/koalanews-v2.db" \
    SYNC_INTERVAL="15m"
VOLUME ["/data"]
USER nonroot:nonroot
ENTRYPOINT ["/app/koalanews"]
