# Implementation Work List — Issue #371

**Issue**: [#371](https://github.com/mathursrus/CustomerEQ/issues/371) — [P0] Production: `/admin/surveys/new` throws Server Components render error — unhandled auth/fetch in new server component (regression from #336)
**Type**: `bug` (post-merge regression from PR #364 / issue #336 Slice 4b)
**Branch**: `feature/371-fix-new-survey-page-server-components-render-error` (off `main`)
**Base branch**: `main`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 336` (reused — `git status` was clean)
**Phase 1 author**: Claude (Opus 4.7), session 2026-05-14
**Status**: Phase 1 (implement-scoping) — work-list deliverable.

---

## A. Scope

### In scope

| # | Surface | Reason |
|---|---|---|
| 1 | `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — wrap `auth()`, `getToken()`, and both `fetch()` calls in try/catch; redirect on failure to `/admin/surveys?error=<reason>` (auth-failed / programs-fetch-failed / create-failed / no-program). | Root cause: unhandled rejection propagates from the server component, surfaces in the client as the cryptic `digest`-only error. Working comparison: `campaigns/page.tsx` + `programs/[id]/page.tsx` (try/catch + safe defaults). |
| 2 | Same file — move `freshPresetFor('NPS')` out of module scope into the request handler (or call it inside `createDraftSurvey`). | Drive-by in the same 92-line file: current code computes question IDs **once at module load**, so every survey created via /new shares the same IDs (server is long-lived; `Math.random()` runs once). Caught while reading the file for the root-cause fix. Fix is one line. |
| 3 | New `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` — vitest unit tests for the redirect-fallback paths and the happy path. **At least one test fails before the fix and passes after** (Rule 11a + testing-standards §1). | The route shipped with zero tests, which is why the regression slipped. |

### Out of scope

| Item | Reason | Owner |
|---|---|---|
| Restructuring the editor or programs flow | Pure regression fix; behavior elsewhere is correct. | n/a |
| Adding a Programs-empty empty state on /new | The existing redirect to `/admin/surveys?error=no-program` already lands the operator in the fresh-brand empty state on the list page. | already covered |
| Browser-extension `unload` warning | Third-party content script (Grammarly / password manager / ad-blocker). Not our code. | external |
| Playwright e2e for the route | Server Components + Clerk auth in Playwright is fragile (Rule 18 calls this out explicitly). Unit-level coverage is sufficient for a one-file fix; the broader e2e suite for the editor lives under #336 work-list §I and exercises the post-redirect path. | future |
| Programs-list pagination, server-side filtering, etc. | Off-topic. | n/a |

### Phase Splitting Candidate check
Touch count: **2 files modified, 1 added** = 3 files (page.tsx + new page.test.tsx + a one-line presets test if needed). Well under the 15-file threshold. No splitting required.

---

## B. Pattern discovery (codebase-pattern-discovery skill)

### B.1 Server-component error-handling pattern
Canonical references (both on `main`):
- `apps/web/src/app/(admin)/admin/campaigns/page.tsx:19-33` — `try { auth + getToken + fetch } catch { return [] }`.
- `apps/web/src/app/(admin)/admin/programs/[id]/page.tsx:6-19` — `try { ... } catch { return null }` then `if (!program) notFound()`.

The fix MUST follow this shape: catch broadly inside helper functions, return a sentinel (`null` / `[]`), branch on the sentinel in the top-level `async function`, and `redirect()` on the failure branch. Redirect calls must remain **outside** the try block (otherwise `NEXT_REDIRECT` is swallowed).

### B.2 Environment / config pattern
- `apps/web/src/lib/config.ts` — `API_URL` derived from `process.env.NEXT_PUBLIC_API_URL` with localhost fallback. Build-time inlined. No new env var needed.

### B.3 RTL / vitest pattern for server-component pages
- Closest neighbor: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.test.tsx` — page-level test mocking `@clerk/nextjs/server` and `next/navigation` (`redirect` mocked to throw a sentinel so the assertion can detect the call). I will mirror this shape, not invent a new one.
- Global jsdom + vitest setup already present (`apps/web/vitest.setup.ts`, `vitest.config.ts`).

### B.4 Constants / utilities
- `freshPresetFor`, `presetFor`, `PRESET_QUESTIONS_NPS` in `apps/web/src/app/(admin)/admin/surveys/_helpers/presets.ts`. Already reused — no duplication.

### B.5 Architecture document
- `docs/architecture/architecture.md` already documents the server-component pattern for admin pages (MA1 entry from #336 Phase 10). This fix does not introduce a new pattern — it brings `/new` into compliance with the documented pattern. **No ADR / architecture-doc update required** in Phase 10 of this job. Phase 10 deliverable will be a one-line "no architectural change" note.

---

## C. Execution checklist

### C.1 Code

- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — refactor `fetchPrograms` and `createDraftSurvey` to wrap their internals in try/catch, returning `null` on thrown rejection (matching campaigns/programs pattern).
- [ ] Same file — wrap the top-level `auth()` + `getToken()` calls in try/catch with redirect to `/admin/surveys?error=auth-failed` on failure.
- [ ] Same file — add an explicit `programs-fetch-failed` branch when `fetchPrograms` returns `null` (distinct from the empty `[]` "no-program" branch — so the operator and we know which one fired).
- [ ] Same file — call `freshPresetFor('NPS')` inside `createDraftSurvey` (or directly before the POST), not at module scope. Add a one-line comment explaining why.
- [ ] Keep `NEXT_REDIRECT` propagation correct: `redirect()` calls must remain outside try/catch.

### C.2 Tests (new — `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx`)

- [ ] **T1 — Repro (P2)**: when `fetch` rejects (simulated via `vi.mocked(global.fetch).mockRejectedValueOnce(new Error('network'))`) on the programs call, the page redirects to `/admin/surveys?error=programs-fetch-failed` (NOT throws). This test fails on `main` and passes after the fix.
- [ ] **T2**: when `auth()` rejects, redirects to `/admin/surveys?error=auth-failed`.
- [ ] **T3**: when programs list is empty (`[]`), redirects to `/admin/surveys?error=no-program`.
- [ ] **T4**: when survey POST returns `!res.ok`, redirects to `/admin/surveys?error=create-failed`.
- [ ] **T5**: when survey POST rejects, redirects to `/admin/surveys?error=create-failed` (same bucket — operator only needs to know "couldn't create").
- [ ] **T6 — Happy path**: with one program and a successful POST, redirects to `/admin/surveys/{id}/edit?tab=basics`. Asserts the POST body has `type: 'NPS'`, `name: ''`, and `questions` length matches the NPS preset (2 questions).
- [ ] **T7 — Question-id stability**: two consecutive renders produce DIFFERENT question IDs in the POST body (proves the `freshPresetFor` move worked).

Each test mocks `@clerk/nextjs/server` `auth`, mocks `next/navigation` `redirect` to throw a sentinel `Error('REDIRECT:<url>')`, and asserts the sentinel URL.

### C.3 Validation Requirements

- `uiValidationRequired`: **No.** The route renders no operator-visible content (it's a redirect-only server component). Manual browser verification is sufficient — load `/admin/surveys/new` from an empty-org account and confirm the editor opens, not a console error. No breakpoints / device profiles to cover.
- `mobileValidationRequired`: **No.** Same reason.
- `responsiveCheck`: **No.**
- `browserBaseline`: Chrome latest (where the bug was reported). Firefox / Safari smoke not required for a server-side fix.
- Required commands (Rule 11): `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke`, `pnpm build`. Smoke tests must include the new `page.test.tsx`.
- `pnpm test:integration` / `pnpm test:e2e`: not required for this fix (no DB schema change, no new endpoint, no new client UI). Will be exercised by the existing editor e2e once the redirect succeeds.

### C.4 Known deferrals / open questions

- None. The fix is mechanical (wrap-in-try-catch) and the scope is closed.

---

## D. Risk register

| Risk | Mitigation |
|---|---|
| Putting `redirect()` inside a try block silently swallows `NEXT_REDIRECT`. | Lint pattern via tests: T1–T5 all rely on `redirect()` being callable. If a redirect call gets caught, the test sentinel won't fire and the test fails. Plus a code-review reminder in the diff comment. |
| `redirect()` is called with `?error=<reason>`, but the list page (`apps/web/src/app/(admin)/admin/surveys/page.tsx`) does not currently surface the `error` query param to the operator. | Already the current behavior on `main` for the `?error=no-program` path. Not a regression — out of scope. Captured here so the next dev knows it's a known follow-up. |
| The `freshPresetFor` module-scope bug existed before #336 (it lived in the legacy wizard too, just unused there). Fixing it here is technically "expanding scope." | Justified because the fix lives in the same 92-line file, same regression surface, and is a one-line move. Calling it out explicitly in PR description (Rule 21 transparency). |
| Auto-save / `useAutoSave` on the editor might race the redirect if the redirect fires very fast. | Unrelated to this fix — the editor is reached AFTER redirect completes. Not in scope. |

---

## E. Definition of Done (Phase 11 gate)

- [ ] All seven tests above pass; T1 demonstrably fails against `main` and passes against this branch (commit evidence in `docs/evidence/371-implement-validate.md`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm build` all green on this branch (Rule 11).
- [ ] Manual verification: load `/admin/surveys/new` against a prod-like build (or `pnpm dev` with a fresh-org user) → either redirect to editor or to `?error=<reason>` — never a console error.
- [ ] PR title: `fix(#371): /admin/surveys/new — wrap auth/fetch + per-request preset (regression from #336)`. Body references "Closes #371" (Rule 10).
- [ ] No new architectural decision; Phase 10 evidence is a one-line "no change".
- [ ] Retrospective (Phase 13) captures the missed-test learning ("server-component routes with side effects must ship with at least one redirect-fallback test").

---

## F. References

- Issue: [#371](https://github.com/mathursrus/CustomerEQ/issues/371)
- Regression source: [PR #364](https://github.com/mathursrus/CustomerEQ/pull/364) (merged), Issue [#336](https://github.com/mathursrus/CustomerEQ/issues/336) (closed)
- Working comparison: `apps/web/src/app/(admin)/admin/campaigns/page.tsx`, `apps/web/src/app/(admin)/admin/programs/[id]/page.tsx`
- Project rules touched: 10, 11, 11a, 18, 21, 24
