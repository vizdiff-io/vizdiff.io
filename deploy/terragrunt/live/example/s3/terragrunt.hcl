include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/deploy/terragrunt/modules/s3"
}

inputs = {
  # REPLACE_ME: globally-unique bucket name. Bucket is PRIVATE (block public
  # access). Serving screenshots via presigned URLs is a flagged follow-up.
  bucket_name = "vizdiff-screenshots-REPLACE_ME"
}
