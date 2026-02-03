#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

get_env() {
  key="$1"
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- || true)"
  echo "$value"
}

is_placeholder() {
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  echo "$value" | grep -qE "your_|change-me|example" && return 0 || return 1
}

missing=""
placeholders=""

required_keys="APP_URL S3_BUCKET_NAME GITHUB_APP_ID GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_PRIVATE_KEY GITHUB_WEBHOOK_SECRET"

for key in $required_keys; do
  value="$(get_env "$key")"
  if [ -z "$value" ]; then
    missing="$missing $key"
  elif is_placeholder "$value"; then
    placeholders="$placeholders $key"
  fi
done

if [ -n "$missing" ]; then
  echo "Missing required env keys:$missing"
  exit 1
fi

if [ -n "$placeholders" ]; then
  echo "Placeholder values detected:$placeholders"
  echo "Update these values before production use."
fi

echo "Environment validation passed."
