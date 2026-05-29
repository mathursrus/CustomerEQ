# Issue #543 — Implementation Work List

**Issue type:** Bug (2 × P1; bundled per user directive — files disjoint)
**Branch:** `feature/543-bug-p1-survey-sentcount-denormalized-field-excludes-historical-self-serve-recipients-minted-pre-540`
**Worktree:** `C:\Github\mathursrus\CustomerEQ - Issue 543`

## 1. Two findings

| ID | Severity | One-liner |
|---|---|---|
| F1 | P1 | Historical `Survey.sentCount` for SELF_SERVE batches minted pre-#540 never got bumped; user sees "Sent: 2" vs Loop Monitor's "43" on the same survey. |
| F2 | P1 | Tokenized respondent page (`/survey/:id/r/:token`) flashes a red "Failed to load survey" card during the brief window between token-status preflight resolving to `valid` and the form's data-fetch `useEffect` firing. |

## 2. Fix shape

### F1 — Prisma migration, truth recomputation

`packages/database/prisma/migrations/20260529100000_backfill_survey_sent_count_self_serve/migration.sql`:

```sql
UPDATE "Survey" s
SET "sentCount" = COALESCE((
  SELECT COUNT(t."id")
  FROM "SurveyDistributionToken" t
  JOIN "DistributionBatch" b ON b."id" = t."batchId"
  WHERE b."surveyId" = s."id" AND b."sendMode" = 'SELF_SERVE'
), 0) + COALESCE((
  SELECT COUNT(d."id")
  FROM "SurveyDistribution" d
  JOIN "DistributionBatch" b ON b."id" = d."batchId"
  WHERE b."surveyId" = s."id" AND b."sendMode" = 'MANAGED_EMAIL'
        AND d."deliveredAt" IS NOT NULL
), 0)
WHERE EXISTS (
  SELECT 1 FROM "DistributionBatch" b WHERE b."surveyId" = s."id"
);
```

- **Timestamp**: `20260529100000` — later than the most recent migration on `origin/main` (`20260523050000_add_managed_email_send`) per Rule 22c.
- **Hand-written SQL only**, no Prisma schema change. Quoted camelCase identifiers per Rule 22a — verified via grep on `20260523050000_add_managed_email_send/migration.sql` (uses same convention).
- **Idempotent**: re-running computes the same number from the truth tables; doesn't add to the existing field.
- **WHERE EXISTS** guard keeps the update touching only surveys that have ever distributed.

### F2 — Inner `if` guard in the respondent-page error fall-through

`apps/web/src/app/survey/[id]/r/[token]/page.tsx` (around line 188):

```tsx
if (!form.resolvedSurvey || !form.brandLite) {
  // Issue #543 F2 — the fall-through is reachable in two distinct
  // states: (a) the form fetch genuinely failed (form.error /
  // form.loadError populated), or (b) we're in the brief render
  // window between tokenState flipping to 'valid' and form's
  // useEffect firing (no error yet, no loading state, no data).
  // The page used to render the red error card for both — which
  // flashed scary "Failed to load survey" copy at every respondent
  // for ~50-200ms. The inner guard routes (b) back to the existing
  // Loading state.
  if (!form.error && !form.loadError) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-center">
          <p className="p-8 text-gray-500">Loading…</p>
          <PoweredByFooter variant="neutral" channel="link" />
        </div>
      </main>
    )
  }
  // ...existing error render path unchanged
}
```

Variant A (preferred) over Variant B per the issue. Comment explains *why* the inner guard exists so the next reader doesn't think it's redundant.

## 3. Files to change

### F1 (database + integration test)

- [ ] `packages/database/prisma/migrations/20260529100000_backfill_survey_sent_count_self_serve/migration.sql` — new file.
- [ ] `apps/api/test/integration/distributionBatches.test.ts` — add a `describe('Survey.sentCount backfill migration (#543 F1)', ...)` block that seeds historical state, runs the SQL via `prisma.$executeRawUnsafe`, and asserts truth + idempotency.

### F2 (web + unit test)

- [ ] `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — add the inner-`if` guard at the error fall-through.
- [ ] `apps/web/src/app/survey/[id]/r/[token]/page.test.tsx` — new sibling test file. Asserts:
  - When `tokenState === 'valid'` AND `form.loading === false` AND `form.resolvedSurvey === null` AND `form.error === null` → Loading state renders, NOT the error card.
  - When `form.error` is populated → error card renders with the message.

**File count: 4 source + 0 evidence-files-yet = 4.** Way under the 15-file ceiling.

## 4. Validation plan

### Automated

- `pnpm --filter @customerEQ/database test` — database unit tests still green post-migration-add.
- `pnpm --filter @customerEQ/api test:integration -- distributionBatches` — new F1 test passes.
- `pnpm --filter @customerEQ/web test -- page.test.tsx` — new F2 unit test passes.
- `pnpm db:migrate` — migration applies cleanly against the local Postgres.
- `pnpm typecheck` + `pnpm build` — all packages green.

### Manual

- `uiValidationRequired: false` — F2 visual change is a render-condition fix, no new affordances; the unit test asserts the absence of the error card during the transient.
- **Post-deploy verification (user-driven)**:
  - F1: re-open "Are you FRAMING It?" survey on prod; Survey Sent: N now matches Loop Monitor's 43.
  - F2: click a survey link from a real email; no red error card flashes before the survey renders.

## 5. Out of scope

- **#542** — bind custom API domain.
- **#529** — Fastify setErrorHandler normalization.
- Removing `Survey.sentCount` denormalized field entirely (compute-on-read refactor). Out-of-scope per #540's original decision; this issue's backfill makes the field consistent with post-#540 semantics, which is sufficient.
- The 4 token-error states (expired / responded / survey-not-open / invalid) on the respondent page — already correct; #413 R12 byte-identity assertion locks them.

## 6. Risks

- **F1 — race on simultaneously-running batch creates**. If a SELF_SERVE batch finishes its create-transaction mid-migration, the count could double-bump (mint-time `+= minted.length` AND the migration's `COUNT(t.id)` both include the new tokens). Migration runs against the live DB on deploy; the create handler bumps within a Prisma transaction. The migration's SQL uses subqueries against the same tables — should the migration acquire a lock first? Postgres default is row-level locking on the rows being updated, but the subqueries read from `SurveyDistributionToken` and `SurveyDistribution`. For a brief window, a new batch's mint could land between the subquery read and the UPDATE write, producing a sentCount one batch behind truth on that Survey row. Likely negligible — batches per minute are << 1 in this product. Note in the migration SQL as a known small-race; not worth a `LOCK TABLE` for an order-1 inconsistency.
- **F2 — loading-state flash now persists longer**. The fix routes the in-between state to Loading instead of the red error card. The Loading state is the correct UX for "not yet loaded"; no regression there. If the form's useEffect never fires (form is genuinely broken), Loading would persist indefinitely instead of showing an error — but only if `form.error` and `form.loadError` are also null. The hook's contract is that one of those is populated when the fetch fails. Verified by re-reading `useSurveyResponseForm`.

## 7. Test traceability

| # | AC | Layer | File |
|---|---|---|---|
| T1 | F1 — SELF_SERVE backfill (2 batches × 10+5 tokens) | Integration | `apps/api/test/integration/distributionBatches.test.ts` |
| T2 | F1 — MANAGED_EMAIL counted only when `deliveredAt IS NOT NULL` | Integration | same |
| T3 | F1 — Idempotent (rerun produces same value) | Integration | same |
| T4 | F1 — Surveys with no batches keep `sentCount = 0` | Integration | same |
| T5 | F2 — Loading state holds across tokenState→valid / form-loading→true transition | Unit | `apps/web/.../page.test.tsx` |
| T6 | F2 — Error card still renders when `form.error` populated | Unit | same |
| T7 | F1+F2 — Post-deploy manual on FRAIM org survey | Manual | recorded in implementation evidence |
