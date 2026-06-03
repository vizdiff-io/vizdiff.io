variable "name" {
  description = "Name prefix / IAM role name for the IRSA role."
  type        = string
  default     = "vizdiff-s3"
}

variable "oidc_provider_arn" {
  description = "ARN of the EKS cluster's IAM OIDC provider."
  type        = string
}

variable "oidc_provider_url" {
  description = "URL of the EKS cluster's IAM OIDC provider (no https:// prefix), e.g. oidc.eks.us-west-2.amazonaws.com/id/ABCDEF."
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace the ServiceAccount lives in."
  type        = string
  default     = "vizdiff"
}

variable "service_account_name" {
  description = "Name of the chart ServiceAccount to bind (matches Helm vizdiff.serviceAccountName)."
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket the role may access."
  type        = string
}

variable "tags" {
  description = "Tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
