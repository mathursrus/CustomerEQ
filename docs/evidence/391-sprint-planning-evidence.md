# Evidence — Issue #391: CI/CD Pipeline Improvements Epic

**Workflow**: sprint-planning
**Date**: 2026-05-14
**Owner**: swavak@gmail.com

---

## Summary

Created GitHub epic #391 tracking 9 CI/CD improvement items discovered during a full pipeline analysis on 2026-05-14. Items were WSJF-scored, split into "do now" (speed wins) and "parked" (gap coverage) buckets per user preference, and filed as individual sub-issues with full acceptance criteria.

---

## Work Completed

### Files created
- `docs/project-management/sprint-plan-CustomerEQ-cicd-2026-05-14.md` — WSJF backlog, committed scope, RAID log, cost-of-delay notes
- `docs/evidence/391-sprint-planning-evidence.md` — this file

### GitHub issues filed

| Issue | Title | Bucket | WSJF |
|-------|-------|--------|------|
| #391 | Epic: CI/CD Pipeline Improvements | Epic | — |
| #392 | ci: enable Turbo remote cache | Do now | 9.5 |
| #393 | ci: skip main CI job on doc-only commits | Do now | 9.0 |
| #394 | ci: move pnpm audit to weekly scheduled workflow | Do now | 8.0 |
| #395 | ci: split lint into its own parallel job | Do now | 6.0 |
| #396 | ci: add test:integration to CI gate | Parked | 8.3 |
| #397 | ci: enforce Codecov coverage threshold | Parked | 14.0 |
| #398 | ci: nightly test:baml scheduled job | Parked | 2.6 |
| #399 | ci: parallel Docker image builds via matrix | Parked | 2.2 |
| #400 | ci: nightly E2E job with full stack | Parked | 1.5 |

### Labels created
- `ci-cd` — applied to all 9 issues
- `status: future` — applied to all 5 parked issues

---

## Key Findings from Pipeline Analysis

**Speed problems identified:**
1. No Turbo remote cache → every CI run starts cold regardless of what changed
2. Single monolithic job → lint, typecheck, tests all wait for full build
3. Doc-only commits trigger full CI (no path filtering on main `ci` job)
4. `pnpm audit` runs on every PR (network call to npm registry)
5. Docker builds sequential (api → worker → web, ~3× wall time vs. parallel)

**Coverage gaps identified:**
1. Integration tests never run in CI — `pnpm test` excludes `test/integration/**`; the step is named "Unit & Integration Tests" but only runs unit tests
2. No E2E in CI — requires running dev server; Playwright auth with Clerk is complex
3. No Codecov threshold — coverage can drop to 0% silently
4. `test:baml` not in CI — expected (LLM cost), but no automated AI regression detection

---

## WSJF Overrides Documented

- G (Codecov, WSJF 14.0) parked despite being the highest-scoring item — user strategic decision to park all gap items for a dedicated round. Pull-forward candidate (#397) if gap round starts soon.
- B (test:integration, WSJF 8.3) parked same reason.

---

## Validation

- All 10 issues (epic + 9 sub-issues) confirmed created on GitHub
- Epic body updated with real issue numbers after sub-issues were created
- Sprint plan doc written and ready for commit to main
- Labels `ci-cd` and `status: future` created and applied

---

## Quality Checks

- [x] All 9 backlog items have explicit acceptance criteria
- [x] WSJF scores and strategic overrides documented
- [x] RAID log covers risks (Turbo Cloud account), assumptions, and decisions
- [x] Parked items include cost-of-delay notes
- [x] Committed items sequenced by dependency (D → E → A → C)
- [x] Sprint plan doc is readable in one pass
