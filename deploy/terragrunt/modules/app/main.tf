terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.12"
    }
  }
}

# Pull the RDS connection details out of Secrets Manager so the database
# host/password never has to be passed through Terragrunt inputs in plaintext.
data "aws_secretsmanager_secret_version" "rds" {
  secret_id = var.rds_secret_arn
}

locals {
  rds = jsondecode(data.aws_secretsmanager_secret_version.rds.secret_string)
}

resource "helm_release" "vizdiff" {
  name             = var.release_name
  namespace        = var.namespace
  create_namespace = var.create_namespace
  chart            = var.chart_path

  # Render chart values from the wired module outputs + secrets.
  values = [
    yamlencode({
      appUrl = var.app_url

      image = {
        registry = var.image_registry
        tag      = var.image_tag
      }

      auth = {
        provider = var.auth_provider
        oidc = {
          issuer       = var.oidc_issuer
          clientId     = var.oidc_client_id
          clientSecret = var.oidc_client_secret
        }
      }

      github = {
        enabled = var.github_enabled
      }

      gitlab = {
        webhookSecret = var.gitlab_webhook_secret
      }

      # Production: use external RDS + real S3, no embedded services.
      postgres = {
        embedded = false
        host     = local.rds.host
        port     = local.rds.port
        database = local.rds.database
        user     = local.rds.username
        password = local.rds.password
      }

      s3 = {
        bucketName = var.s3_bucket_name
        region     = var.s3_region
        minio = {
          enabled = false
        }
      }

      secrets = {
        create    = true
        jwtSecret = var.jwt_secret
      }

      serviceAccount = {
        create = true
        name   = var.service_account_name
        annotations = {
          "eks.amazonaws.com/role-arn" = var.irsa_role_arn
        }
      }
    }),

    # GITLAB_HOSTS is a JSON string of an array; render it as a literal so the
    # chart stores it verbatim in the Secret.
    yamlencode({
      gitlab = {
        hosts = jsondecode(var.gitlab_hosts_json)
      }
    }),

    var.extra_values,
  ]
}
