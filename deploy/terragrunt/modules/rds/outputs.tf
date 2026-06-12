output "host" {
  description = "RDS endpoint hostname."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "RDS port."
  value       = aws_db_instance.this.port
}

output "database" {
  description = "Initial database name."
  value       = var.db_name
}

output "username" {
  description = "Master username."
  value       = var.username
}

output "secret_arn" {
  description = "Secrets Manager ARN holding host/port/database/username/password JSON."
  value       = aws_secretsmanager_secret.db.arn
}

output "security_group_id" {
  description = "Security group attached to the DB."
  value       = aws_security_group.this.id
}
