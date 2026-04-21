# Implementation Work List — Issue #166

Target: `.github/workflows/deploy.yml` — two independent gaps.

## Issue Type

**feature** (CI/CD hardening)

## Validation Requirements

- `uiValidationRequired`: **no** (YAML only; no UI surface)
- `mobileValidationRequired`: **no**
- Runtime testing: **not possible in a PR** — workflow behavior is proven by triggering actual pushes / double-pushes after merge. Pre-merge validation is limited to YAML lint + the exact snippets from the issue body + a careful read of GitHub's `workflow_run` / `concurrency` semantics.

## Scope

### 1. Gate `deploy.yml` on `ci.yml` success

- [ ] Change `on` trigger from `push: [main]` to `workflow_run: { workflows: [CI], types: [completed], branches: [main] }` (keep `workflow_dispatch` for manual hotfixes).
- [ ] Add job-level `if` so the deploy only runs when CI succeeded OR the workflow was manually dispatched:
  ```yaml
  if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
  ```
- [ ] Swap every `${{ github.sha }}` reference to `${{ github.event.workflow_run.head_sha || github.sha }}`. Rationale: under `workflow_run`, `github.sha` resolves to the default branch tip at dispatch time, not the commit that CI ran against. `head_sha` is the CI-tested commit. Fallback to `github.sha` preserves `workflow_dispatch` semantics. Six occurrences to update:
  - API build tag (line ~37)
  - Worker build tag (line ~44)
  - Web build tag (line ~52)
  - API deploy image (line ~64)
  - Worker deploy image (line ~70)
  - Web deploy image (line ~77)
- [ ] Pass `ref: ${{ github.event.workflow_run.head_sha || github.sha }}` to `actions/checkout@v4` so the workspace matches the CI-tested commit.

### 2. Add concurrency control

- [ ] Add a workflow-level `concurrency` block:
  ```yaml
  concurrency:
    group: deploy-prod
    cancel-in-progress: false
  ```
  `cancel-in-progress: false` is deliberate per the issue body — every merged commit should still deploy, just in sequence, not racing.

## Files

- `.github/workflows/deploy.yml` — all changes.

## Deferrals

- `workflow_run` trigger + gate behavior cannot be fully exercised in a PR's own CI run (the PR's CI on its feature branch doesn't trigger `deploy.yml` because `workflow_run.branches: [main]` filters to the default branch). Post-merge, the first push will exercise the new flow.
- Fast-forward verification for concurrency needs a back-to-back push after merge. Not something I can prove in the PR itself.

## Validation plan

- `yamllint` (or equivalent) — local sanity check.
- Manual review of `github.event.workflow_run.head_sha` semantics against GitHub docs.
- Merge-then-observe test plan (in PR description): after merge, push two trivial commits and watch the second deploy run queue instead of race.
