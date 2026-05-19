# Feature: Remove Docker Hub from deploy-time builds and align demo deploy verification
Issue: #453
PR: TBD

## Reproduction Evidence

### Bug 1: deploy-time base image import still depends on Docker Hub

- Failed automatic prod deploy run: `26117659178`
- Failed job: `build-and-deploy`
- Failed step: `Mirror Node base image into ACR`

Observed failure from `gh run view 26117659178 --log-failed`:

```text
az acr import \
  --name customereqcr \
  --source docker.io/library/node:22-slim \
  --image base-images/node:22-slim \
  --force
...
StatusCode: 429, Reason: Too Many Requests
TOOMANYREQUESTS: You have reached your unauthenticated pull rate limit
```

Root-cause conclusion:

- Issue #451 restored the `CI -> workflow_run deploy` chain, but its ACR import step still performed an unauthenticated Docker Hub pull at deploy time.
- That means the deploy path remained vulnerable to the same Docker Hub rate limit that had already failed the prior worker-image build run `26115093500`.

### Bug 2: non-demo deploys still verify `customereq-demo` unconditionally

Current workflow shape before this fix:

- `Determine if deploy is needed` computes `steps.changes.outputs.demo_build`
- `Build and push Demo Storefront image` only runs when `demo_build == 'true'`
- `Deploy Demo Storefront` only runs when `demo_build == 'true'`
- `Verify deployed image SHAs` still checked `customereq-demo` on every non-doc deploy

That mismatch means a core-only prod change can successfully deploy API / worker / web and still fail the verification step because the demo image was intentionally left on its previous SHA.

## Implementation Checklist Status

- [x] `.github/workflows/deploy.yml` - remove deploy-time `az acr import` from Docker Hub
- [x] `.github/workflows/deploy.yml` - pass a Microsoft-hosted `NODE_IMAGE` into each deploy-time ACR build
- [x] `.github/workflows/deploy.yml` - scope image verification to the apps rebuilt in the current run
- [x] `docs/architecture/architecture.md` - update the CD pipeline description

## Validation Notes

- Local repository validation for this issue is necessarily workflow-centric; there is no in-repo unit-test harness for GitHub Actions execution.
- The authoritative validation for this fix is the next merged `main` run sequence:
  - `CI` on the merge commit
  - downstream `Deploy to Azure Container Apps`
  - successful completion of the deploy workflow
