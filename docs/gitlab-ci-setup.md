# GitLab CI Integration Guide

This guide explains how to integrate VizDiff with GitLab CI for automated visual regression testing of your Storybook components.

## Overview

VizDiff captures screenshots of your Storybook components on every commit and merge request, comparing them against baseline images to detect visual changes. When integrated with GitLab CI:

- Screenshots are captured automatically on each pipeline run
- Visual diffs are reported as commit statuses on GitLab
- Merge requests show VizDiff status before merging

## Prerequisites

- VizDiff instance (self-hosted or vizdiff.io)
- GitLab project with Storybook configured
- GitLab CI/CD enabled for your project

## Step 1: Create GitLab OAuth Application

VizDiff needs OAuth access to post commit statuses and access your repositories.

1. Go to GitLab **User Settings > Applications**
   - URL: https://gitlab.com/-/user_settings/applications
   - For self-hosted: `https://YOUR_GITLAB_HOST/-/user_settings/applications`

2. Create a new application with these settings:
   - **Name**: `VizDiff` (or your preferred name)
   - **Redirect URI**: `https://YOUR_VIZDIFF_DOMAIN/api/auth/gitlab/callback`
   - **Confidential**: Yes (checked)
   - **Scopes**: Select these:
     - `read_user` - Read user profile information
     - `read_api` - Read API access for groups and projects
     - `read_repository` - Read repository content

3. Click **Save application**

4. Copy and securely store:
   - **Application ID** (this is your `GITLAB_CLIENT_ID`)
   - **Secret** (this is your `GITLAB_CLIENT_SECRET`)

## Step 2: Configure VizDiff Environment

Add these environment variables to your VizDiff instance:

```bash
# GitLab OAuth Configuration
GITLAB_HOST=https://gitlab.com                    # Or your self-hosted GitLab URL
GITLAB_CLIENT_ID=your_application_id              # From Step 1
GITLAB_CLIENT_SECRET=your_application_secret      # From Step 1
GITLAB_WEBHOOK_SECRET=generate_a_random_secret    # Any secure random string

# For self-hosted GitLab with self-signed certificates (optional)
GITLAB_REJECT_UNAUTHORIZED=false

# Frontend environment variables
NEXT_PUBLIC_GITLAB_APP_NAME=VizDiff
NEXT_PUBLIC_GITLAB_CLIENT_ID=your_application_id
NEXT_PUBLIC_GITLAB_HOST=https://gitlab.com
```

After updating environment variables, restart your VizDiff services.

## Step 3: Sign In and Create a Project

1. Visit your VizDiff instance and click **Sign in with GitLab**
2. Authorize the OAuth application when prompted
3. Navigate to **Projects** and click **New Project**
4. Select your GitLab group and project from the list
5. Copy the **Project Token** from the project settings (you'll need this for CI)

## Step 4: Configure GitLab CI

Add the following `.gitlab-ci.yml` to your repository:

```yaml
# .gitlab-ci.yml - VizDiff Visual Testing Integration

stages:
  - build
  - test

variables:
  # These are configured in GitLab CI/CD Settings > Variables
  # VIZDIFF_API_URL: https://your-vizdiff-instance.com
  # VIZDIFF_PROJECT_TOKEN: your-project-token

# Build Storybook
build-storybook:
  stage: build
  image: node:20-alpine
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .yarn/cache/
  script:
    - npm ci --prefer-offline
    - npm run build-storybook
  artifacts:
    paths:
      - storybook-static/
    expire_in: 1 hour
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Upload to VizDiff
vizdiff:
  stage: test
  image: alpine:latest
  needs: [build-storybook]
  before_script:
    - apk add --no-cache curl tar gzip
  script:
    - tar -czf storybook.tar.gz storybook-static/
    - |
      echo "Uploading Storybook to VizDiff..."
      
      RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${VIZDIFF_API_URL}/api/upload/storybook?token=${VIZDIFF_PROJECT_TOKEN}" \
        -H "Content-Type: application/gzip" \
        -H "x-vizdiff-commit-sha: ${CI_COMMIT_SHA}" \
        -H "x-vizdiff-branch: ${CI_COMMIT_REF_NAME}" \
        ${CI_MERGE_REQUEST_IID:+-H "x-vizdiff-pr-number: ${CI_MERGE_REQUEST_IID}"} \
        ${CI_MERGE_REQUEST_DIFF_BASE_SHA:+-H "x-vizdiff-base-commit-sha: ${CI_MERGE_REQUEST_DIFF_BASE_SHA}"} \
        ${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:+-H "x-vizdiff-base-branch: ${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}"} \
        --data-binary @storybook.tar.gz)
      
      HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
      BODY=$(echo "$RESPONSE" | sed '$d')
      
      echo "Response: $BODY"
      echo "HTTP Status: $HTTP_CODE"
      
      if [ "$HTTP_CODE" -ge 400 ]; then
        echo "ERROR: Upload failed with status $HTTP_CODE"
        exit 1
      fi
      
      echo "Upload successful! VizDiff will process screenshots and update commit status."
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Step 5: Set CI/CD Variables

In your GitLab project, go to **Settings > CI/CD > Variables** and add:

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `VIZDIFF_API_URL` | `https://your-vizdiff-instance.com` | Optional | No |
| `VIZDIFF_PROJECT_TOKEN` | Your project token from Step 3 | Yes | Yes |

## Step 6: Configure Webhook (Optional)

Webhooks enable real-time notifications when commits are pushed or merge requests are created. While not required (VizDiff can work with just CI uploads), webhooks improve the user experience.

1. Go to your GitLab project: **Settings > Webhooks**
2. Add a new webhook:
   - **URL**: `https://YOUR_VIZDIFF_DOMAIN/api/webhooks/gitlab`
   - **Secret token**: Same value as your `GITLAB_WEBHOOK_SECRET`
   - **Trigger events**: Select:
     - Push events
     - Merge request events
   - **SSL verification**: Enable (unless using self-signed certificates)
3. Click **Add webhook**

## GitLab CI Variables Reference

These GitLab CI predefined variables are used by VizDiff:

| VizDiff Header | GitLab CI Variable | Description |
|----------------|-------------------|-------------|
| `x-vizdiff-commit-sha` | `CI_COMMIT_SHA` | The commit SHA being tested |
| `x-vizdiff-branch` | `CI_COMMIT_REF_NAME` | Branch or tag name |
| `x-vizdiff-pr-number` | `CI_MERGE_REQUEST_IID` | Merge request ID (MR pipelines only) |
| `x-vizdiff-base-commit-sha` | `CI_MERGE_REQUEST_DIFF_BASE_SHA` | Base commit for comparison (MR pipelines only) |
| `x-vizdiff-base-branch` | `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` | Target branch (MR pipelines only) |

## Viewing Results

After a successful upload:

1. **GitLab Commit Status**: VizDiff posts a commit status that appears:
   - On the commit page
   - In merge request widgets
   - In pipeline views

2. **VizDiff Dashboard**: View detailed results at:
   - `https://YOUR_VIZDIFF_DOMAIN/build?id=BUILD_ID`
   - Click the commit status link to go directly to the build

3. **Approval Workflow**: If visual changes are detected:
   - Review changes in the VizDiff UI
   - Approve or reject changes
   - Commit status updates automatically

## Troubleshooting

### Upload fails with 401 Unauthorized

- Verify `VIZDIFF_PROJECT_TOKEN` is correct
- Check the token hasn't expired
- Ensure the token is properly masked in CI/CD variables

### Upload fails with 404 Not Found

- Verify `VIZDIFF_API_URL` is correct and accessible
- Check for typos in the URL

### No commit status appears on GitLab

- Ensure the user who created the VizDiff project has permission to post commit statuses
- Check VizDiff logs for GitLab API errors
- Verify the OAuth token hasn't expired (re-authenticate if needed)

### Storybook build fails

- Ensure `npm run build-storybook` works locally
- Check that all Storybook dependencies are in `package.json`
- Verify the `storybook-static/` output directory matches your configuration

### Self-hosted GitLab connection issues

- Set `GITLAB_REJECT_UNAUTHORIZED=false` for self-signed certificates
- Verify network connectivity between VizDiff and your GitLab instance
- Check that the GitLab URL doesn't have a trailing slash

## Advanced Configuration

### Custom Storybook Output Directory

If your Storybook outputs to a different directory:

```yaml
script:
  - npm run build-storybook -- -o custom-output/
  - tar -czf storybook.tar.gz custom-output/
```

### Yarn/pnpm Support

For Yarn:
```yaml
script:
  - yarn install --frozen-lockfile
  - yarn build-storybook
```

For pnpm:
```yaml
script:
  - pnpm install --frozen-lockfile
  - pnpm build-storybook
```

### Monorepo Configuration

If Storybook is in a subdirectory:

```yaml
build-storybook:
  script:
    - cd packages/ui
    - npm ci
    - npm run build-storybook
  artifacts:
    paths:
      - packages/ui/storybook-static/
```

### Conditional Execution

Run VizDiff only for specific paths:

```yaml
vizdiff:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - "src/components/**/*"
        - "src/stories/**/*"
        - ".storybook/**/*"
```

## Support

- Documentation: https://vizdiff.io/docs
- Issues: Contact your VizDiff administrator
