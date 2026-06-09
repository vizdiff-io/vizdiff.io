# vizdiff GitLab CI examples

This directory contains a drop-in template that downstream projects can use to
upload a Storybook build to a **self-hosted vizdiff** instance for visual
regression testing from GitLab CI.

- [`gitlab-ci-consumer.yml`](./gitlab-ci-consumer.yml) — a ready-to-use job
  definition. Copy it into your project's `.gitlab-ci.yml`, or `include:` it.

## How it works

The job builds a static Storybook, installs the vizdiff CLI, and runs
`vizdiff upload`. The CLI auto-detects GitLab's predefined CI variables, so you
only have to provide a project token and the API URL. It reads:

| Variable                              | Used for                                   |
| ------------------------------------- | ------------------------------------------ |
| `CI_COMMIT_SHA`                       | the commit being tested                    |
| `CI_COMMIT_REF_NAME`                  | branch name                                |
| `CI_DEFAULT_BRANCH`                   | which branch holds the baseline            |
| `CI_MERGE_REQUEST_IID`                | the MR to post the diff status back to     |
| `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` | the MR's target (baseline) branch          |

This means the same template works for both **push/branch pipelines** and
**merge-request pipelines** with no extra configuration — the consumer file
defines a job for each case.

## Setup

### 1. Get a project token

In your self-hosted vizdiff UI, open (or create) the project for this repo and
copy its **project token** from the project settings. This token authorizes
uploads for that one project.

### 2. Set the CI/CD variables

In your downstream GitLab project, go to **Settings → CI/CD → Variables** and add:

| Variable                | Value                                      | Flags             |
| ----------------------- | ------------------------------------------ | ----------------- |
| `VIZDIFF_PROJECT_TOKEN` | the project token from step 1              | **Masked**, Protected |
| `VIZDIFF_API_URL`       | your vizdiff ingress, e.g. `https://vizdiff.corp.example.com` | (plain)           |

Masking secrets:

- Tick **Masked** on `VIZDIFF_PROJECT_TOKEN` so it is hidden in job logs.
  (GitLab requires masked values to be a single line and meet its complexity
  rules; project tokens already satisfy this.)
- Consider also marking it **Protected** so it is only exposed to pipelines on
  protected branches/tags if your baseline lives on a protected branch.
- `VIZDIFF_API_URL` is not a secret and can be left unmasked.

### 3. Add the job

Copy `gitlab-ci-consumer.yml` into your project (or `include:` it):

```yaml
include:
  - project: "your-group/vizdiff-ci-templates"
    file: "/gitlab-ci-consumer.yml"
```

Adjust the `before_script` (package manager / install steps) and the
`build-storybook` command and output directory to match your project.

## Notes

- The CLI is published as `@vizdiff/cli`; the template installs it with
  `npm install -g @vizdiff/cli`. Pin a version (e.g. `@vizdiff/cli@1.2.3`) for
  reproducible builds.
- Uploads on your default branch establish/refresh the baseline; uploads on
  feature branches and merge requests are compared against it and the result is
  reported back to the merge request.
