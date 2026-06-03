variable "bucket_name" {
  description = "Globally-unique S3 bucket name for screenshots/artifacts."
  type        = string
}

variable "force_destroy" {
  description = "Allow Terraform to delete a non-empty bucket on destroy."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to the bucket."
  type        = map(string)
  default     = {}
}
