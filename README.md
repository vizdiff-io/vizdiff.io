# vizdiff.io

https://vizdiff.io website, api, and worker

## Local development

1. `yarn`
2. Follow the instructions in [api/README.md](api/README.md) to create the `api/.env` file
3. Create `frontend/.env.local` with the following:

```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_GITHUB_APP_NAME=vizdiff-io
NEXT_PUBLIC_GITHUB_CLIENT_ID=<github_client_id>
```

4. Create `worker/.env` with the following (adjust values to match your PostgreSQL setup):

```
POSTGRES_USER=postgres
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=postgres
POSTGRES_PORT=5432
```

5. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
6. Start the api: `yarn api dev`
7. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
