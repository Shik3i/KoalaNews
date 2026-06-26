#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE="koalanews-website:test"
CONTAINER="koalanews-integration-test"
PORT="9876"
DATA_DIR="/tmp/koalanews-integration-data"

echo "=== Integration Tests ==="

# Cleanup on exit
cleanup() {
  echo "Cleaning up..."
  docker rm -f "$CONTAINER" 2>/dev/null || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

# Build image if not present
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building Docker image..."
  docker build -t "$IMAGE" .
fi

# Prepare fresh data directory
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

# Start container
echo "Starting container..."
docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:3000" \
  -e NEXTAUTH_SECRET="integration-test-secret" \
  -e NEXTAUTH_URL="http://localhost:$PORT" \
  -e ALLOW_REGISTRATION="true" \
  -e ADMIN_EMAIL="admin@test.local" \
  -e ADMIN_PASSWORD="admin123" \
  -v "$DATA_DIR:/data" \
  "$IMAGE"

# Wait for server to be ready
echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT/api/statistics" >/dev/null 2>&1; then
    echo "Server ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Server failed to start"
    docker logs "$CONTAINER"
    exit 1
  fi
  sleep 1
done

# --- Test 1: Public statistics ---
echo "Test 1: GET /api/statistics"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/statistics")
if [ "$STATUS" != "200" ]; then
  echo "FAIL: Expected 200, got $STATUS"
  exit 1
fi
echo "  PASS"

# --- Test 2: Register user ---
echo "Test 2: POST /api/auth/register"
REGISTER_RESP=$(curl -s -X POST "http://localhost:$PORT/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.local","password":"test123","name":"Tester"}')
echo "  $REGISTER_RESP"
STATUS=$(echo "$REGISTER_RESP" | grep -c '"ok":true' || true)
if [ "$STATUS" -eq 0 ]; then
  echo "FAIL: Registration failed"
  exit 1
fi
echo "  PASS"

# --- Test 3: Login (JWT token) ---
echo "Test 3: POST /api/auth/token"
TOKEN_RESP=$(curl -s -X POST "http://localhost:$PORT/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.local","password":"test123"}')
TOKEN=$(echo "$TOKEN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "FAIL: No token received"
  echo "  $TOKEN_RESP"
  exit 1
fi
echo "  Token received: ${TOKEN:0:20}..."

# --- Test 4: Access feeds with JWT ---
echo "Test 4: GET /api/feeds (with JWT)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/feeds" \
  -H "Authorization: Bearer $TOKEN")
if [ "$STATUS" != "200" ]; then
  echo "FAIL: Expected 200, got $STATUS"
  exit 1
fi
echo "  PASS"

# --- Test 5: Access feeds without JWT (should fail) ---
echo "Test 5: GET /api/feeds (without JWT)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/feeds")
if [ "$STATUS" != "401" ]; then
  echo "FAIL: Expected 401, got $STATUS"
  exit 1
fi
echo "  PASS"

# --- Test 6: Invalid token ---
echo "Test 6: GET /api/feeds (invalid JWT)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/feeds" \
  -H "Authorization: Bearer invalid-token")
if [ "$STATUS" != "401" ]; then
  echo "FAIL: Expected 401, got $STATUS"
  exit 1
fi
echo "  PASS"

# --- Test 7: Admin login ---
echo "Test 7: POST /api/auth/token (admin)"
ADMIN_RESP=$(curl -s -X POST "http://localhost:$PORT/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then
  echo "FAIL: Admin login failed"
  echo "  $ADMIN_RESP"
  exit 1
fi
echo "  PASS"

# --- Test 8: Admin: list users ---
echo "Test 8: GET /api/admin/users"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" != "200" ]; then
  echo "FAIL: Expected 200, got $STATUS"
  exit 1
fi
echo "  PASS"

# --- Test 9: Non-admin cannot access admin API ---
echo "Test 9: GET /api/admin/users (user token)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/admin/users" \
  -H "Authorization: Bearer $TOKEN")
if [ "$STATUS" != "403" ]; then
  echo "FAIL: Expected 403, got $STATUS"
  exit 1
fi
echo "  PASS"

echo ""
echo "=== All integration tests PASSED ==="
