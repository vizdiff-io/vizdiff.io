output "role_arn" {
  description = "IAM role ARN to set on the chart ServiceAccount (eks.amazonaws.com/role-arn)."
  value       = aws_iam_role.this.arn
}

output "role_name" {
  description = "IAM role name."
  value       = aws_iam_role.this.name
}
