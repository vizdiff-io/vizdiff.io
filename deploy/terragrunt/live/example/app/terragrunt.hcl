include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/deploy/terragrunt/modules/app"
}

# The app (helm_release) depends on rds, s3 and irsa. Terragrunt applies them
# first and feeds their outputs in below. The `depends_on` block makes the
# ordering explicit for `terragrunt run-all` even before outputs are read.
dependencies {
  paths = ["../rds", "../s3", "../irsa"]
}

dependency "rds" {
  config_path = "../rds"
  mock_outputs = {
    secret_arn = "arn:aws:secretsmanager:us-west-2:123456789012:secret:vizdiff/rds/credentials-mock"
    host       = "mock.rds.amazonaws.com"
    port       = 5432
    database   = "vizdiff"
    username   = "vizdiff"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

dependency "s3" {
  config_path = "../s3"
  mock_outputs = {
    bucket_name = "vizdiff-screenshots-mock"
    bucket_arn  = "arn:aws:s3:::vizdiff-screenshots-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

dependency "irsa" {
  config_path = "../irsa"
  mock_outputs = {
    role_arn  = "arn:aws:iam::123456789012:role/vizdiff-s3-mock"
    role_name = "vizdiff-s3-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

inputs = {
  release_name = "vizdiff"
  namespace    = "vizdiff"
  chart_path   = "${get_repo_root()}/deploy/helm/vizdiff"

  # REPLACE_ME: public URL + image settings.
  app_url        = "https://vizdiff.corp.example.com"
  image_registry = "ghcr.io/vizdiff-io"
  image_tag      = "" # empty => chart appVersion; CI sets this to the commit SHA

  service_account_name = "vizdiff"

  # Wired from sibling modules.
  rds_secret_arn = dependency.rds.outputs.secret_arn
  s3_bucket_name = dependency.s3.outputs.bucket_name
  s3_region      = "us-west-2"
  irsa_role_arn  = dependency.irsa.outputs.role_arn

  # Auth (OIDC / MSAL). REPLACE_ME with your IdP details.
  auth_provider  = "oidc"
  oidc_issuer    = "https://login.microsoftonline.com/REPLACE_ME_TENANT/v2.0"
  oidc_client_id = "REPLACE_ME_CLIENT_ID"
  # Secrets below should come from a secret manager / CI variable, NOT be
  # committed. Shown inline only to document the contract.
  oidc_client_secret = get_env("VIZDIFF_OIDC_CLIENT_SECRET", "")

  jwt_secret = get_env("VIZDIFF_JWT_SECRET", "")

  github_enabled = false

  # GITLAB_HOSTS JSON (per-host service tokens). Source from CI / secret store.
  gitlab_hosts_json     = get_env("VIZDIFF_GITLAB_HOSTS", "[]")
  gitlab_webhook_secret = get_env("VIZDIFF_GITLAB_WEBHOOK_SECRET", "")
}
