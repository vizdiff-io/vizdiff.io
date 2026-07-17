# Self-Hosted Installation (Docker Compose)

This is the canonical guide for running VizDiff on a single host with Docker Compose. For
Kubernetes, use the Helm chart instead (see [`deploy/`](../deploy/)). For the full environment
variable reference, see [CONFIGURATION.md](CONFIGURATION.md).

## Architecture

Four containers on one Docker network:

- `frontend`: static Next.js export served by nginx; proxies `/api` to the api container
- `api`: Express backend on port 3001 (sole database schema owner; runs migrations on boot)
- `worker`: background screenshot processor with Chromium/ChromeDriver
- `postgres`: database and task queue (LISTEN/NOTIFY)

External requirements:

- An S3-compatible bucket for Storybook tarballs and screenshots (AWS S3, MinIO, etc.)
- A GitLab service token per host (`GITLAB_HOSTS`), and/or a GitHub App (`GITHUB_ENABLED=true`)
- An OIDC identity provider for login (`AUTH_PROVIDER=oidc`, the production default), unless you
  use GitHub login (`AUTH_PROVIDER=github`) or the non-production `dev` provider

## Prerequisites

- A host with Docker and Docker Compose v2 installed (v2.24+ if you use the TLS overlay)
- An S3 bucket (or S3-compatible endpoint) and credentials that can read/write it
- For HTTPS: a public DNS name pointing at this host, with ports 80 and 443 reachable

## Setup Steps

1. Copy the environment template and fill it in:

   ```sh
   cp .env.example .env
   ```

   At minimum, set:

   - `APP_URL` — the public URL of the deployment (e.g. `https://vizdiff.example.com`)
   - `JWT_SECRET` — a unique random value (e.g. `openssl rand -hex 32`)
   - `POSTGRES_PASS` — the Postgres password
   - `S3_BUCKET_NAME` + AWS credentials/region (or `S3_ENDPOINT` for MinIO and friends)
   - `AUTH_PROVIDER` and its settings (`OIDC_*` for `oidc`; `dev` is for non-production trials)
   - `GITLAB_HOSTS` — per-host GitLab service tokens, and/or `GITHUB_ENABLED=true` + `GITHUB_*`

   Everything else is documented in [CONFIGURATION.md](CONFIGURATION.md). You can sanity-check the
   file with `./scripts/validate-env.sh`.

2. Start the stack from the published GHCR images (recommended):

   ```sh
   VIZDIFF_VERSION=X.Y.Z docker compose -f docker-compose.images.yml up -d
   ```

   Pick `X.Y.Z` from the [Releases page](https://github.com/vizdiff-io/vizdiff.io/releases).
   Omitting `VIZDIFF_VERSION` uses `:latest` (the newest stable release). Images are
   `ghcr.io/vizdiff-io/vizdiff-{api,worker,frontend}` (multi-arch amd64 + arm64); the `main`
   branch publishes `:edge`.

   To build from source instead, use the default compose file:

   ```sh
   docker compose up -d --build
   ```

   (`./scripts/bootstrap-self-contained.sh` wraps this: copies `.env.example` if needed,
   validates it, builds, starts, and health-checks.)

3. Verify:

   - `GET /api/health` returns 200
   - `GET /api/version` returns `{ api, worker, workerOnline }` (also shown in the app footer)

4. Configure webhooks (optional but recommended):

   - GitLab (per project): `https://your-domain/api/webhooks/gitlab`, secret matching
     `GITLAB_WEBHOOK_SECRET` (or the per-host `webhookSecret` in `GITLAB_HOSTS`)
   - GitHub App (if `GITHUB_ENABLED=true`): `https://your-domain/api/webhooks/github`, secret
     matching `GITHUB_WEBHOOK_SECRET`

## TLS / HTTPS

The frontend container serves plain HTTP on port 80. You have two options for HTTPS:

**Option A — built-in Caddy overlay (easiest).** The `docker-compose.tls.yml` overlay adds a Caddy
reverse proxy that obtains and auto-renews a Let's Encrypt certificate. Layer it over whichever
base file you use — for the published images:

```sh
# In .env: APP_URL=https://vizdiff.example.com
VIZDIFF_DOMAIN=vizdiff.example.com \
  docker compose -f docker-compose.images.yml -f docker-compose.tls.yml up -d
```

(For from-source builds, substitute `-f docker-compose.yml`.) Caddy terminates TLS and forwards to
the frontend; nothing else changes. Requires Docker Compose v2.24+.

**Option B — your own terminator (ALB, external nginx, etc.).** Terminate TLS upstream and forward
to the frontend's port 80. Make sure your proxy sets `X-Forwarded-Proto: https` — the frontend
passes it through to the api, which uses it to set the `Secure` flag on the session cookie. Set
`APP_URL` to your `https://` URL.

## Health Checks

- API: `GET /api/health`
- API version: `GET /api/version` → `{ api, worker, workerOnline }` (the running api + worker versions)
- Worker: `http://localhost:3003/health` (container-internal)

Note: `docker-compose.images.yml` binds the Postgres (5432) and api (3001) debug ports to
loopback only; from outside the host, all traffic goes through the frontend (port 80, or Caddy
on 443 with the TLS overlay).

## Backups & Restore

- Backup: `./scripts/backup-postgres.sh`
- Restore: `./scripts/restore-postgres.sh < backup.sql`

## Upgrades

**Published images** (`docker-compose.images.yml`) — pin the new version from the
[Releases page](https://github.com/vizdiff-io/vizdiff.io/releases):

```sh
VIZDIFF_VERSION=X.Y.Z docker compose -f docker-compose.images.yml pull
VIZDIFF_VERSION=X.Y.Z docker compose -f docker-compose.images.yml up -d
```

**Build from source** (`docker-compose.yml`):

```sh
git pull
docker compose up -d --build
```

Then verify `GET /api/health` and confirm the new version at `GET /api/version`. The api applies
any pending database migrations automatically on boot.

## Troubleshooting

- Check container logs: `docker compose logs -f api worker`
- Verify `S3_BUCKET_NAME` permissions for read/write; with `S3_ENDPOINT` (MinIO), the endpoint
  must also be reachable from users' browsers for presigned image URLs to load
- Ensure the host can reach your GitLab/GitHub instance and the S3 endpoint
- CI integration issues: see [gitlab-ci-setup.md](gitlab-ci-setup.md) and the in-app guides at
  `/docs` (GitLab) and `/docs/github` (GitHub)
