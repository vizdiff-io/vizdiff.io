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

The Node.js version is pinned in [`.nvmrc`](.nvmrc) (and `engines.node` in the root
`package.json`), which is the single source of truth used by local dev (`nvm use`), CI
(`actions/setup-node` reads `.nvmrc`), and the Dockerfiles (`ARG NODE_VERSION`, overridable
with `--build-arg NODE_VERSION=<version>`).

1. `nvm use` (installs/uses the Node version from `.nvmrc`), then `corepack enable`
2. `yarn`
3. Follow the instructions in [api/README.md](api/README.md) to create the `api/.env` file
4. Create `frontend/.env.local` with the following:

```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_GITHUB_APP_NAME=vizdiff-io
NEXT_PUBLIC_GITHUB_CLIENT_ID=<github_client_id>
```

5. Create `worker/.env` with the following (adjust values to match your PostgreSQL setup):

```
POSTGRES_USER=postgres
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=postgres
POSTGRES_PORT=5432
```

6. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
7. Start the api: `yarn api dev`
8. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
