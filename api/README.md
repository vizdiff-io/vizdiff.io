# vizdiff.io API Server

> The backend server for vizdiff.io

# Developing

1. Run `yarn install` in this directory (`api/`) or the workspace root
2. Create a `api/.env` file containing:

```
APP_URL=http://127.0.0.1:3000
GITHUB_APP_ID=<gh_app_id>
GITHUB_CLIENT_ID=<gh_client_id>
GITHUB_CLIENT_SECRET=<gh_client_secret>
GITHUB_WEBHOOK_SECRET=<gh_webhook_secret>
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
<gh_private_key>
-----END RSA PRIVATE KEY-----"
```

3. Run `yarn test`
4. Run `yarn start`
