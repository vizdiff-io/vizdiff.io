#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    echo "Created $ENV_FILE from .env.example"
  else
    echo "Missing .env.example. Create $ENV_FILE manually."
    exit 1
  fi
fi

if [ -x "$ROOT_DIR/scripts/validate-env.sh" ]; then
  "$ROOT_DIR/scripts/validate-env.sh"
fi

echo "Starting services with docker compose..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --build

if command -v curl >/dev/null 2>&1; then
  SETUP_TOKEN=$(grep -E "^SETUP_TOKEN=" "$ENV_FILE" | head -n 1 | cut -d= -f2- || true)
  TOKEN_HEADER=""
  if [ -n "$SETUP_TOKEN" ]; then
    TOKEN_HEADER="-H x-setup-token:$SETUP_TOKEN"
  fi
  echo "Checking API health..."
  curl -s -f http://localhost:3001/api/health >/dev/null || echo "API health check failed"
  echo "Checking setup status..."
  curl -s -f $TOKEN_HEADER http://localhost:3001/api/setup/status >/dev/null || \
    echo "Setup status check failed"
fi

echo "Bootstrap complete."
