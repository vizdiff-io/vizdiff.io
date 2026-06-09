# VizDiff

VizDiff is a **self-hosted** visual regression tool for Storybook. It captures Storybook screenshots
in CI, highlights pixel diffs, and posts status checks on your changes before you merge. Self-hosting
is the only deployment model—you run it on your own infrastructure.

It integrates with two VCS platforms; enable either or both:

- **GitLab** (default) — merge-request commit statuses via a configured per-host service token
  (gitlab.com and on-prem). Login is handled by a pluggable OIDC/MSAL identity provider.
- **GitHub** (optional, `GITHUB_ENABLED=true`) — pull-request checks via a GitHub App; login via
  GitHub OAuth (`AUTH_PROVIDER=github`).

It runs as three services (**api**, **worker**, **frontend**) backed by PostgreSQL and a
(bring-your-own) S3-compatible bucket.

- Configuration reference: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- Deployment (Helm chart + Terragrunt modules): [`deploy/`](deploy/)
- In-app setup guides: GitLab at `/docs`, GitHub at `/docs/github`

## Local development

The simplest local setup runs in **GitLab mode** with the `dev` auth provider (a fixed local
identity, so no external IdP is required). See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the
full list of variables.

1. `yarn`
2. Create `api/.env` (details in [api/README.md](api/README.md)):

   ```
   NODE_ENV=development
   APP_URL=http://127.0.0.1:3000
   JWT_SECRET=dev-secret
   AUTH_PROVIDER=dev            # fixed local identity; no external IdP needed

   # Postgres
   POSTGRES_USER=postgres
   POSTGRES_HOST=localhost
   POSTGRES_DATABASE=vizdiff
   POSTGRES_PASS=postgres
   POSTGRES_PORT=5432

   # Object storage (point S3_ENDPOINT at a local MinIO, or use a real bucket)
   S3_BUCKET_NAME=vizdiff-local
   # S3_ENDPOINT=http://127.0.0.1:9000
   # S3_FORCE_PATH_STYLE=true

   # GitLab service token so the worker can post merge-request commit statuses.
   # Optional if you're only working on the UI.
   GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
   ```

   GitHub mode is off by default. To develop it instead, set `GITHUB_ENABLED=true`,
   `AUTH_PROVIDER=github`, and the `GITHUB_*` app credentials (see `docs/CONFIGURATION.md`).

3. Create `frontend/.env.local`:

   ```
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
   NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
   # GitHub mode only: NEXT_PUBLIC_GITHUB_ENABLED=true plus the NEXT_PUBLIC_GITHUB_* app values
   ```

4. Create `worker/.env` (Postgres + the same GitLab host config as the api):

   ```
   POSTGRES_USER=postgres
   POSTGRES_HOST=localhost
   POSTGRES_DATABASE=vizdiff
   POSTGRES_PASS=postgres
   POSTGRES_PORT=5432
   GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
   ```

5. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
6. Start the api: `yarn api dev`
7. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
