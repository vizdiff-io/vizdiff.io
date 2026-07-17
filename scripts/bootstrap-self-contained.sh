#!/bin/sh
# Bootstraps a self-hosted VizDiff on this machine with Docker Compose: creates .env from the
# template if needed, validates it, starts the stack, and waits for the api health check.
#
# Builds from source (docker-compose.yml) by default. To run the published GHCR images instead:
#   COMPOSE_FILE=docker-compose.images.yml [VIZDIFF_VERSION=X.Y.Z] ./scripts/bootstrap-self-contained.sh
# See docs/self-contained-install.md.
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

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

echo "Starting services with docker compose ($COMPOSE_FILE)..."
if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
  docker compose -f "$ROOT_DIR/$COMPOSE_FILE" up -d --build
else
  docker compose -f "$ROOT_DIR/$COMPOSE_FILE" up -d
fi

if command -v curl >/dev/null 2>&1; then
  echo "Waiting for the api to become healthy (GET /api/health)..."
  attempts=0
  until curl -s -f http://localhost:3001/api/health >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "API health check failed after ${attempts} attempts."
      echo "Inspect the logs with: docker compose -f $COMPOSE_FILE logs -f api"
      exit 1
    fi
    sleep 2
  done
  echo "API is healthy."
  echo "Version info:"
  curl -s http://localhost:3001/api/version || true
  echo
fi

echo "Bootstrap complete."
