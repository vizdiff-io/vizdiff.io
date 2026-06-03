variable "name" {
  description = "Name prefix for RDS resources."
  type        = string
  default     = "vizdiff"
}

variable "vpc_id" {
  description = "VPC to place the DB and its security group in."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the DB subnet group (private subnets recommended)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to reach Postgres (e.g. EKS node group SG)."
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach Postgres (e.g. the VPC/pod CIDR)."
  type        = list(string)
  default     = []
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "vizdiff"
}

variable "username" {
  description = "Master username."
  type        = string
  default     = "vizdiff"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "Allocated storage in GiB."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Upper bound for storage autoscaling in GiB."
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Enable Multi-AZ for production durability."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Protect the instance from accidental deletion."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
