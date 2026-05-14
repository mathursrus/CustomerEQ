# Phase 8 Quality Feedback — Issue #371

**Issue**: [#371](https://github.com/mathursrus/CustomerEQ/issues/371)
**Branch**: `feature/371-fix-new-survey-page-server-components-render-error`
**Phase 8 author**: Claude (Opus 4.7), 2026-05-14

This file records `QUALITY CHECK` findings against the diff. Each finding is tagged `ADDRESSED` or `UNADDRESSED`. Phase 8 fails if any are `UNADDRESSED`.

---

## Diff under review

| File | Lines changed | Type |
|---|---|---|
| `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` | +69 / −37 | modified |
| `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` | +173 (new) | new |
| `docs/evidence/371-*.md` (4 files) | new | docs |

---

## Findings

### 1. Hardcoded values
**Status**: PASS — no QUALITY CHECK FAILURE.

- All URLs use query-string conventions already in use elsewhere (`/admin/surveys?error=...`). Two new error codes added: `auth-failed`, `programs-fetch-failed`. The other two (`no-program`, `create-failed`) are pre-existing.
- No hardcoded credentials, API keys, colors, or magic numbers introduced.
- `API_URL` is consumed from `@/lib/config`, not hardcoded — matches the existing pattern in `campaigns/page.tsx`, `programs/[id]/page.tsx`.

### 2. Duplicate code / missed reusability
**Status**: PASS — no QUALITY CHECK FAILURE.

- The try/catch shape mirrors the working pattern in `apps/web/src/app/(admin)/admin/campaigns/page.tsx` and `apps/web/src/app/(admin)/admin/programs/[id]/page.tsx`. This is *intentional consistency*, not duplication that needs DRY-ing. Each route has its own fetch helpers because the return shapes differ (`Survey[]` vs `Campaign[]` vs `Program | null`); extracting a generic "wrap-fetch-in-try" helper would obscure more than it saves in a 2-helper file.
- `freshPresetFor` is imported from the existing `_helpers/presets.ts` — no inline preset duplication.
- `auth()` and `redirect()` come from their canonical modules (`@clerk/nextjs/server`, `next/navigation`).

**Considered and rejected**: extracting an `async function safeFetch<T>(url, opts, parser)` helper. Rejection reason: only two call-sites in this file, the response shapes differ (`ProgramsResponse` vs `SurveyCreatedResponse`), and the existing pattern in neighboring routes does not use such a helper either. A new abstraction here would be inconsistent with the codebase's idiom.

### 3. Architecture standards compliance
**Status**: PASS — no QUALITY CHECK FAILURE.

- AI/deterministic separation: N/A — no AI surface in this diff.
- Clean Architecture: presentation-layer fix; no domain or infrastructure code touched.
- DI / testability: tests use vi.mock at module boundaries (`@clerk/nextjs/server`, `next/navigation`, `globalThis.fetch`) per the existing project pattern. No production seams added.
- Security & config: secrets via `process.env.NEXT_PUBLIC_API_URL` (build-inlined), not hardcoded.
- Pattern discovery first: cross-referenced two existing canonical examples before writing the fix.
- Code quality: page.tsx grows from 92 → ~115 lines, well under the 500-line threshold. Functions: `fetchPrograms` 13 lines, `createDraftSurvey` 24 lines, `NewSurveyPage` 27 lines — all single-responsibility, well under the 50-line guideline.

### 4. Monolithic / complex / nested logic
**Status**: PASS — no QUALITY CHECK FAILURE.

- Max nesting: 2 levels (try → if). No deep conditionals.
- Max parameter count: 2 (`createDraftSurvey(token, programId)`). Well under 4.
- Cyclomatic complexity on `NewSurveyPage`: 5 branches (auth-fail / programs-null / programs-empty / surveyId-null / happy-path). Linear; each branch is one terminal `redirect()`. Trivially testable, which is why the 7 tests achieve 100% branch coverage.

### 5. Architecture health (imports & cycles)
**Status**: PASS — no QUALITY CHECK FAILURE.

- Imports use the established aliases (`@/lib/config`) and relative paths (`../_helpers/presets`) — matches the rest of the route tree.
- No new imports from a higher-level module.
- No circular dependency risk (helpers module is leaf-level; presets has no upward imports).

### 6. UI baseline validation
**Status**: N/A — the route renders zero operator-visible content (server-only redirect-only). Per the `ui-baseline-validation` skill input definition, there is nothing to open in a browser.

### 7. Test quality
**Status**: PASS — no QUALITY CHECK FAILURE.

- No tautological assertions (no `expect(constant).toBe(constant)`).
- No empty / no-op mocks. Each mock is exercised by an assertion (`mockAuth.mockRejectedValueOnce` in T2; fetch handler captures POST body asserted in T6/T7).
- Tests validate behavior, not structure: T6 asserts the POST body fields (`name`, `programId`, `type`, `questions.length`), T7 asserts the freshness invariant (two renders produce different IDs).
- Each test names the scenario in plain language (`T1 — redirects with ?error=programs-fetch-failed when GET /v1/programs rejects`).
- No copy-paste from another module; the test file is purpose-built for this route.

### 8. Comments
**Status**: PASS — no QUALITY CHECK FAILURE.

- Comments explain *why*, not *what*. Specifically:
  - `// Issue #371 — production regression fix:` block at the top of page.tsx — explains the change motivation.
  - `// `null` distinguishes "fetch failed" ... from `[]` ("brand has zero programs" ...)` — captures a non-obvious type-shape invariant the next reader needs.
  - `// Auth resolution is its own try/catch: if Clerk's session lookup fails ...` — explains the structural split.
  - `// Real next/navigation.redirect() throws a NEXT_REDIRECT control-flow error.` in the test — explains why the mock throws.
- No `TODO` / `FIXME` / `@ts-ignore` introduced.

---

## Summary

**0 QUALITY CHECK FAILURES.**
**Phase 8 passes.** No issues require addressing.
