include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/deploy/terragrunt/modules/irsa"
}

# IRSA depends on the S3 bucket ARN.
dependency "s3" {
  config_path = "../s3"

  # Allow plan/validate before s3 is applied.
  mock_outputs = {
    bucket_name = "vizdiff-screenshots-mock"
    bucket_arn  = "arn:aws:s3:::vizdiff-screenshots-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
}

inputs = {
  name                 = "vizdiff-s3"
  namespace            = "vizdiff"
  service_account_name = "vizdiff"
  bucket_arn           = dependency.s3.outputs.bucket_arn

  # REPLACE_ME: from your EKS cluster's IAM OIDC provider.
  #   aws eks describe-cluster --name <cluster> --query 'cluster.identity.oidc.issuer'
  # gives https://oidc.eks.<region>.amazonaws.com/id/XXXX; strip the scheme for
  # oidc_provider_url, and find the provider ARN in IAM > Identity providers.
  oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-west-2.amazonaws.com/id/REPLACE_ME"
  oidc_provider_url = "oidc.eks.us-west-2.amazonaws.com/id/REPLACE_ME"
}
