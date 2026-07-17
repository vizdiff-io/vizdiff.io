# vizdiff.io self-hosted deployment

Packaging for running vizdiff.io on your own Kubernetes cluster. Two layers:

- **`helm/vizdiff/`** — the portable core chart (api, worker, frontend). Works
  standalone (embedded Postgres + MinIO) or against external Postgres/S3.
- **`terragrunt/`** — provisions AWS RDS, a private S3 bucket, and an IRSA role,
  then installs the Helm chart wired to those resources.

## Architecture

| Service  | Image                        | Port | Inbound Service | Health        |
|----------|------------------------------|------|-----------------|---------------|
| api      | `vizdiff-api` (Express)      | 3001 | yes             | `/api/health` |
| worker   | `vizdiff-worker`             | 3003 | no (health only)| `:3003/health`|
| frontend | `vizdiff-frontend` (nginx)   | 80   | yes             | `/`           |

Ingress routes `/api` → api and `/` → frontend on a single host.

## Standalone (no AWS) — quickest trial

Brings up in-chart Postgres + MinIO. Not for production.

```sh
helm install vizdiff ./helm/vizdiff \
  --set appUrl=http://localhost:8080 \
  --set auth.provider=dev \
  --set secrets.jwtSecret=$(openssl rand -hex 24) \
  --set postgres.embedded=true \
  --set postgres.password=$(openssl rand -hex 16) \
  --set s3.minio.enabled=true \
  --set ingress.enabled=false
```

## AWS / production

Use Terragrunt to provision RDS + S3 + IRSA and install the chart:

```sh
cd terragrunt/live/example
# edit terragrunt.hcl and each <module>/terragrunt.hcl: replace REPLACE_ME values
export VIZDIFF_JWT_SECRET=$(openssl rand -hex 24)
export VIZDIFF_OIDC_CLIENT_SECRET=...        # from your IdP
export VIZDIFF_GITLAB_HOSTS='[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]'
terragrunt run-all apply           # applies rds, s3, irsa, then app (in order)
```

`depends_on`/`dependency` ordering: **rds, s3, irsa → app**. The app module
reads RDS credentials straight from Secrets Manager and sets the IRSA role ARN
on the chart ServiceAccount, so no DB password is passed in plaintext.

To install the chart directly against existing AWS resources instead:

```sh
helm install vizdiff ./helm/vizdiff \
  --set appUrl=https://vizdiff.corp.example.com \
  --set postgres.host=<rds-endpoint> --set postgres.password=<pw> \
  --set s3.bucketName=<bucket> --set s3.region=us-west-2 \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<role-arn> \
  --set auth.oidc.issuer=... --set auth.oidc.clientId=... --set auth.oidc.clientSecret=... \
  --set secrets.jwtSecret=... \
  --set 'gitlab.hosts[0].host=https://gitlab.com' \
  --set 'gitlab.hosts[0].token=glpat-...' \
  --set 'gitlab.hosts[0].rejectUnauthorized=true'
```

## Configuration & secrets flow

- **ConfigMap** (`<release>-env`) holds non-secret env: `APP_URL`,
  `AUTH_PROVIDER`, `OIDC_ISSUER/CLIENT_ID/REDIRECT_URI/SCOPES`, `GITHUB_ENABLED`,
  `S3_BUCKET_NAME`, `POSTGRES_HOST/PORT/DATABASE/USER`, `ENABLE_VCS_STATUS`,
  optional `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`.
- **Secret** (`<release>-secret`) holds `JWT_SECRET`, `OIDC_CLIENT_SECRET`,
  `GITLAB_HOSTS` (JSON of per-host tokens), `POSTGRES_PASS`,
  `GITLAB_WEBHOOK_SECRET`.
- Both are wired into **api** and **worker** via `envFrom`.
- Set `secrets.create=false` + `secrets.existingSecret=<name>` to consume a
  pre-created/external Secret (e.g. from External Secrets Operator) instead of
  rendering tokens through Helm values. `gitlab.hostsSecret.name` similarly lets
  `GITLAB_HOSTS` come from an external Secret.

## Schema migrations & startup ordering

The api runs TypeORM migrations on boot (`migrationsRun:true`), so it owns the
schema — no separate migration Job. The worker has a `wait-for-api`
initContainer that blocks until the api's `/api/health` returns 200 (i.e. after
migrations finish). An optional pre-install/pre-upgrade hook Job waits for
Postgres readiness before the api starts (`dbWaitHook.enabled`, skipped in
embedded mode). See `helm/vizdiff/templates/NOTES.txt`.

## Frontend runtime config

Next.js static export bakes `NEXT_PUBLIC_*` at build time. To keep one frontend
image across environments, the chart mounts `/config.js` exposing
`window.__VIZDIFF_CONFIG__` (`API_URL`, `APP_URL`, `GITHUB_ENABLED`), generated
from `appUrl` and `github.enabled`. The frontend loads it before the app bundle
(`frontend/src/pages/_document.tsx`) and falls back to the baked `NEXT_PUBLIC_*`
values when the file is absent (e.g. local dev).

## Private S3

The Terragrunt `s3` module creates a **private** bucket with block-public-access
enabled. Screenshots are served via presigned GET URLs generated at read time
(`api/src/s3.ts` / `worker/src/s3.ts`); see "Private S3 / presigned URLs" in
[docs/CONFIGURATION.md](../docs/CONFIGURATION.md) for TTLs and caveats.

## Validation

```sh
helm lint ./helm/vizdiff
helm template r ./helm/vizdiff -f my-values.yaml
cd terragrunt && terraform fmt -recursive -check . && (cd modules/rds && terraform validate)
```
