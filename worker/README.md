# vizdiff.io Worker Service

> Task-based worker service for vizdiff.io

## Developing

1. Run `yarn install` in this directory (`worker/`) or the workspace root
2. Create `.env` with the following (adjust values to match your PostgreSQL setup):

```
POSTGRES_USER=postgres
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=postgres
POSTGRES_PORT=5432
```

3. Run `yarn test`
4. Run `yarn start`
