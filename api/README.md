# vizdiff.io API Server

> The backend server for vizdiff.io

# Developing

1. Run `yarn install` in this directory (`api/`) or the workspace root
2. Create a `api/.env` file containing:

```
APP_URL=http://127.0.0.1:3000

# GitHub App credentials
GITHUB_APP_ID=<gh_app_id>
GITHUB_CLIENT_ID=<gh_client_id>
GITHUB_CLIENT_SECRET=<gh_client_secret>
GITHUB_WEBHOOK_SECRET=<gh_webhook_secret>
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
<gh_private_key>
-----END RSA PRIVATE KEY-----"

# AWS credentials for S3 access
AWS_ACCESS_KEY_ID=<aws_access_key_id>
AWS_SECRET_ACCESS_KEY=<aws_secret_access_key>
AWS_REGION=<aws_region>
STRIPE_SECRET_KEY=<sk_test_key>
```

3. Run `yarn test`
4. Run `yarn start`
