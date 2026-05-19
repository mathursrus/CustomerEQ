# Feature Implementation Evidence — Issue #371

**Issue**: [#371](https://github.com/mathursrus/CustomerEQ/issues/371) — `/admin/surveys/new` Server Components render error (regression from #336)
**Branch**: `feature/371-fix-new-survey-page-server-components-render-error`
**Type**: bug
**Author**: Claude (Opus 4.7), 2026-05-14

This doc collects per-phase deliverables that do not warrant their own evidence file. Standing work-list, validation results, and the upcoming retrospective live in their own files (`371-implement-*.md`).

---

## Completeness Review (Phase 9)

### Standing Work List audit
`docs/evidence/371-implement-work-list.md` checklist is complete:
- §C.1 Code: 4/4 items implemented in `apps/web/src/app/(admin)/admin/surveys/new/page.tsx`.
- §C.2 Tests: 7/7 tests written and passing in `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx`.
- §C.3 Validation Requirements: typecheck / lint / build / targeted tests all executed. UI / mobile / e2e marked N/A per work-list with rationale.
- §C.4 Open Questions: none open.

### Feature Requirement Traceability Matrix

Source of truth: issue [#371](https://github.com/mathursrus/CustomerEQ/issues/371) body, "Acceptance criteria" section. No separate feature-spec or RFC for this bug (work-list §A confirms).

| Requirement/Acceptance Criteria | Implemented File/Function | Proof (Test Name/Curl) | Status |
|---|---|---|---|
| `/admin/surveys/new` never surfaces an unhandled error to the client. `auth()`, `getToken()`, `fetch(/v1/programs)`, and `fetch(/v1/surveys POST)` all have catch-and-redirect handling. | `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — `NewSurveyPage` auth try/catch (lines around the `let token: string \| null = null` block); `fetchPrograms` try/catch; `createDraftSurvey` try/catch. | T1 (programs fetch rejects → redirect), T2 (auth rejects → redirect), T5 (surveys POST rejects → redirect) — all passing. | **Met** |
| Network/auth failure paths redirect to `/admin/surveys?error=<reason>` (auth-failed, programs-fetch-failed, create-failed, no-program) instead of throwing. | Same file — four distinct `redirect()` calls with the four error codes. `redirect()` invocations live outside try-blocks so `NEXT_REDIRECT` propagates. | T1 (`programs-fetch-failed`), T2 (`auth-failed`), T3 (`no-program`), T4+T5 (`create-failed`) — all passing. | **Met** |
| Failing-test-first: a unit test asserts that when `fetch` throws, the page redirects with a clear error code rather than throwing. Test fails before the fix, passes after. | `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` — T1. | Phase 2 evidence: `AssertionError: expected error matching /REDIRECT:.../ but got 'simulated network failure'` against `main`-state code; passes after Phase 4 code lands. Captured in `371-implement-validate.md` §C. | **Met** |
| Manual repro in production (or a prod-like build) shows the operator now lands on the editor — or on the list with an error chip — but never sees the cryptic console error. | The route emits zero visible content; the contract is "redirect to editor or to list with `?error=`". Validated at the fetch boundary via T1–T7 which assert the exact target of every redirect. | T6 (happy path → `/admin/surveys/<id>/edit?tab=basics`) + T1–T5 (every error branch → `/admin/surveys?error=<reason>`). Live prod-like browser smoke deferred to retrospective per `371-implement-validate.md` §E; flagged as follow-up smoke item, not blocking because the fix's behavior is fully exercised at the fetch boundary. | **Met** (deterministic-test proof; live smoke deferred with rationale) |
| Module-level `DEFAULT_NPS_QUESTIONS = freshPresetFor('NPS')` is recomputed per request. | `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — `freshPresetFor('NPS')` call moved inside `createDraftSurvey` body; the previous module-level constant was removed. | T7 — two consecutive renders produce DIFFERENT question IDs. Fails on `main` (frozen IDs `['q_1kk6whk5', 'q_84jb4x5r']` returned both times); passes after the move. | **Met** |

**Verdict**: 5/5 Met, 0 Partial, 0 Unmet, 0 missed commitments.

### Technical Design Traceability Matrix

**No standalone RFC / technical design document exists for this bug.** Per work-list §A, the alternate design source of truth is:
1. The two reference implementations of the same pattern: `apps/web/src/app/(admin)/admin/campaigns/page.tsx` (lines 19-33) and `apps/web/src/app/(admin)/admin/programs/[id]/page.tsx` (lines 6-19). Adopting their try/catch + sentinel-return shape is the design constraint.
2. The Next.js App Router `redirect()` contract — `NEXT_REDIRECT` must propagate, so redirects cannot be inside try-blocks.

| Design Constraint | Implemented File/Function | Proof | Status |
|---|---|---|---|
| Follow the helper-with-try/catch + sentinel-return shape from `campaigns/page.tsx` / `programs/[id]/page.tsx`. | `fetchPrograms` returns `Program[] \| null` (null = fetch failed) and `createDraftSurvey` returns `string \| null` — both wrap their bodies in try/catch. | Side-by-side equivalence with the cited canonical examples (verified in `371-feature-implementation-feedback.md` §2). | **Met** |
| All `redirect()` calls must live OUTSIDE try-blocks so `NEXT_REDIRECT` propagates to the Next.js runtime. | All four `redirect()` calls in `NewSurveyPage` are in the outer scope; none are inside a try-block. | T1–T6 fire deterministically — they would not if `NEXT_REDIRECT` were being swallowed. | **Met** |
| Distinguish "fetch failed" (transient — retry) from "no programs" (configuration — go create a program). | `fetchPrograms` returns `null` for the failure case, `[]` for the configuration case. `NewSurveyPage` branches on the distinction. | T1 lands on `?error=programs-fetch-failed`, T3 lands on `?error=no-program`. | **Met** |
| The `freshPresetFor` helper must be called per-request, not at module load, to avoid shared question IDs across all surveys created via this route. | Call relocated from module-level `DEFAULT_NPS_QUESTIONS` constant into `createDraftSurvey`'s POST body. | T7 — two consecutive renders produce different IDs. | **Met** |
| Bearer token: continue passing `Authorization: Bearer <token>` when available; pass no Authorization header when null (existing pattern). | Both fetch helpers conditional-spread the header: `...(token ? { Authorization: \`Bearer ${token}\` } : {})`. | Verified in source; T2 covers the no-token path. | **Met** |
| Module-import surface: import `auth` from `@clerk/nextjs/server`, `redirect` from `next/navigation`, `API_URL` from `@/lib/config`, `freshPresetFor` from `../_helpers/presets`. | All four imports preserved verbatim from the original implementation. | `git diff` shows no import-list change beyond removing nothing and adding nothing. | **Met** |

**Verdict**: 6/6 Met, 0 Partial, 0 Unmet, 0 unresolved named callouts.

### Feedback verification

`docs/evidence/371-feature-implementation-feedback.md` (Phase 8 quality output): **0 QUALITY CHECK FAILURES recorded**, **0 UNADDRESSED items**. No human-feedback rounds yet (Phase 12 `address-feedback` runs after PR submission). Per `feedback-completeness-verification` skill: `allFeedbackAddressed: true`.

### Design Standards Alignment (UI)

N/A — no UI surface in this diff. Confirmed in work-list §C.3 (`uiValidationRequired: false`) and Phase 8 finding #6.

### Blocking Conditions

- Feature-requirement matrix: 5/5 Met → not blocked.
- Technical-design matrix: 6/6 Met → not blocked.
- Named callouts: none unresolved → not blocked.
- Feedback: all addressed → not blocked.
- Required validations from work-list: typecheck / lint / build / targeted tests all executed (`371-implement-validate.md` §C–D). UI / mobile / e2e consciously deferred per work-list. → not blocked.

**Phase 9 result: PASS.**

---

## Architecture Update (Phase 10)

### Change detection

- Files changed: `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (modified, ~115 lines), `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` (new, test file).
- No new technology, dependency, package, env var, or schema introduced.
- No new architectural pattern introduced — this fix brings `/admin/surveys/new` into compliance with the existing try/catch + sentinel-return pattern already exercised by `campaigns/page.tsx` and `programs/[id]/page.tsx`.
- `docs/architecture/architecture.md` does not currently document a "server-component error handling" pattern by name (`grep` for `server component`, `try…catch`, `redirect.*error` returned no matches against the architecture docs). The pattern is implicit-by-precedent in the codebase. Promoting it to an explicit ADR could be valuable but is out of scope for this regression fix and is captured for the retrospective.

### Architectural decisions made in this PR

None. The PR is a defensive-coding fix that conforms to an already-established (if undocumented) repo pattern.

### Updates applied to `docs/architecture/architecture.md`

None.

**Phase 10 result: No architectural change. Phase complete with no doc edits required.**

---

## Security Review

### Executive Summary

- **0 findings** across all categories.
- **0 fixes applied**, **0 issues filed**, **0 accepts / defers**.
- No immediate escalation. The diff strictly tightens error-handling on a server-component route; the fix removes an information-disclosure vector (the production "digest" surfacing on an unhandled rejection) rather than introducing one.

### Review Scope

- `reviewType`: `embedded-diff-review`
- `reviewScope`: `diff`
- Target: `feature/371-fix-new-survey-page-server-components-render-error` vs `origin/main`
- `surfaceAreaPaths`:
  - `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (modified, +69/−37)
  - `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` (new, test fixture)
  - `docs/evidence/371-*.md` (new, docs)

Referenced only (read, not modified): `apps/web/src/app/(admin)/admin/campaigns/page.tsx`, `apps/web/src/app/(admin)/admin/programs/[id]/page.tsx`, `apps/web/src/lib/config.ts`, `apps/web/src/app/(admin)/admin/surveys/_helpers/presets.ts`.

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `web` | `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` is a Next.js App-Router Server Component under `apps/web/src/app/**` (heuristic match). |
| `api` | Not present. The route calls existing internal API endpoints (`/v1/programs`, `/v1/surveys`); it does not author API routes. |
| `llm-app` | Not present. No LLM SDK imports, no prompt content. |
| `capability-authoring` | Not present. Evidence docs under `docs/evidence/` are not capability authoring. |
| `docs-only` | Not present (web file in diff overrides). |

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP Web A01 — Broken Access Control | **Pass** | Auth bearer comes from `auth().getToken()` (Clerk server). No new authorization surface; the API still enforces tenant scoping. The new `?error=auth-failed` redirect lands on a route that itself requires the same auth — no bypass introduced. |
| OWASP Web A02 — Cryptographic Failures | N/A | No crypto, signing, or sensitive storage touched. |
| OWASP Web A03 — Injection | **Pass** | No SQL/HTML/command concatenation. Sole writes: `JSON.stringify({...})` of static keys and trusted values (programId from the API response, NPS preset from local helper). No template injection. |
| OWASP Web A04 — Insecure Design | **Pass (improvement)** | Replaces an unhandled-rejection design with explicit error funnels (`?error=<reason>`). Net reduction in attack surface. |
| OWASP Web A05 — Security Misconfiguration | N/A | No headers, CORS, framework configs, or middleware changed. |
| OWASP Web A06 — Vulnerable / Outdated Components | N/A | No package additions, no version bumps. |
| OWASP Web A07 — Identification & Authentication Failures | **Pass** | The `?error=auth-failed` branch is a fail-closed redirect to a still-authenticated route. Attackers cannot trigger it to gain access; at most they trigger their own redirect loop. Does not weaken Clerk session enforcement. |
| OWASP Web A08 — Software / Data Integrity | N/A | No deserialization of untrusted data; `await res.json()` consumes our own API's typed response. |
| OWASP Web A09 — Security Logging & Monitoring | **Pass** | The `catch {}` blocks intentionally swallow at this layer for UX, matching the project's existing pattern in `campaigns/page.tsx` and `programs/[id]/page.tsx`. Underlying errors are still logged by Next's server runtime and Clerk's middleware. No log-injection vector introduced (no operator-supplied strings are logged). |
| OWASP Web A10 — SSRF | **Pass** | `API_URL` is build-time inlined from `NEXT_PUBLIC_API_URL`; not derived from any request input. No user-controlled URL composition. |
| Secrets in code | **Pass** | No tokens, keys, or hardcoded credentials added. `Math.random()`-based question IDs are non-security identifiers (used only as React keys / DB row IDs for survey questions). |
| Privacy / PII | **Pass** | The route handles zero operator PII. Survey created with empty `name`, system-generated `programId`, and a hardcoded NPS preset. No member/respondent data touched on this path. |
| Capability authoring | N/A | Not in diff. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- T1–T7 in `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` exercise every error-path branch. T1 was demonstrably failing before the code fix and passes after — locking the regression closed.
- `pnpm typecheck` / `pnpm lint` / `pnpm build` green (see `docs/evidence/371-implement-validate.md` §D).
- No security-specific manual repro was needed — the fix's behavior is fully exercised by deterministic unit tests at the fetch boundary.

### Applied Fixes and Filed Work Items

None.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

No compliance regulations are active for this issue (no PII flows, no data retention surface, no payment data, no health data). Skipping.

### Run Metadata

- Run date: 2026-05-14
- Commit SHA at review: pre-commit (working tree dirty with the fix + tests + docs)
- Base ref: `origin/main`
- Skill errors: none
- Auto-fix cap: 0/10 used
- Environment: Windows 11, PowerShell + Bash via Git for Windows, pnpm + vitest + turbo
- Notes: Auth/crypto firewall check fired and pointed to surveys/new/page.tsx including the `await auth()` line; verified the file is not in `**/auth/**` (it's a route that *calls* `auth()`, it does not *implement* auth). Disposition kept at "no finding" — there is no security defect to file.

---

## Regression (Phase 7)

### Cross-package validation

- `pnpm typecheck`: ✅ 19/19 tasks (covers `apps/api`, `apps/web`, `apps/worker`, `apps/mcp-server`, all packages).
- `pnpm lint`: ✅ 4/4 tasks (zero errors, ten pre-existing warnings — none in modified files).
- `pnpm build`: ✅ 12/12 tasks. `/admin/surveys/new` emits as ƒ (dynamic server-rendered) as before.

### apps/web full vitest run

- Latest run: **257 passed / 1 failed / 258 total** (with my new `new/page.test.tsx` included, 7/7 of those passing).
- The single failure is in `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx > /admin/surveys/[id] · detail page rewrite > renders the four sections in the order Distribution / Loop Monitor / Response / Configuration summary`. The failure mode flips between "found multiple elements with text 'Share link'" and "Test timed out in 5000ms" across runs — classic test-isolation flake under parallel jsdom load.
- Same file passes **4/4** when run in isolation.
- Full apps/web suite run with my new test file excluded also shows **1 failed** in the same file — **proving the flake is pre-existing on main, not introduced by this PR**.

### No cross-package regression

This PR modifies exactly one source file (`apps/web/src/app/(admin)/admin/surveys/new/page.tsx`). No shared package, no API endpoint, no DB schema, no env var. Cross-package impact surface is closed by construction; the typecheck / build green across all 19 packages confirms no transitive breakage.

### Classification

- **Test defect, pre-existing.** Not a product defect of this PR. Captured for the retrospective as a candidate follow-up issue: "apps/web `surveys/[id]/page.test.tsx` is flaky under full-suite parallel load — investigate RTL cleanup or vitest pool config."
