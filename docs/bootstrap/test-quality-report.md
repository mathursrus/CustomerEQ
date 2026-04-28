---
reviewContext:
  subjectType: repository
  subjectLabel: CustomerEQ
  reviewRef: fraim-review-2026-04-28
  scopeSummary: FRAIM test-quality review of the CustomerEQ monorepo covering test standards, package-level smoke coverage, documented validation-plan alignment, and mission-critical end-to-end gaps.
  repoIdentifier: github.com/mathursrus/CustomerEQ
  branchRef: main
  sourceInventory:
    - apps/web/test/e2e/critical-path.spec.ts
    - apps/worker/src/processors/surveyDistribute.ts
    - docs/evidence/101-technical-design-evidence.md
    - apps/api/coverage/coverage-final.json
    - apps/worker/coverage/coverage-final.json
quality:
  composite: 4.2
  grade: D+
  dimensions:
    standardsCompliance:
      score: 5.3
      rationale: Shared utilities and naming conventions exist, but they are not enforced consistently across Playwright and worker tests.
    coverageDepth:
      score: 3.7
      rationale: Major runtime surfaces and product-critical flows remain partially covered or entirely uncovered relative to documented validation plans.
    testIntegrity:
      score: 3.9
      rationale: Too much confidence depends on mocked or skipped paths rather than runnable end-to-end verification of real product behavior.
    scenarioRobustness:
      score: 4.0
      rationale: The suite covers many unit-level edge cases, but the most important multi-step customer journeys still lack dependable automated proof.
  coaching: Replace the skipped critical-path browser flow with one runnable hero-journey test, then use that test as the forcing function for closing survey, campaign, redemption, and analytics coverage gaps.
---

# Test Quality Report

## Executive Summary

CustomerEQ currently earns an overall **D+** for test quality. The repo has a meaningful amount of automated testing, especially in shared schemas and worker business logic, but the highest-value product journeys still lack dependable validation. The main problem is not test volume. It is the mismatch between what the repository says is validated and what the runnable suite actually proves.

The strongest positive signal is the shared package test depth: `@customerEQ/shared` produced 542 passing tests with 80.99% statement coverage in this review. The strongest negative signal is that the end-to-end critical path remains skipped in [`apps/web/test/e2e/critical-path.spec.ts`](../../apps/web/test/e2e/critical-path.spec.ts), and some design evidence references support-flow tests that do not exist in the repository.

## Review Context

This report follows the FRAIM `test-quality-assessment` job on April 28, 2026. Standards were evaluated against the repository’s own rule set, especially `fraim/personalized-employee/rules/project_rules.md` rule 8 (`Shared Test Utils - No Inline Mocks`) and rule 9 (`Test Coverage Requirements by Priority`).

Coverage was collected package-by-package because the FRAIM timeout wrapper could not run locally and the root smoke script does not pass coverage flags through cleanly. The resulting coverage artifacts were generated at:
- `apps/api/coverage/coverage-final.json`
- `apps/worker/coverage/coverage-final.json`
- `packages/shared/coverage/coverage-final.json`
- `packages/ai/coverage/coverage-final.json`

Observed package-level coverage during this review:
- `@customerEQ/shared`: 542 tests passed, 80.99% statements
- `@customerEQ/worker`: 169 tests passed, 55.38% statements
- `@customerEQ/ai`: 35 tests passed, 24.98% statements
- `@customerEQ/api`: 308 tests passed, 15.53% statements

## Dimension Scorecard

| Dimension | Score | Rationale |
| --- | --- | --- |
| Standards Compliance | C- | The repo has a real shared utility package at `@customerEQ/config/test-utils`, and the API integration suite mostly follows it. The score is reduced by widespread inline mock/helper duplication across Playwright specs and several worker tests despite the repo rule that mocks should be centralized. |
| Coverage Depth | D | Shared-schema and some worker logic are well covered, but major runtime surfaces remain untouched or lightly covered. `analytics.ts`, `surveys.ts`, `programs.ts`, and `surveyDistribute.ts` represent meaningful product behavior without corresponding execution evidence in this run. |
| Validation-Plan Alignment | D- | Documentation claims more validation than the runnable suite currently demonstrates. The clearest example is support-flow evidence that references `support-rules.spec.ts` and support integration suites that are not present in the repository. |
| Mission-Critical Confidence | D | The product differentiator requires real end-to-end proof across enrollment, CX event ingestion, campaign trigger, reward redemption, and analytics feedback loops. That chain is explicitly skipped in the current `critical-path` browser suite. |
| Maintainability of Tests | C | The suite is large and useful, but repeated inline helpers such as `mockClerkAuth` and route-level Playwright API stubs create drift risk and make new coverage harder to add cleanly. |

## Evidence Highlights

1. **Critical path is not executable today**
   [`apps/web/test/e2e/critical-path.spec.ts`](../../apps/web/test/e2e/critical-path.spec.ts) lines 157-169 skip four core scenarios: enrollment, campaign trigger/point award, reward redemption, and analytics verification. Those are the exact flows that should validate the repo’s differentiator.

2. **Shared test utilities exist but are not used consistently**
   `packages/config/src/test-utils/` provides common mocks, factories, and DB helpers, and many API integration tests import from `@customerEQ/config/test-utils`. In contrast, at least 12 Playwright specs and 5 worker tests still define inline helpers or direct mocks locally.

3. **Coverage concentrates away from large runtime modules**
   API smoke coverage is only 15.53% overall. The largest uncovered files include `apps/api/src/routes/analytics.ts`, `programs.ts`, `surveys.ts`, `externalSignals.ts`, and `oauth.ts`. Worker coverage is healthier overall, but `apps/worker/src/processors/surveyDistribute.ts` remains at 0% with no test file.

4. **Validation evidence has drifted from the repo**
   [`docs/evidence/101-technical-design-evidence.md`](../../docs/evidence/101-technical-design-evidence.md) states that support flow validation includes `support-rules.spec.ts` plus support integration suites, but no corresponding support E2E or API integration test files exist under `apps/web/test/e2e` or `apps/api/test/integration`.

5. **Coverage percentages understate some handwritten AI logic, but still reveal real gaps**
   `@customerEQ/ai` reports 24.98% statement coverage because generated BAML client code is included. Even after accounting for that distortion, handwritten modules such as `src/analysis/support.ts` and `src/analysis/process-response.ts` still show no exercised coverage in this review.

## Top Gaps / Risks

1. The repo does not currently provide automated end-to-end proof for the hero CX-to-loyalty flow because the critical-path browser spec skips the essential stages after admin setup.
2. Test evidence and repository reality are not fully aligned, which weakens trust in historical implementation artifacts and makes review sign-off less reliable.
3. Large, business-critical API routes remain mostly or entirely outside smoke coverage, so regressions in surveys, analytics, programs, and external signals can survive the fast test gate.
4. Some worker behaviors that have user-visible effects, especially survey distribution, have no direct test evidence at all.
5. Test helper duplication creates maintenance overhead without closing the highest-risk validation gaps.

## Coaching Plan

1. Replace the skipped sections in `critical-path.spec.ts` with one runnable happy-path flow that proves enroll -> earn -> campaign trigger -> redeem -> analytics on an environment that supports the real backend.
2. Add a dedicated test suite for `apps/worker/src/processors/surveyDistribute.ts` and treat it as a required gap closure because it is currently 0% covered.
3. Audit evidence documents against the repository and either restore the missing support suites or correct the evidence so validation claims match reality.
4. Promote at least one high-surface API route at a time into executable coverage, starting with `surveys.ts` and `analytics.ts`, because they are large and central to the product story.
5. Extract repeated Playwright auth/API stubs and worker mocks into `@customerEQ/config/test-utils` so future tests can add coverage instead of copying scaffolding.

## Source Inventory

- `apps/web/test/e2e/critical-path.spec.ts`
- `apps/worker/src/processors/surveyDistribute.ts`
- `docs/evidence/101-technical-design-evidence.md`
- `apps/api/coverage/coverage-final.json`
- `apps/worker/coverage/coverage-final.json`
