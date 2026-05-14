# Phase 5 Validate Evidence — Issue #371

**Issue**: [#371](https://github.com/mathursrus/CustomerEQ/issues/371) — `/admin/surveys/new` Server Components render error
**Branch**: `feature/371-fix-new-survey-page-server-components-render-error` (off `origin/main`)
**Author**: Claude (Opus 4.7), 2026-05-14

---

## A. Code validation

- `git status` — clean except for the intended changes:
  - **modified**: `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (regression fix)
  - **new**: `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` (T1–T7)
  - **new**: `docs/evidence/371-implement-work-list.md`
  - **new**: `docs/evidence/371-implement-validate.md` (this file)
- No leftover `console.log`, `TODO`, `FIXME`, or `// @ts-ignore` introduced.
- All `redirect()` calls live outside try-blocks so `NEXT_REDIRECT` propagates (the whole point of the fix — verified by T1/T2/T5 passing).

## B. Validation modes required (per work-list §C.3)

| Mode | Required? | Result |
|---|---|---|
| `uiValidationRequired` | No (route renders zero operator-visible content; it only redirects) | N/A |
| `mobileValidationRequired` | No | N/A |
| Unit tests | Yes — the regression-test prerequisite for the fix (Rule 11a) | ✅ 7/7 pass |
| Smoke / repo-wide unit | Yes — Rule 11 | ✅ (see §C, §D) |
| Build | Yes — Rule 11 + `validate-phase-must-run-build` feedback | ✅ |
| Integration tests | No (no DB schema, no new endpoint) | N/A |
| Playwright e2e | No (Server Component + Clerk too fragile for one-file fix; covered by editor e2e once redirect lands) | N/A |

## C. Targeted tests — `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx`

```
$ pnpm vitest run 'src/app/(admin)/admin/surveys/new/page.test.tsx'
 ✓ src/app/(admin)/admin/surveys/new/page.test.tsx  (7 tests) 155ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

All seven tests pass after the fix:
- **T1** `programs fetch rejects → ?error=programs-fetch-failed`
- **T2** `auth() rejects → ?error=auth-failed`
- **T3** `programs list empty → ?error=no-program`
- **T4** `surveys POST !ok → ?error=create-failed`
- **T5** `surveys POST rejects → ?error=create-failed`
- **T6** happy path: redirect to `/admin/surveys/<id>/edit?tab=basics`, POST body shape verified
- **T7** two consecutive renders produce different question IDs (proves `freshPresetFor` is now per-request)

Phase 2 evidence (T1 failing against `main`-state): `AssertionError: expected error matching /REDIRECT:\/admin\/surveys\?error=programs-fetch-failed/ but got 'simulated network failure'`.
Phase 3 evidence (4 failing tests against `main`-state): T1, T2, T5, T7 — captured in conversation log; all flip to passing after Phase 4 code lands.

## D. Repo-wide validation

### typecheck
```
$ pnpm typecheck
... 19 tasks (11 cached) ... 27.833s
✅ Tasks: 19 successful, 19 total
```

### lint
```
$ pnpm lint
... 0 errors, 10 warnings (all pre-existing, none in changed files)
✅ Tasks: 4 successful, 4 total
```
The 10 warnings live in `surveys/[id]/page.test.tsx`, `api/mcp/route.ts`, and `components/surveys/LoopMonitor.tsx` — none touched by this PR. Rule 11 explicitly permits warnings.

### build
```
$ pnpm build
... 12 tasks (8 cached) ... 1m43s
✅ Tasks: 12 successful, 12 total
```
Build emits the `/admin/surveys/new` route as a dynamic server-rendered route (ƒ marker) — same as before, no static-rendering attempt.

### apps/web full test run
```
$ cd apps/web && pnpm test
Test Files  1 failed | 29 passed (30)
      Tests  2 failed | 256 passed (258)
```

**Triage of 2 failures**:
- Both failures are in `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx` ("found multiple elements with text 'Share link'" — RTL multi-element selector error).
- The file is **unchanged on this branch** (`git diff --name-only origin/main` lists only `surveys/new/page.tsx`).
- Running `[id]/page.test.tsx` in isolation: **passes 4/4**.
- Running `[id]/page.test.tsx` + my new `new/page.test.tsx` together: **passes 11/11**.
- Running the full apps/web suite with my new test file **excluded** still shows `1 failed` — proving the issue is pre-existing test-isolation flake in the broader suite, not introduced by this PR.
- The 1-vs-2 delta between runs is consistent with non-deterministic test-ordering surfacing the same isolation bug at different rates.

**Verdict**: Pre-existing flake, **not in scope for this PR**. Will note in retrospective (Phase 13) as a candidate follow-up issue ("apps/web test-isolation for surveys/[id] page test under parallel load").

## E. Manual verification — operator flow

Server Component routes that emit zero visible content (this one redirects-only) cannot be eye-tested for UI — the validation point is "does the redirect land the operator in the right place." The seven unit tests assert exactly that contract end-to-end through the fetch boundary; no UI assertion adds value.

The route's reported production symptom — "Uncaught (in promise) Error: An error occurred in the Server Components render" — was caused by the unhandled rejection demonstrated by T1. T1 reproduces that symptom in CI and the fix makes it pass; the operator-facing equivalent is "redirect lands instead of console error". Confirmed via test.

A live prod-like browser check is captured for the retrospective as a follow-up smoke item; not blocking this PR.

## F. Definition of Done (from work-list §E)

- [x] All seven tests pass; T1 fails on `main` and passes on this branch.
- [x] `pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm build` all green.
- [ ] Live browser smoke (deferred — see §E).
- [ ] PR opened (Phase 11).
- [x] No new architectural decision required.
- [ ] Retrospective (Phase 13).
