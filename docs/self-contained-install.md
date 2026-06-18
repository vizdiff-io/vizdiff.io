# Self-Contained Installation (AWS Marketplace AMI)

This guide targets a single-tenant, self-contained deployment of VizDiff on a single EC2 instance
using Docker Compose. It assumes no shared services are hosted by VizDiff.

## Architecture

- `frontend`: static Next.js export served by nginx
- `api`: Express backend on port 3001
- `worker`: background processor with Chromium/ChromeDriver
- `postgres`: database and task queue (LISTEN/NOTIFY)

External integrations still required:

- AWS S3 for storybook uploads and screenshots
- GitHub App for OAuth + check runs (BYO app), **OR**
- GitLab OAuth Application for OAuth + commit statuses (see [GitLab CI Setup](gitlab-ci-setup.md))
- AWS SES for email sending (optional; no email will be sent if unset)
- Stripe is disabled by default in self-contained mode (no billing or usage metering)

## Prerequisites

- An EC2 instance with Docker + Docker Compose installed
- A public DNS name with TLS termination (nginx in container is HTTP only)
- An S3 bucket for artifacts (storybook tarballs, screenshots, diff masks)
- **One of the following for VCS integration:**
  - A GitHub App created in your GitHub org, **OR**
  - A GitLab OAuth Application (gitlab.com or self-hosted)
- Optional: AWS SES domain or email identity verified

## Setup Steps

1. Copy environment templates

   - Root: `.env.example` -> `.env`
   - API: `api/.env.example` (reference only)
   - Worker: `worker/.env.example` (reference only)
   - Frontend: `frontend/.env.example` (reference only)

2. Configure environment values in `.env`

   - `APP_URL` must match your public domain (e.g. `https://vizdiff.example.com`)
   - `S3_BUCKET_NAME` and AWS credentials
   - GitHub App credentials and webhook secret
   - Stripe or Marketplace settings
   - Optional SES settings
   - Optional `SETUP_TOKEN` to protect setup endpoints

3. Build and start services

   - `./scripts/bootstrap-self-contained.sh`

4. Configure GitHub App webhook

   - Webhook URL: `https://your-domain/api/webhooks/github`
   - Webhook secret: `GITHUB_WEBHOOK_SECRET`

5. Optional: Stripe webhooks (if using Stripe billing)
   - Webhook URL: `https://your-domain/api/stripe/webhook`

## TLS / HTTPS

The frontend container serves plain HTTP on port 80. You have two options for HTTPS:

**Option A — built-in Caddy overlay (easiest).** An optional `docker-compose.tls.yml` overlay adds a
Caddy reverse proxy that obtains and auto-renews a Let's Encrypt certificate. Point a DNS record at
this host, open ports 80 and 443, then:

```sh
# In .env: APP_URL=https://vizdiff.example.com   (and NEXT_PUBLIC_APP_URL to match)
VIZDIFF_DOMAIN=vizdiff.example.com \
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Caddy terminates TLS and forwards to the frontend; nothing else changes. (Requires Docker Compose
v2.24+.)

**Option B — your own terminator (ALB, CloudFront, external nginx, etc.).** Terminate TLS upstream
and forward to the frontend's port 80. Make sure your proxy sets `X-Forwarded-Proto: https` — the
frontend passes it through to the api, which uses it to set the `Secure` flag on the session cookie.
Set `APP_URL` to your `https://` URL.

## Setup Validation UI

After the stack is running, visit:

- `https://your-domain/setup`

If `SETUP_TOKEN` is set, provide it in the Setup UI. The UI can validate:

- GitHub App configuration
- S3 bucket read/write
- SES test email

## GitHub App (BYO)

Because this is self-contained, the GitHub App must be created and owned by the installer.
Required permissions:

- Checks: Read & Write
- Contents: Read
- Pull requests: Read
- Statuses: Read & Write

Required events:

- `check_suite`
- `check_run`

## GitLab Integration (Alternative to GitHub)

VizDiff also supports GitLab (gitlab.com or self-hosted). See [GitLab CI Setup](gitlab-ci-setup.md) for complete instructions.

**Quick setup:**

1. Create a GitLab OAuth Application at `https://gitlab.com/-/user_settings/applications`:

   - Redirect URI: `https://your-domain/api/auth/gitlab/callback`
   - Scopes: `read_user`, `read_api`, `read_repository`

2. Add to your `.env`:

   ```bash
   GITLAB_HOST=https://gitlab.com
   GITLAB_CLIENT_ID=your_application_id
   GITLAB_CLIENT_SECRET=your_application_secret
   GITLAB_WEBHOOK_SECRET=your_webhook_secret
   NEXT_PUBLIC_GITLAB_CLIENT_ID=your_application_id
   ```

3. Configure GitLab webhook (per project):
   - URL: `https://your-domain/api/webhooks/gitlab`
   - Secret: same as `GITLAB_WEBHOOK_SECRET`

For self-hosted GitLab with self-signed certificates, set `GITLAB_REJECT_UNAUTHORIZED=false`.

## Email via SES

Set `SES_REGION` and `SES_FROM_EMAIL`. If unset, VizDiff will not attempt to send email.

## Billing Options

- **Stripe**: disabled when `STRIPE_SECRET_KEY` is not set (default in self-contained)
- **AWS Marketplace**: future option if you add Entitlement + Metering APIs

## Notes for AMI Packaging

- Pre-bake the AMI with Docker and repository artifacts
- Provide a CloudFormation template that:
  - Launches the AMI
  - Opens ports 80/443 for HTTPS termination
  - Optionally creates an S3 bucket and IAM role
- Example template: `docs/cloudformation-self-contained.yml`

## Troubleshooting

- Check container logs: `docker compose logs -f api worker`
- Ensure the instance can reach GitHub and AWS endpoints
- Verify `S3_BUCKET_NAME` permissions for read/write

## Health Checks

- API: `GET /api/health`
- API version: `GET /api/version` → `{ api, worker, workerOnline }` (the running api + worker versions)
- Worker: `http://localhost:3003/health` (container‑internal)

## Backups & Restore

- Backup: `./scripts/backup-postgres.sh`
- Restore: `./scripts/restore-postgres.sh < backup.sql`

## Upgrades

How you upgrade depends on whether you run **published release images** or **build from source**.

**Published images** (`docker-compose.images.yml`, recommended) — pin a version from the
[Releases page](https://github.com/vizdiff-io/vizdiff.io/releases):

```sh
VIZDIFF_VERSION=X.Y.Z docker compose -f docker-compose.images.yml pull
VIZDIFF_VERSION=X.Y.Z docker compose -f docker-compose.images.yml up -d
```

Omit `VIZDIFF_VERSION` to track `:latest` (newest stable release). Images are
`ghcr.io/vizdiff-io/vizdiff-{api,worker,frontend}` (multi-arch amd64 + arm64).

**Build from source** (`docker-compose.yml`):

```sh
git pull
docker compose up -d --build
```

Then verify `GET /api/health` and confirm the new version at `GET /api/version` (also shown in the
app's footer). The api applies any pending database migrations automatically on boot.
