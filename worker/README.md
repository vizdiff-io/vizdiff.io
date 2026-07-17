# vizdiff.io Worker Service

> Task-based worker service for vizdiff.io

## Developing

1. Run `yarn install` in this directory (`worker/`) or the workspace root
2. Create `.env` with the following (adjust values to match your setup; see
   [docs/CONFIGURATION.md](../docs/CONFIGURATION.md) for the full reference):

```
# Postgres
POSTGRES_USER=postgres
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=postgres
POSTGRES_PORT=5432

# Object storage for screenshots (point S3_ENDPOINT at a local MinIO, or use a real bucket)
S3_BUCKET_NAME=vizdiff-local
# S3_ENDPOINT=http://127.0.0.1:9000
# S3_FORCE_PATH_STYLE=true

# GitLab service token(s), same as the api's. Used to post merge-request commit statuses.
# Only omittable if you won't exercise status posting locally.
GITLAB_HOSTS=[{"host":"https://gitlab.com","token":"glpat-...","rejectUnauthorized":true}]
```

3. Run `yarn test`
4. Run `yarn start`
