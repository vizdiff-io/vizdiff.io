# Deployment Setup

This document outlines the steps necessary to configure the CI/CD pipeline for deployment to EC2.

## GitHub Variables Setup

The following GitHub Variables need to be configured in your repository for the deployment workflow to function properly:

- `NEXT_PUBLIC_APP_URL`: https://vizdiff.io
- `NEXT_PUBLIC_API_URL`: https://vizdiff.io/api
- `NEXT_PUBLIC_GITHUB_APP_NAME`: vizdiff-io
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`: <your_github_client_id>
- `NEXT_PUBLIC_DD_APPLICATION_ID`: (optional) Enables DataDog Real User Monitoring
- `NEXT_PUBLIC_DD_CLIENT_TOKEN`: (optional) Enables DataDog Real User Monitoring

## GitHub Secrets Setup

The following GitHub Secrets need to be configured in your repository for the deployment workflow to function properly:

### AWS Configuration Secrets

- `AWS_ROLE_ARN`: ARN of the AWS IAM role with permissions to push to ECR and access S3/CloudFront
- `CLOUDFRONT_DISTRIBUTION_ID`: ID of the CloudFront distribution for the frontend

### EC2 SSH Access

- `EC2_SSH_PRIVATE_KEY`: Private SSH key for EC2 access
- `EC2_SSH_KNOWN_HOSTS`: SSH known_hosts entry for EC2 instance
- `EC2_HOST`: Hostname or IP address of the EC2 instance
- `EC2_USER`: Username for SSH connection to EC2 (typically "ubuntu")

### Environment Variables

- `ENV_FILE`: Complete contents of the API and worker service's .env.production files (all variables in KEY=VALUE format)

## `ENV_FILE` Example Content

```
APP_URL=https://vizdiff.io
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-west-1
GITHUB_APP_ID=your_github_app_id
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
POSTGRES_USER=vizdiff_user
POSTGRES_HOST=localhost
POSTGRES_DATABASE=vizdiff
POSTGRES_PASS=vizdiff_user_password
POSTGRES_PORT=5432
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=sk_live_stripesecretkey
STRIPE_WEBHOOK_SECRET=whsec_stripewebhooksecret
```

## Docker Compose Configuration

The workflow generates a `docker-compose.yml` file that:

1. Pulls the latest container images from ECR
2. Mounts the environment file into the containers
3. Configures appropriate port mappings
4. Sets up restart policies

## Manual Steps

After the initial setup, you may need to perform these steps manually on the EC2 instance:

1. Ensure Docker and Docker Compose are installed and `$EC2_USER` is in the docker group

## Troubleshooting

If the deployment fails, check:

1. GitHub Actions logs for error messages
2. Docker logs
3. Verify that all GitHub Secrets are properly set
4. Ensure the EC2 instance has sufficient permissions to pull from ECR
