# 387 — Implementation Work List
## CD: add image SHA probe to verify deployed containers match expected revision

**Issue type**: Feature (new pipeline step)
**Branch**: `feature/387-cd-add-image-sha-probe-to-verify-deployed-containers-match-expected-revision`

---

## Scope

Single file change — no spec, no RFC, no schema migration. Issue body is the authoritative spec.

**File to change**:
- [x] `.github/workflows/deploy.yml` — add `Verify deployed image SHAs` step after all four Deploy steps, before `Verify API health`

**No tests required**: GitHub Actions YAML cannot be unit-tested locally. CI run on the PR is the validation.

**No UI touched**: `uiValidationRequired = false`, `mobileValidationRequired = false`.

---

## Acceptance Criteria (from issue)

- [ ] After all four container deploys, each app's active image tag is asserted to match `github.sha` (or `workflow_run.head_sha`)
- [ ] Pipeline fails loudly (`exit 1`) if any app is running the wrong image
- [ ] Probe runs on `workflow_dispatch` (manual hotfix) path — satisfied by `if: steps.changes.outputs.build == 'true'` which evaluates true for dispatch
- [ ] Probe ordered: after all Deploy steps, before `Verify API health`

---

## Implementation Checklist

- [x] Add `Verify deployed image SHAs` step to `.github/workflows/deploy.yml`
  - Placement: after `Deploy Demo Storefront`, before `Verify API health`
  - Condition: `if: steps.changes.outputs.build == 'true'`
  - IMAGE_TAG: `${{ github.event.workflow_run.head_sha || github.sha }}` (consistent with build + deploy steps)
  - Apps: `customereq-api customereq-worker customereq-web customereq-demo`
  - Query: `az containerapp show --query "properties.template.containers[0].image" -o tsv`
  - Assertion: image ends with `:${IMAGE_TAG}`; collects all failures before `exit 1` (improved over issue body's fail-fast)

---

## Validation Requirements

- [ ] YAML lint passes (`yamllint` or GitHub Actions YAML validation)
- [ ] Logic review: IMAGE_TAG expression consistent with build/deploy steps
- [ ] Logic review: probe covers all 4 apps (api, worker, web, demo)
- [ ] Logic review: `workflow_dispatch` path covered
- [ ] pnpm build + typecheck + lint pass (no JS/TS changes, but CI gate required)
- [ ] PR created and CI triggered — no runtime validation possible locally

---

## Deferrals / Open Questions

- Migration gate (#386): not yet visible in `deploy.yml`; probe will be placed after all Deploy steps regardless. If #386 adds a migration step before this PR merges, the ordering will need a rebase check.
- Canary API checks (#388): future issue; SHA probe will be placed before `Verify API health` as a stable anchor point for #388 to follow.
