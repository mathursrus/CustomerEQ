# Issue #453 - Implement Work List

## Scope

- Type: bug
- Goal: remove the remaining Docker Hub dependency from deploy-time image builds and keep the deploy verification path aligned with the demo storefront's conditional rebuild behavior.

## Implementation Checklist

- [x] `.github/workflows/deploy.yml` - remove the `az acr import` step, switch deploy-time `NODE_IMAGE` to a Microsoft-hosted image, and keep all `az acr build` invocations pointed at that deploy-only base.
- [x] `.github/workflows/deploy.yml` - make the deployed-image verification step conditional on whether the demo storefront was rebuilt so non-demo commits do not fail after a successful core deploy.
- [x] `docs/architecture/architecture.md` - update the CD pipeline section to document the Microsoft-hosted deploy-time base image and the conditional demo verification behavior.

## Pattern Notes

- Dockerfiles already accept `ARG NODE_IMAGE=node:22-slim`, so deploy can swap the base image without changing local or PR builds.
- `deploy.yml` already computes `steps.changes.outputs.demo_build`; downstream deploy verification should consume the same flag rather than duplicating its own change detection logic.
- The deploy workflow runs on both automatic `workflow_run` and manual `workflow_dispatch`; the base-image override must keep both paths equivalent.

## Validation Requirements

- `uiValidationRequired: false`
- `mobileValidationRequired: false`
- Required automated validation:
  - merge the fix to `main`
  - confirm `CI` runs automatically on the merged `main` commit
  - confirm downstream `Deploy to Azure Container Apps` runs from `workflow_run`
  - confirm deploy reaches a successful completion on the merged fix commit

## Open Questions / Risks

- The selected Microsoft-hosted image must remain compatible with the existing Debian-based runtime expectations in the Dockerfiles.
- Any deploy path that skips the demo storefront must keep verification scoped to the apps actually rebuilt in that run.
