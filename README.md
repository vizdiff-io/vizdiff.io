# vizdiff.io

https://vizdiff.io website, backend, cli, and worker

## Local development

1. `yarn`
2. Create `api/.env` with the following:

```
GITHUB_CLIENT_ID=<gh_client_id>
GITHUB_CLIENT_SECRET=<gh_client_secret>
```

3. Create `frontend/.env.local` with the following:

```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_GITHUB_APP_NAME=vizdiff-io
NEXT_PUBLIC_GITHUB_CLIENT_ID=<github_client_id>
```

4. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
5. Start the backend: `yarn api dev`
6. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
