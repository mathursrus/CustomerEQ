# Implementation Evidence — Issue #343

**Issue**: #343 — CI/CD: skip image build + deploy on doc-only commits
**Type**: feature (CI/CD tooling)
**Branch**: `feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 343`

---

## A. Diff Summary

Two files modified:

| File | Lines before | Lines after | Net |
|---|---|---|---|
| `.github/workflows/ci.yml` | 175 | 196 | +21 |
| `.github/workflows/deploy.yml` | 147 | 173 | +26 |

No source code touched. No tests added. No new npm dependencies. One new GitHub Action dependency: `dorny/paths-filter@v3`.

---

## B. Acceptance Criteria Traceability

| AC (from #343 body) | Implementation | Evidence |
|---|---|---|
| Gate `docker-build` job in `ci.yml` with `dorny/paths-filter` skip-list | `ci.yml` lines 113-127: `Determine if build is needed` step + `Skip if doc-only` + `if:` on all 6 build/verify steps | YAML parse OK; structural check: 7 steps gated on `changes.outputs.build` |
| Gate `build-and-deploy` job in `deploy.yml` same way, with `base: HEAD~1` for `workflow_run` baseline | `deploy.yml` lines 46-63: same filter; `fetch-depth: 2` added to checkout; `if:` on all 12 build/deploy/healthcheck steps | YAML parse OK; structural check: 13 steps gated |
| Keep `ci` job (typecheck/lint/test) unfiltered | `ci.yml` `ci` job unchanged | Structural check: 0 gated steps in `ci` job |
| Skip-list semantics, not whitelist | All filter patterns are `!`-prefixed | Visual diff review |
| Skip set matches #343 final list | 7 patterns: `**/*.md`, `docs/**`, `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`, `CODEOWNERS`, `.gitattributes`, `LICENSE` | Identical in both files |

No ACs unmet.

---

## C. Validation Results (Phase 5)

Rule 11 local gates, all PASS:

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | PASS (19/19 packages) | Required `pnpm db:generate` once on the fresh worktree to populate `@prisma/client` types — unrelated to YAML changes |
| `pnpm lint` | PASS (0 errors, 6 warnings) | 6 warnings all pre-existing in `apps/web/src/app/api/mcp/route.ts` + `LoopMonitor.tsx`; none introduced by this PR |
| `pnpm build` | PASS (12 packages) | 1m 0.6s wall clock |
| `pnpm test:smoke` | PASS (16 packages, 460/460 API tests) | 10.9s wall clock |
| YAML parse (`python -c "yaml.safe_load(...)"`) | PASS both files | jobs/steps structure verified |

Structural check counts:
- `ci.yml` `ci` job: 14 steps, 0 gated (unchanged path, runs on every commit)
- `ci.yml` `docker-build` job: 9 steps, 7 gated on `changes.outputs.build` (6 build/verify `== 'true'` + 1 skip-message `== 'false'`)
- `deploy.yml` `build-and-deploy` job: 15 steps, 13 gated (12 build/deploy/verify `== 'true'` + 1 skip-message `== 'false'`)

End-to-end runtime validation of the new filter logic happens in CI on this PR itself (which touches `.github/workflows/**`, not in the skip set, so it should trigger a full image build — meta-validation that the filter resolves `true` correctly). The first non-workflow doc-only commit on `main` after merge will exercise the skip path.

---

## D. Security Review

`reviewScope = diff`

### Executive Summary
0 findings of any severity. Diff is GitHub Actions workflow YAML only — no application surface (web, api, llm-app, data-pipeline, mobile) touched. No new auth, no new secrets handling, no new attack surface. One new third-party GitHub Action (`dorny/paths-filter@v3`) introduced; vetted below.

### Review Scope
- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- `surfaceAreaPaths`: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Branch: `feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits` vs `origin/main`

### Threat Surface Summary
Threat-surface classification: `surfaces: []` — no heuristic match. `.github/workflows/*.yml` is pure CI/CD config; not `web`, `api`, `llm-app`, `data-pipeline`, `mobile`, `capability-authoring`, or `docs-only`. Per the `threat-surface-classification` skill special case: "If no heuristic matches at all (for example pure config files), emit `surfaces: []` and let the calling job mark the coverage rows N/A."

### Coverage Matrix

| Category | Coverage | Notes |
|---|---|---|
| OWASP Web Top 10 | N/A | No `web` surface in diff |
| OWASP API Top 10 | N/A | No `api` surface in diff |
| OWASP LLM Top 10 | N/A | No `llm-app` surface in diff |
| Capability Authoring Review | N/A | No skills/jobs/rules markdown in diff |
| Secrets in Code | Pass | No new `${{ secrets.X }}` references; no plain values introduced. All existing secret references in `deploy.yml` (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) unchanged. No `.env` files touched. |
| Privacy / PII | N/A | No PII handling in CI config |
| Compliance Control Mapping | N/A | No regulated workload changes |

### Findings
None.

### Prioritized Remediation Queue
Empty.

### Verification Evidence
- Secrets scan: `git diff origin/main -- .github/workflows/*.yml` shows no new secret literals; only `${{ secrets.X }}` references (which existed before).
- Component vetting: `dorny/paths-filter@v3` is a community action maintained by [dorny](https://github.com/dorny) with extensive usage across the GitHub Actions ecosystem. v3 is the current stable major. Repo convention is major-version pinning for marketplace actions (precedent: `actions/checkout@v4`, `docker/setup-buildx-action@v3`, `azure/login@v2`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, `docker/build-push-action@v6`, `codecov/codecov-action@v4`). Pinning to v3 is consistent.

### Applied Fixes and Filed Work Items
None — no findings.

### Accepted / Deferred / Blocked
None — no findings.

### Compliance Control Mapping
N/A — no active compliance framework affects this diff.

### Run Metadata
- Run date: 2026-05-12
- Commit SHA: (not yet committed; pre-commit state)
- Skill errors: none
- Caps hit: none
- Environment: Windows / Git Bash; Node 22.x; pnpm 9.x

---

## E. Quality Verdict

PASS. No security findings. All Rule 11 local gates green. Structural YAML check confirms intended gating shape. Single-issue scope respected (no unrelated changes).

The PR for this very change is its own first real-world test case — it touches `.github/workflows/**` (not in the skip set), so the new filter logic resolves `true` and the full image build runs as a regression check.

---

## F. Feature Requirement Traceability Matrix

Source of truth: GitHub issue #343 body (no separate spec; issue body serves as the spec).

| Requirement / Acceptance Criterion (from #343) | Implemented File / Step | Proof | Status |
|---|---|---|---|
| Gate `.github/workflows/ci.yml`'s `docker-build` job with `dorny/paths-filter@v3` skip-list | `ci.yml` `docker-build` job — new step `Determine if build is needed` (id=`changes`) with 7 `!`-prefixed patterns; new `Skip if doc-only` step; `if: steps.changes.outputs.build == 'true'` added to each of `Set up Docker Buildx`, `Build api image`, `Verify API image module resolution`, `Build worker image`, `Verify Worker image module resolution`, `Build web image` | YAML parse + python AST count: 9 total steps, 7 gated (6 build/verify + 1 skip-message). Visual diff review. | Met |
| Gate `.github/workflows/deploy.yml`'s `build-and-deploy` job's first step with the same filter, using `base: HEAD~1` for `workflow_run` baseline | `deploy.yml` `build-and-deploy` job — `fetch-depth: 2` added to existing `Checkout` step; new `Determine if deploy is needed` with `base: HEAD~1`; new `Skip if doc-only` step; `if: steps.changes.outputs.build == 'true'` added to all 12 subsequent build/deploy/verify steps | YAML parse + python AST count: 15 total steps, 13 gated (12 deploy + 1 skip-message). Visual diff review. | Met |
| Keep the `ci` job (typecheck/lint/build/test) unfiltered — runs on every commit | `ci.yml` `ci` job unchanged from origin/main version | python AST count: 14 steps, 0 gated. `git diff origin/main -- .github/workflows/ci.yml` shows no edits inside the `ci` job's `steps:` block. | Met |
| Skip-list semantics (negation), not whitelist | Both filters use `!`-prefixed patterns exclusively | Visual diff review; no positive patterns in either filter | Met |
| Skip set per issue body: `**/*.md`, `docs/**`, `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`, `CODEOWNERS`, `.gitattributes`, `LICENSE` | Identical 7 patterns in both `ci.yml` and `deploy.yml` filter blocks | Visual diff review; byte-for-byte identical between the two files | Met |
| `paths-ignore` at the workflow trigger level NOT used (per D-343.4 — would skip `ci` job too / not honored on `workflow_run`) | Neither workflow's `on:` block adds `paths` or `paths-ignore` | `git diff origin/main -- .github/workflows/*.yml` shows no edits to the `on:` blocks | Met |
| No `.png`/`.jpg` global skip (per D-343.5 — path-prefix decides) | Skip list contains no image-extension globs | Visual diff review | Met |

No `Partial`, no `Unmet`, no named design callouts left unresolved.

---

## G. Technical Design Traceability Matrix

No separate RFC for this issue. Alternate design source of truth: the issue #343 body itself (§"Proposed change" + §"Risks / trade-offs"). All technical-design-level commitments are captured in the Feature Requirement Traceability Matrix above; this section adds rows for the explicit named-primitive and risk-acknowledgment commitments.

| Design Commitment | Implementation | Proof | Status |
|---|---|---|---|
| Use `dorny/paths-filter@v3` as the gate action | Both workflows reference `uses: dorny/paths-filter@v3` | Visual diff; security review §D vetted action choice | Met |
| `fetch-depth: 2` required on `deploy.yml`'s checkout for `base: HEAD~1` to resolve | Added with inline comment explaining requirement | `deploy.yml` line ~46 | Met |
| `base: HEAD~1` is the correct baseline given main lands via squash merges | Comment in `deploy.yml` documents this assumption | `deploy.yml` lines 47-54 | Met |
| Risk #1 (skip-list drift toward over-building) — acceptable failure direction | No code action; explicitly accepted in design with mitigation noted | Issue body §"Risks / trade-offs" #1 | Met (design-accepted) |
| Risk #2 (doc files referenced by code) — `ci` job runs typecheck/lint/test unfiltered as mitigation | `ci` job unchanged | python AST count: 14 steps, 0 gated in `ci` job | Met |
| Risk #3 (workflow edits always rebuild) — desired behavior, not a bug | `.github/workflows/**` not in skip set; workflow edits trigger full build | Visual diff: skip set verified absent of `.github/workflows/**` | Met |

No named design callouts unresolved.

---

## H. Feedback Completeness Verification

Feedback file: `docs/evidence/343-feature-implementation-feedback.md`.

| Round | Items | UNADDRESSED | ADDRESSED |
|---|---|---|---|
| Phase 8 quality | 1 (A2.1 — skip-list duplication) | 0 | 1 (pre-disposed in issue body §"Out of scope") |

`allFeedbackAddressed: true`. No human feedback rounds yet (PR not opened at time of this check).

---

## I. Standing Work List Promotion

Durable content from `docs/evidence/343-implement-work-list.md` promoted to this evidence doc:
- **Goals / ACs**: §F Feature Requirement Traceability Matrix.
- **Pattern Discovery**: not promoted — discoveries (existing workflow_run head_sha trap, concurrency block) didn't drive new architecture-doc updates; referenced inline in §G.
- **Resolved Decisions D-343.1..5**: §F + §G traceability rows; D-343.1 (skip-list), D-343.3 (base: HEAD~1), D-343.4 (no paths-ignore at trigger), D-343.5 (no global .png/.jpg skip) each have a row.
- **Validation Requirements**: §C Validation Results (Phase 5).
- **In-flight decisions / deferrals**: skip-list duplication addressed in §H feedback round; reusable-workflow promotion deferred to "3rd workflow" trigger.

Work list will be deleted in Phase 13 (retrospective) per FRAIM cleanup convention.
