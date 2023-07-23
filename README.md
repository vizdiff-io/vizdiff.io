# vizdiff.io

https://vizdiff.io website

```
vizdiff/
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # GitHub Actions workflow file
├── api/
│   ├── src/
│   │   └── app.ts              # Main API application file
│   ├── test/                   # API tests
│   ├── package.json            # API dependencies and scripts
│   └── tsconfig.json           # API TypeScript configuration
├── worker/
│   ├── src/
│   │   ├── tasks/              # Worker tasks
│   │   ├── utils/              # Utility functions
│   │   └── worker.ts           # Main worker application file
│   ├── test/                   # Worker tests
│   ├── package.json            # Worker dependencies and scripts
│   └── tsconfig.json           # Worker TypeScript configuration
├── frontend/
│   ├── public/                 # Static assets like favicon
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── styles/             # Global and component-specific styles
│   │   └── utils/              # Utility functions
│   ├── pages/                  # Next.js pages and API routes
│   ├── test/                   # Frontend tests
│   ├── package.json            # Frontend dependencies and scripts
│   └── tsconfig.json           # Frontend TypeScript configuration
├── .gitignore                  # Files and folders to ignore in Git
├── README.md                   # Project documentation
└── package.json                # Root package.json for managing scripts and workspaces
```

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
NEXT_PUBLIC_GITHUB_CLIENT_ID=<gh_client_id>
```

4. Create a Docker volume for Postgres: `docker volume create postgres-data`
5. Start Postgres and create an empty vizdiff database and test database with the `start-postgres.sh` script
6. Start the backend: `yarn api dev`
7. (In another terminal) start the frontend: `yarn frontend dev`

You can also run `yarn test:all` to run all test suites.
