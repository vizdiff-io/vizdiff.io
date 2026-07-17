#!/bin/sh
# Sanity-checks the root .env used by the docker-compose stacks. Universal keys are always
# required; GITHUB_* keys are required only when GitHub mode is enabled; OIDC_* keys only when
# the oidc auth provider is selected. See docs/CONFIGURATION.md for the full reference.
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

# Always required.
required_keys="APP_URL JWT_SECRET S3_BUCKET_NAME"

auth_provider="$(get_env AUTH_PROVIDER)"
github_enabled="$(get_env GITHUB_ENABLED)"

# GitHub App credentials are only needed when GitHub mode (or GitHub login) is enabled.
if [ "$github_enabled" = "true" ] || [ "$auth_provider" = "github" ]; then
  required_keys="$required_keys GITHUB_APP_ID GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_PRIVATE_KEY GITHUB_WEBHOOK_SECRET"
fi

# OIDC settings are only needed for the oidc auth provider.
if [ "$auth_provider" = "oidc" ]; then
  required_keys="$required_keys OIDC_ISSUER OIDC_CLIENT_ID"
fi

for key in $required_keys; do
  value="$(get_env "$key")"
  if [ -z "$value" ]; then
    missing="$missing $key"
  elif is_placeholder "$value"; then
    placeholders="$placeholders $key"
  fi
done

# GitLab integration is configured via per-host service tokens. Warn (don't fail) when neither
# VCS integration is configured, since a status-posting deployment needs at least one.
if [ "$github_enabled" != "true" ] && [ -z "$(get_env GITLAB_HOSTS)" ] && [ -z "$(get_env GITLAB_TOKEN)" ]; then
  echo "Note: neither GITLAB_HOSTS/GITLAB_TOKEN nor GITHUB_ENABLED=true is set;"
  echo "configure at least one VCS integration to post commit statuses."
fi

if [ -n "$missing" ]; then
  echo "Missing required env keys:$missing"
  exit 1
fi

if [ -n "$placeholders" ]; then
  echo "Placeholder values detected:$placeholders"
  echo "Update these values before production use."
fi

echo "Environment validation passed."
