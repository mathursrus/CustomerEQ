# Implementation Evidence — Issue #166

**Branch**: `feature/166-ci-cd-deploy-yml-can-deploy-broken-builds-and-races-with-itself` (off `main`)
**Scope**: CI/CD hardening of `.github/workflows/deploy.yml` — add CI-success gate + concurrency control.
**Work list**: `docs/evidence/166-implement-work-list.md`

## Files Changed

| File | Change |
| :--- | :--- |
| `.github/workflows/deploy.yml` | Replaced `on.push` trigger with `on.workflow_run` (workflows=[CI], types=[completed], branches=[main]); added `workflow_dispatch` preserve; added workflow-level `concurrency` block (`deploy-prod`, `cancel-in-progress: false`); added job-level `if` gating on CI-success OR workflow_dispatch; updated 7 commit-SHA references (1 checkout `ref`, 6 image tags) to `github.event.workflow_run.head_sha || github.sha` so builds target the CI-tested commit. |

## Validation Results

| Check | Result |
| :--- | :--- |
| YAML parse (js-yaml) | **PASS** — structural fields verified |
| `on.workflow_run.workflows` | `[CI]` (matches `ci.yml`'s `name: CI`) |
| `on.workflow_run.branches` | `[main]` — only main-branch CI runs trigger deploy |
| `concurrency.group` | `deploy-prod` |
| `concurrency.cancel-in-progress` | `false` (queue, don't cancel) |
| `jobs.build-and-deploy.if` | `${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}` |
| Checkout `ref` | `${{ github.event.workflow_run.head_sha || github.sha }}` |
| All 6 image tags | Use the same head_sha fallback expression |

**Runtime validation deferred to post-merge** — `workflow_run` triggers and `concurrency` behavior can only be exercised by actual pushes to `main`. The PR body documents a back-to-back push test + a deliberate-typecheck-failure test for the new reviewer/maintainer to run.

## Feature Requirement Traceability Matrix

Source of truth: Issue #166 body (no RFC exists — this was a small CI/CD fix). Every acceptance criterion from the issue is mapped below.

| Requirement / AC (from Issue #166) | Implemented in | Proof | Status |
| :--- | :--- | :--- | :--- |
| **Broken Window 1, AC1**: `deploy.yml` runs only after `ci.yml` succeeds for the same commit SHA | `.github/workflows/deploy.yml:6–13` (`on.workflow_run` with `workflows: [CI]`, `branches: [main]`) + job-level `if` at line 29 | Post-merge: first push to `main` triggers CI; when CI finishes, `deploy.yml` fires under `workflow_run`. Pre-merge: YAML structurally verified via `js-yaml` (see `## Validation Results` above). | Met |
| **Broken Window 1, AC2**: A commit that fails `ci.yml` produces no deploy run | `jobs.build-and-deploy.if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}` | Post-merge: a deliberate-typecheck-failure commit should show CI fail + deploy job marked `skipped`. | Met (behavior verifiable only post-merge) |
| **Broken Window 1, AC3**: Manual `workflow_dispatch` on `deploy.yml` still works | `on.workflow_dispatch` preserved (line 13); job `if` includes `github.event_name == 'workflow_dispatch'` branch | Manual dispatch button stays visible in Actions tab; dispatching executes the deploy. | Met |
| **Broken Window 2, AC1**: Workflow-level `concurrency` block with `group: deploy-prod` and `cancel-in-progress: false` | `.github/workflows/deploy.yml:16–21` | `js-yaml` parse confirms `concurrency.group = 'deploy-prod'` and `concurrency.cancel-in-progress = false`. | Met |
| **Broken Window 2, AC2**: Double-push test — second deploy queues instead of races | (same `concurrency` block) | Post-merge verification: push two trivial commits back-to-back; the second deploy run appears `pending` until the first finishes, then executes. | Met (behavior verifiable only post-merge) |

**Result**: All five ACs Met. Two have proof deferred to post-merge because GitHub Actions' `workflow_run` + `concurrency` semantics can only be exercised by real main-branch pushes.

### Technical Design Traceability Matrix

No RFC was authored for #166 (it's a two-line-per-gap YAML change with concrete snippets in the issue body, explicitly called out in the issue as "small fixes with concrete repros"). The issue body itself is the design source of truth. The Feature Requirement Traceability Matrix above fully covers all design commitments.

### Feedback Verification

No `docs/evidence/166-feature-implementation-feedback.md` file exists — no human or quality feedback has been received yet (pre-review). Empty = all addressed.

## Security Review

### Executive Summary

- **Findings**: 0 Critical, 0 High, 0 Medium, 0 Low.
- **Auth/crypto touched**: No.
- **Disposition**: all applicable categories `Pass` or `N/A`.
- **Next action**: proceed to submission.

### Review Scope

- `reviewType`: `embedded-diff-review`
- `reviewScope`: `diff`
- Surface paths reviewed:
  - `.github/workflows/deploy.yml`
  - `docs/evidence/166-implement-work-list.md`
  - `docs/evidence/166-feature-implementation-evidence.md` (this file)

### Threat Surface Summary

The closed-set classifier (`web`, `api`, `llm-app`, `data-pipeline`, `mobile`, `capability-authoring`, `docs-only`) matches **none** of my files:

- `deploy.yml` is a GitHub Actions workflow — not web/api/mobile source and not under a capability-authoring tree.
- The evidence/work-list markdown files are implementation tracking, not capability authoring (not skills/jobs/rules/retrospectives).

So `surfaces: []`. The framework guidance is to mark categories N/A, which I do below. But because the change is a GHA workflow, I also reviewed the specific GHA-relevant security concerns explicitly, not by the closed-set heuristic.

### Coverage Matrix

| Category | Status | Notes |
| :--- | :--- | :--- |
| OWASP Web / API / LLM Top 10 | **N/A** | No code surface touched. |
| `secrets-in-code-check` | **Pass** | No secrets added. All `${{ secrets.* }}` references (AZURE_CLIENT_ID / TENANT_ID / SUBSCRIPTION_ID / CLERK_PUBLISHABLE_KEY) were present before this change; I did not add or modify any. |
| `privacy-and-pii-review` | **N/A** | No PII flows. |
| `capability-authoring-review` | **N/A** | No capability-authoring files modified. |
| GHA expression injection (supplemental) | **Pass** | Only `github.sha` and `github.event.workflow_run.head_sha` are used in expressions. Both are GitHub-controlled commit SHAs, not user-supplied input. No `github.event.pull_request.*` or `github.event.issue.*` or `inputs.*` used in shell commands. Safe. |
| Third-party action pinning (supplemental) | **Pre-existing** | `actions/checkout@v4`, `azure/login@v2` were already referenced by tag (not SHA) before this change. Not introduced by me. Tightening action pinning across both workflows is worth a separate follow-up but out of scope for #166. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Local YAML parse via `js-yaml` — documented above; parsed cleanly.
- Semantic review of `workflow_run` + `head_sha` usage against GitHub docs — documented in the code comments inline with the change.

### Applied Fixes and Filed Work Items

None — no findings.

### Accepted / Deferred / Blocked

Third-party action pinning (tightening `@v4` / `@v2` to commit SHAs across both `ci.yml` and `deploy.yml`) is **deferred** — a legitimate supply-chain hardening item but not in scope for #166 and should be filed separately if prioritized.

### Compliance Control Mapping

Not applicable — no active compliance framework for this repo.

### Run Metadata

- **Run date**: 2026-04-21
- **Commit base**: `origin/main` (SHA `3f01eba` at time of branch)
- **Files reviewed**: 3 (one YAML, two markdown)
- **Skill errors**: none
- **Environment notes**: validation limited to static YAML parse; workflow_run behavior can only be exercised post-merge against live GitHub Actions.
