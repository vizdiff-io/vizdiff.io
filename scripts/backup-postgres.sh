#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

POSTGRES_USER="$(grep -E "^POSTGRES_USER=" "$ENV_FILE" | cut -d= -f2-)"
POSTGRES_DATABASE="$(grep -E "^POSTGRES_DATABASE=" "$ENV_FILE" | cut -d= -f2-)"

OUTPUT="${1:-backup.sql}"

docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DATABASE" > "$OUTPUT"

echo "Backup written to $OUTPUT"
