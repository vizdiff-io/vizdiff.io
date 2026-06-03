include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/deploy/terragrunt/modules/rds"
}

inputs = {
  name = "vizdiff"

  # REPLACE_ME: networking from your VPC.
  vpc_id     = "vpc-REPLACE_ME"
  subnet_ids = ["subnet-REPLACE_ME_A", "subnet-REPLACE_ME_B"]

  # Allow the EKS node/pod security group to reach Postgres.
  allowed_security_group_ids = ["sg-REPLACE_ME_EKS_NODES"]

  db_name        = "vizdiff"
  username       = "vizdiff"
  instance_class = "db.t3.medium"
  multi_az       = false

  # Keep deletion protection on for anything you care about.
  deletion_protection = true
}
