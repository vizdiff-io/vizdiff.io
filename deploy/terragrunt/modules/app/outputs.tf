output "release_name" {
  value = helm_release.vizdiff.name
}

output "namespace" {
  value = helm_release.vizdiff.namespace
}

output "status" {
  value = helm_release.vizdiff.status
}
