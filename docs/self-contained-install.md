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
- GitHub App for OAuth + check runs (BYO app)
- AWS SES for email sending (optional; no email will be sent if unset)
- Stripe is disabled by default in self-contained mode (no billing or usage metering)

## Prerequisites

- An EC2 instance with Docker + Docker Compose installed
- A public DNS name with TLS termination (nginx in container is HTTP only)
- An S3 bucket for artifacts (storybook tarballs, screenshots, diff masks)
- A GitHub App created in your GitHub org
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
- Worker: `http://localhost:3003/health` (container‑internal)

## Backups & Restore

- Backup: `./scripts/backup-postgres.sh`
- Restore: `./scripts/restore-postgres.sh < backup.sql`

## Upgrades

1. `docker compose pull`
2. `docker compose up -d --build`
3. Verify `/api/health`
