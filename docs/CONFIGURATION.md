# VizDiff Configuration

This document lists every environment variable consumed by the self-hostable VizDiff deployment,
which service(s) read it, whether it is required, its default, and a short description.

VizDiff is a Yarn v4 monorepo with three runtime services:

- **api** — Express HTTP API (auth, projects, uploads, webhooks). Sole database schema owner.
- **worker** — renders Storybook builds and posts GitLab commit statuses.
- **frontend** — Next.js static export. `NEXT_PUBLIC_*` variables are **build-time** only.

## VCS platforms

VizDiff is self-hosted only and integrates with two VCS platforms—enable either or both:

- **GitLab** (default) — projects, merge-request commit statuses, and webhooks via a configured
  service token per host (see [GitLab service tokens](#gitlab-service-tokens-gitlab_hosts)). On-prem
  GitLab and gitlab.com are supported simultaneously.
- **GitHub** (optional; set `GITHUB_ENABLED=true`) — projects and pull-request checks via a GitHub App.

User identity (login) is handled separately by the pluggable AuthProvider described below.

## Authentication

Identity is provided by a pluggable `AuthProvider`, selected by `AUTH_PROVIDER`:

- `oidc` (default in production) — generic OIDC / Microsoft Entra (MSAL) via `openid-client`.
  Uses PKCE and a signed-cookie state (no server-side session store), so the deployment stays
  stateless. The ID token's signature, issuer, audience, expiry, state, and nonce are validated
  against the discovered JWKS. Typical for GitLab-mode deployments.
- `github` — GitHub OAuth login (for GitHub-mode deployments). Authenticates with GitHub and links
  the user's GitHub account so the GitHub App integration works. Requires `GITHUB_CLIENT_ID` /
  `GITHUB_CLIENT_SECRET`; pair with `GITHUB_ENABLED=true`.
- `dev` — non-production fixed identity (`subject="dev"`, email `DEV_AUTH_EMAIL`). Refuses to run
  in production. Replaces the old `X-Test-User-Id` shortcut.
- `custom` — reserved slot for a future custom auth service. Implement the
  `AuthProvider` interface in `api/src/auth/` and wire it in `api/src/auth/index.ts`.

The existing JWT-cookie session mechanism is retained; only the identity source changed. After a
successful login the API issues the same `token` (8h) and `authenticated` (30d) cookies as before.

## Authorization

Any authenticated user can view and manage **all** projects. Per-user VCS-membership scoping has
been removed. The project creator is still recorded for audit (`projects.user_id`).

## GitLab service tokens (`GITLAB_HOSTS`)

GitLab API calls (commit statuses, project/group listing) use a configured **service token** per
host instead of each user's OAuth token. The token needs `api` scope and **Developer+** role.

`GITLAB_HOSTS` is a JSON array of objects:

```json
[
  { "host": "https://gitlab.com",            "token": "glpat-...", "rejectUnauthorized": true },
  { "host": "https://gitlab.corp.example.com","token": "glpat-...", "rejectUnauthorized": false,
    "webhookSecret": "per-host-secret" }
]
```

- `host` — the GitLab origin (scheme + host + port). Resolution is exact-origin match.
- `token` — service token with `api` scope.
- `rejectUnauthorized` — `false` for on-prem instances with self-signed certificates (a per-host
  `undici` Agent is used so gitlab.com stays strict).
- `webhookSecret` — optional; verifies the `X-Gitlab-Token` header for webhooks from this host.
  Falls back to the global `GITLAB_WEBHOOK_SECRET` when unset.

Single-host fallback: when `GITLAB_HOSTS` is unset, a single host is derived from `GITLAB_HOST` +
`GITLAB_TOKEN` (+ optional `GITLAB_REJECT_UNAUTHORIZED` and `GITLAB_WEBHOOK_SECRET`).

## Environment variables

| Name | Service(s) | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | api, worker, frontend | no | `development` | `production` / `staging` / `test` / `development`. |
| `APP_URL` | api, worker | yes (prod) | `https://vizdiff.io` | Public base URL; used for cookies, redirects, and `build?id=` links. |
| `JWT_SECRET` | api | yes | `secret` | Signs the session JWT cookie and the transient OIDC state cookie. |
| `PORT` | api | no | `3001` | API listen port. |
| `WORKER_HEALTH_PORT` | worker | no | `3003` | Worker health endpoint port. |
| `WORKER_STORY_CONCURRENCY` | worker | no | `4` | Max stories rendered concurrently within a single ingest task. Defaults to `4`, which matches the prior behavior: screenshot capture is serialized by a process-wide browser mutex, but the S3 upload, baseline download/diff, and result save phases overlap with the next story's capture. Raising it above `4` enables more capture overlap once the Phase-1b per-story browser isolation work lands (issue #152). |
| `POSTGRES_HOST` | api, worker | no | `localhost` | Postgres host. |
| `POSTGRES_PORT` | api, worker | no | `5432` | Postgres port. |
| `POSTGRES_USER` | api, worker | no | `postgres` | Postgres user. |
| `POSTGRES_PASS` | api, worker | no | `postgres` | Postgres password. |
| `POSTGRES_DATABASE` | api, worker | no | `vizdiff` | Postgres database name. |
| `S3_BUCKET_NAME` | api, worker | yes | `vizdiffio-testing` | Bucket for uploaded Storybook tarballs and screenshots. |
| `S3_ENDPOINT` | api, worker | no | — | Custom S3 endpoint for non-AWS object stores (e.g. `http://minio:9000` for the chart's standalone/air-gapped MinIO mode). Unset → real AWS S3. |
| `S3_FORCE_PATH_STYLE` | api, worker | no | `true` when `S3_ENDPOINT` set | Use path-style addressing (required by MinIO). |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | api, worker | yes* | — | Standard AWS SDK credentials (omit when using IRSA / instance roles; for MinIO use its access/secret keys). |
| `ENABLE_VCS_STATUS` | api, worker | no | `true` in prod/staging | Whether to post VCS commit statuses. |
| `MAX_STORIES_PER_UPLOAD` | worker | no | `1000` | Max stories processed per upload; over-limit uploads fail the build. `0` disables. |
| `MAX_TARBALL_FILES` | worker | no | `50000` | Max number of file entries allowed in an uploaded tarball. `0` disables. |
| `MAX_EXTRACTED_BYTES` | worker | no | `1073741824` (1 GiB) | Max total uncompressed size of an extracted tarball (zip-bomb guard). `0` disables. |
| `MAX_TARBALL_ENTRY_BYTES` | worker | no | `268435456` (256 MiB) | Max size of any single extracted file. `0` disables. |
| `MAX_TARBALL_PATH_LENGTH` | worker | no | `4096` | Max length of any path inside the tarball. `0` disables. |
| `MAX_STORY_IDENTIFIER_LENGTH` | worker | no | `2048` | Max length of a story id/name/title/importPath. `0` disables. |
| `AUTH_PROVIDER` | api | no | `oidc` (prod), `dev` (else) | Identity provider: `oidc`, `github`, or `dev`. |
| `OIDC_ISSUER` | api | yes (oidc) | — | OIDC issuer URL (e.g. `https://login.microsoftonline.com/<tenant>/v2.0`). |
| `OIDC_CLIENT_ID` | api | yes (oidc) | — | OIDC client ID. |
| `OIDC_CLIENT_SECRET` | api | yes (confidential clients) | — | OIDC client secret. |
| `OIDC_REDIRECT_URI` | api | no | `${APP_URL}/api/auth/callback` | OIDC redirect/callback URI. |
| `OIDC_SCOPES` | api | no | `openid profile email` | Space-separated OIDC scopes. |
| `OIDC_REJECT_UNAUTHORIZED` | api | no | `true` | Set `false` for self-signed IdPs (dev/test only). |
| `DEV_AUTH_EMAIL` | api | no | `dev@vizdiff.local` | Email for the `dev` auth provider's fixed identity. |
| `GITLAB_HOSTS` | api, worker | yes (GitLab) | — | JSON array of per-host service-token configs (see above). |
| `GITLAB_HOST` | api, worker | no | `https://gitlab.com` | Default host for token resolution and single-host fallback. |
| `GITLAB_TOKEN` | api, worker | no | — | Single-host service token (fallback when `GITLAB_HOSTS` unset). |
| `GITLAB_REJECT_UNAUTHORIZED` | api, worker | no | `true` | Single-host TLS verification (fallback). |
| `GITLAB_WEBHOOK_SECRET` | api | no | — | Global GitLab webhook secret (per-host `webhookSecret` takes precedence). |
| `GITHUB_ENABLED` | api, worker | no | `false` | Enables GitHub routes, webhooks, and uploads. |
| `GITHUB_APP_ID` | api, worker | yes (GitHub) | — | GitHub App ID. |
| `GITHUB_CLIENT_ID` | api, worker | yes (GitHub) | — | GitHub App client ID. |
| `GITHUB_CLIENT_SECRET` | api, worker | yes (GitHub) | — | GitHub App client secret. |
| `GITHUB_PRIVATE_KEY` | api, worker | yes (GitHub) | — | GitHub App private key (PEM). |
| `GITHUB_WEBHOOK_SECRET` | api | yes (GitHub) | — | GitHub webhook signing secret. |
| `NEXT_PUBLIC_APP_URL` | frontend | no | `https://vizdiff.io` | Public base URL (build-time). |
| `NEXT_PUBLIC_GITHUB_ENABLED` | frontend | no | `false` | Shows the GitHub create-project UI (build-time). |
| `NEXT_PUBLIC_GITHUB_APP_NAME` | frontend | no | — | GitHub App slug for the "Install App" link (build-time). |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | frontend | no | — | GitHub OAuth client ID (build-time, GitHub only). |
| `DD_*` | api, worker | no | — | Optional Datadog APM (active only in prod/staging). |

\* Credentials may be supplied via IRSA, instance profiles, or the standard AWS credential chain
instead of static keys.

## Database migrations

The API is the sole schema owner. It runs with `synchronize: false` and applies TypeORM migrations
from `dist/migrations/*.js` on boot (`migrationsRun: true`). The worker uses `synchronize: false`
and never alters the schema.

Migration scripts (run from the repo root):

```bash
yarn api migration:generate api/src/migrations/<Name>   # generate from the entity diff
yarn api migration:run                                   # apply pending migrations
yarn api migration:revert                                # revert the last migration
```

Generating migrations requires a reachable Postgres (`docker compose up -d postgres`). The CLI uses
the datasource at `api/src/datasource.ts`.

### Projects-uniqueness data caveat

The self-host migration re-keys the `projects` unique index from `(user_id, vcs_provider, repo_id)`
to `(vcs_provider, repo_id, gitlab_host)` — one project per repo regardless of creator. If multiple
users previously created VizDiff projects for the same repo, the unique index creation will **fail**
until duplicates are removed. De-duplicate before/with the migration, e.g.:

```sql
-- Inspect duplicates
SELECT vcs_provider, repo_id, gitlab_host, count(*)
FROM projects GROUP BY 1,2,3 HAVING count(*) > 1;
-- Keep the lowest id per group, delete the rest (review first!)
DELETE FROM projects p USING projects q
WHERE p.vcs_provider = q.vcs_provider AND p.repo_id = q.repo_id
  AND p.gitlab_host IS NOT DISTINCT FROM q.gitlab_host AND p.id > q.id;
```

## Private S3 / presigned URLs

Bring your own S3 (or S3-compatible store). The bucket is **private**; the worker stores each
screenshot's S3 object key, and URLs are generated as presigned GET URLs at read time:

- **Interactive build viewer** (`GET /api/builds/:id`): presigned with `IMAGE_URL_TTL_SECONDS` (short).
- **PR/MR comment images** (markdown posted to GitHub/GitLab): presigned with `VCS_IMAGE_URL_TTL_SECONDS`
  (long). See `api/src/s3.ts` / `worker/src/s3.ts`.

Caveats:

- **7-day cap on comment images.** S3 SigV4 presigned URLs expire after at most 7 days, so screenshots
  embedded in older PR/MR comments will stop loading. The build still renders fresh URLs in the web UI.
  For permanent comment images, front the bucket with an authenticated proxy or CloudFront-with-OAC.
- **MinIO / S3-compatible mode.** Presigned URLs point at `S3_ENDPOINT`; that host must be reachable
  from the user's browser (not just from inside the cluster) for images to load.
- **Legacy rows.** Rows that stored a full public S3 URL (pre-migration) are handled transparently—the
  presigner extracts the object key from the URL path.
