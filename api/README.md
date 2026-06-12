# VizDiff API Server

> The backend HTTP API for VizDiff (auth, projects, uploads, webhooks). It is the sole database
> schema owner and runs migrations on boot.

# Developing

1. Run `yarn install` in this directory (`api/`) or the workspace root
2. Create an `api/.env` file. For local development, GitLab mode with the `dev` auth provider is the
   simplest (no external identity provider needed):

```
NODE_ENV=development
APP_URL=http://127.0.0.1:3000
JWT_SECRET=dev-secret
AUTH_PROVIDER=dev

# Postgres
POSTGRES_USER=postgres
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=postgres
POSTGRES_PORT=5432

# Object storage — a real bucket, or a local MinIO via S3_ENDPOINT
S3_BUCKET_NAME=vizdiff-local
# S3_ENDPOINT=http://127.0.0.1:9000
# S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_REGION=us-east-1

# GitLab service token(s). Used both by the worker to post merge-request commit statuses and
# by the "Add project" dialog to list GitLab groups/projects. Only omittable if you won't
# exercise GitLab project creation or status posting locally.
GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
```

To develop **OIDC** login instead of the dev provider, set `AUTH_PROVIDER=oidc` and the `OIDC_*`
values. To develop **GitHub** mode, set `GITHUB_ENABLED=true`, `AUTH_PROVIDER=github`, and the
`GITHUB_*` GitHub App credentials. See [../docs/CONFIGURATION.md](../docs/CONFIGURATION.md) for every
variable.

3. Run `yarn test`
4. Run `yarn start`
