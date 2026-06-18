# VizDiff

VizDiff is a **self-hosted** visual regression tool for Storybook. It captures Storybook screenshots
in CI, highlights pixel diffs, and posts status checks on your changes before you merge. Self-hosting
is the only deployment model—you run it on your own infrastructure.

<p align="center">
  <img src="docs/details-diffview-900.png" alt="VizDiff diff view comparing a baseline and a changed Storybook screenshot" width="900">
</p>

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

## Releases

Versioned, multi-arch images are published to GHCR for each release:
`ghcr.io/vizdiff-io/vizdiff-{api,worker,frontend}` tagged `:X.Y.Z` / `:X.Y` / `:X` / `:latest`
(the `main` branch publishes `:edge`). Pin a release with
[`docker-compose.images.yml`](docker-compose.images.yml) (`VIZDIFF_VERSION=X.Y.Z`) or Helm
(`--set image.tag=X.Y.Z`). The [GitHub Releases page](https://github.com/vizdiff-io/vizdiff.io/releases)
is the canonical changelog; the running version is shown in the app footer and at `GET /api/version`.
Maintainers: see [RELEASING.md](RELEASING.md).

## Local development

The simplest local setup runs in **GitLab mode** with the `dev` auth provider (a fixed local
identity, so no external IdP is required). See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the
full list of variables.

The Node.js version is pinned in [`.nvmrc`](.nvmrc) (and `engines.node` in the root
`package.json`), which is the single source of truth used by local dev (`nvm use`), CI
(`actions/setup-node` reads `.nvmrc`), and the Dockerfiles (`ARG NODE_VERSION`, overridable
with `--build-arg NODE_VERSION=<version>`).

1. `nvm use` (installs/uses the Node version from `.nvmrc`), then `corepack enable`
2. `yarn`
3. Create `api/.env` (details in [api/README.md](api/README.md)):

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

   # GitLab service token(s). Used both by the worker to post merge-request commit statuses
   # and by the "Add project" dialog to list GitLab groups/projects. Only omittable if you
   # won't exercise GitLab project creation or status posting locally.
   GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
   ```

   GitHub mode is off by default. To develop it instead, set `GITHUB_ENABLED=true`,
   `AUTH_PROVIDER=github`, and the `GITHUB_*` app credentials (see `docs/CONFIGURATION.md`).

4. Create `frontend/.env.local`:

   ```
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
   NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
   # GitHub mode only: NEXT_PUBLIC_GITHUB_ENABLED=true plus the NEXT_PUBLIC_GITHUB_* app values
   ```

5. Create `worker/.env` (Postgres + the same GitLab host config as the api):

   ```
   POSTGRES_USER=postgres
   POSTGRES_HOST=localhost
   POSTGRES_DATABASE=vizdiff
   POSTGRES_PASS=postgres
   POSTGRES_PORT=5432
   GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
   ```

6. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
7. Start the api: `yarn api dev`
8. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
