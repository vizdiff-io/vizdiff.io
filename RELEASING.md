# Releasing

vizdiff is released as versioned, multi-arch container images on GHCR plus a GitHub Release. The
**git tag is the single source of truth** for the product version (one semver for all three images
and the Helm chart). Releases are cut manually by pushing a `vX.Y.Z` tag.

## What a release produces

Pushing a `vX.Y.Z` tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. Builds `api`, `worker`, and `frontend` multi-arch (amd64 + arm64) with `VIZDIFF_VERSION=X.Y.Z`
   baked in (so the running services report their version via `GET /api/version`).
2. Publishes each image to GHCR tagged `:X.Y.Z`, `:X.Y`, `:X`, and `:latest`
   (`ghcr.io/vizdiff-io/vizdiff-{api,worker,frontend}`). `:latest` always points at the newest
   release; the `main` branch publishes `:edge` instead.
3. Creates the GitHub Release with auto-generated, categorized notes
   ([`.github/release.yml`](.github/release.yml)) plus "what do I run" instructions.

## Cutting a release

1. **Pick the version** `X.Y.Z` (semver). The first release is `1.0.0`.
2. **Bump the Helm chart** in [`deploy/helm/vizdiff/Chart.yaml`](deploy/helm/vizdiff/Chart.yaml):
   set `appVersion: "X.Y.Z"` (this is the default image tag the chart pulls) and bump `version`
   (the chart's own semver). Commit to `main`.
3. **Tag and push** at that commit:
   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
4. **Verify** the `Release` workflow succeeds: the version manifests exist
   (`docker buildx imagetools inspect ghcr.io/vizdiff-io/vizdiff-api:X.Y.Z` shows amd64 + arm64) and
   the GitHub Release was created.

The label categories in the auto-generated notes come from PR labels (Features / Fixes / Dependencies
/ Other). There is no tracked `CHANGELOG.md` — the GitHub Releases page is the canonical changelog.

## Pre-release / dry run

Tags like `vX.Y.Z` are required (the workflow validates `^vMAJOR.MINOR.PATCH$`). To rehearse without
affecting `:latest`, push a throwaway tag and delete the resulting images/release afterward, or test
on a fork. (Pre-release suffixes such as `-rc.1` are not matched by the current trigger; add them to
the `tags:` glob and version regex if needed.)
