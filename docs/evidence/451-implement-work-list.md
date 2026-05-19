# Issue #451 — Implement Work List

## Scope

- Type: bug
- Goal: restore the intended `CI on main -> deploy on main` chain and remove Azure Container Registry remote builds' dependence on anonymous Docker Hub pulls for the Node base image.

## Implementation Checklist

- [ ] `.github/workflows/ci.yml` — add `push` trigger for `main` so `deploy.yml`'s `workflow_run` path can actually fire.
- [ ] `.github/workflows/deploy.yml` — mirror/import `node:22-slim` into ACR before image builds and pass the mirrored base image into each deploy build.
- [ ] `Dockerfile.api` — make the Node base image configurable via build arg while preserving the existing local default.
- [ ] `Dockerfile.worker` — make the Node base image configurable via build arg while preserving the existing local default.
- [ ] `Dockerfile.web` — make the Node base image configurable via build arg while preserving the existing local default.
- [ ] `Dockerfile.demo-storefront` — make the Node base image configurable via build arg while preserving the existing local default.
- [ ] `Dockerfile.turbo-cache` — make the Node base image configurable via build arg while preserving the existing local default.
- [ ] `docs/architecture/architecture.md` — update the CD pipeline section to document the ACR-mirrored Node base image and the restored `main` CI trigger.

## Pattern Notes

- Deploys currently build each image separately with `az acr build`.
- Dockerfiles currently hardcode `FROM node:22-slim`.
- CI local image validation uses standard `docker/build-push-action` and should keep working without requiring private ACR auth.
- Deploy workflow already distinguishes `workflow_run` vs `workflow_dispatch`; the Node mirror fix should work for both paths.

## Validation Requirements

- `uiValidationRequired: false`
- `mobileValidationRequired: false`
- Required automated validation:
  - run the relevant workflow syntax/behavior checks via GitHub Actions on the fix branch
  - merge to `main`
  - confirm `CI` runs on the merged `main` commit
  - confirm downstream `Deploy to Azure Container Apps` runs from `workflow_run`
  - confirm deploy completes successfully

## Open Questions / Risks

- `az acr import` must succeed reliably enough from Azure's side to avoid recreating the same Docker Hub bottleneck.
- The merged commit must be used for both the automatic `workflow_run` path and any manual recovery dispatches.
