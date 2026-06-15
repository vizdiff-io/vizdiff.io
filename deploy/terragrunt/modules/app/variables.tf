variable "release_name" {
  type    = string
  default = "vizdiff"
}

variable "namespace" {
  type    = string
  default = "vizdiff"
}

variable "create_namespace" {
  type    = bool
  default = true
}

variable "chart_path" {
  description = "Path to the Helm chart (deploy/helm/vizdiff). Resolved relative to the live/<env>/app dir by Terragrunt."
  type        = string
}

variable "image_registry" {
  type    = string
  default = "ghcr.io/vizdiff-io"
}

variable "image_tag" {
  description = "Global image tag (e.g. CI_COMMIT_SHA). Empty => chart appVersion."
  type        = string
  default     = ""
}

variable "app_url" {
  description = "Public URL the app is served from."
  type        = string
}

variable "service_account_name" {
  description = "ServiceAccount name (must match the IRSA binding)."
  type        = string
  default     = "vizdiff"
}

# --- rds module outputs ---
variable "rds_secret_arn" {
  description = "Secrets Manager ARN holding the RDS credentials JSON."
  type        = string
}

# --- s3 module outputs ---
variable "s3_bucket_name" {
  type = string
}

variable "s3_region" {
  type = string
}

# --- irsa module output ---
variable "irsa_role_arn" {
  description = "IAM role ARN to annotate the ServiceAccount with."
  type        = string
}

# --- auth ---
variable "auth_provider" {
  type    = string
  default = "oidc"
}

variable "oidc_issuer" {
  type    = string
  default = ""
}

variable "oidc_client_id" {
  type    = string
  default = ""
}

variable "oidc_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

# --- secrets ---
variable "jwt_secret" {
  description = "JWT signing secret (32+ chars). Inject from Secrets Manager / CI, not committed."
  type        = string
  sensitive   = true
}

variable "gitlab_hosts_json" {
  description = "GITLAB_HOSTS JSON array (per-host service tokens)."
  type        = string
  default     = "[]"
  sensitive   = true
}

variable "gitlab_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "github_enabled" {
  type    = bool
  default = false
}

variable "extra_values" {
  description = "Optional extra Helm values YAML appended last (overrides)."
  type        = string
  default     = ""
}
