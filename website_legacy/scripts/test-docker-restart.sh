#!/bin/bash
set -euo pipefail

IMAGE="koalanews-website:test"
run_test() {
  local name="$1" volume="$2"
  local cid="koalanews-test-$$"

  echo "--- Test: $name ---"
  docker run -d --name "$cid" -v "$volume:/data" \
    -e DATABASE_URL="file:/data/koalanews.db" "$IMAGE" >/dev/null

  sleep 8

  local status exit_code
  status=$(docker inspect "$cid" --format='{{.State.Status}}')
  exit_code=$(docker inspect "$cid" --format='{{.State.ExitCode}}')

  if [ "$status" = "running" ]; then
    echo "  PASS: Container running"
    docker stop "$cid" >/dev/null
    docker rm "$cid" >/dev/null
    return 0
  elif [ "$status" = "exited" ] && [ "$exit_code" = "0" ]; then
    echo "  PASS: Container exited cleanly"
    docker rm "$cid" >/dev/null
    return 0
  else
    echo "  FAIL: Container crashed (exit $exit_code)"
    docker logs "$cid" 2>&1 | tail -10
    docker rm "$cid" >/dev/null
    return 1
  fi
}

cleanup() {
  docker volume rm -f koalanews-test-fresh koalanews-test-restart 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Building image ==="
docker build -t "$IMAGE" .

# Fresh start: empty volume, no existing DB
cleanup
docker volume create koalanews-test-fresh >/dev/null
run_test "Fresh start (empty volume)" koalanews-test-fresh

# Restart: volume with pre-existing DB + .initialized
docker run --rm -v koalanews-test-restart:/data alpine \
  sh -c "touch /data/.initialized /data/koalanews.db" >/dev/null
run_test "Restart (existing DB + .initialized)" koalanews-test-restart

echo "=== All tests passed ==="
