# Root Terragrunt configuration shared by every module in this environment.
#
# Replace the placeholder account ID / region / bucket names below with your
# real values (search for "REPLACE_ME"). This file wires remote state and the
# AWS + Helm providers so the per-module terragrunt.hcl files stay focused on
# inputs and dependencies.

locals {
  # ---- REPLACE_ME: environment-specific settings -------------------------
  aws_region     = "us-west-2"
  aws_account_id = "123456789012" # REPLACE_ME with your AWS account ID
  environment    = "example"

  # Remote state bucket + lock table (create these once, out of band).
  state_bucket     = "vizdiff-tfstate-REPLACE_ME" # REPLACE_ME, must be globally unique
  state_lock_table = "vizdiff-tflock"

  # EKS cluster the app is deployed to.
  eks_cluster_name = "vizdiff-REPLACE_ME" # REPLACE_ME
  # ------------------------------------------------------------------------
}

# Store state in S3 with DynamoDB locking, one key per module path.
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = local.state_bucket
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = local.state_lock_table
  }
}

# Generate the AWS provider for every module.
generate "provider_aws" {
  path      = "provider_aws.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"

  # Guardrail: refuse to apply against the wrong account.
  allowed_account_ids = ["${local.aws_account_id}"]

  default_tags {
    tags = {
      Project     = "vizdiff"
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}

# Generate the Helm provider (used only by the app module). Harmless elsewhere.
generate "provider_helm" {
  path      = "provider_helm.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
data "aws_eks_cluster" "this" {
  name = "${local.eks_cluster_name}"
}

data "aws_eks_cluster_auth" "this" {
  name = "${local.eks_cluster_name}"
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.this.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}
EOF
}

# Expose common locals to child configs.
inputs = {
  aws_region       = local.aws_region
  environment      = local.environment
  eks_cluster_name = local.eks_cluster_name
}
