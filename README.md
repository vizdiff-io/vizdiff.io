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
