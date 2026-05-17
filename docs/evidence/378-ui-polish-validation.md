# Issue #378 — Phase 5 implement-validate evidence

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Branch: `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
Phase: 5 (implement-validate)
Date: 2026-05-17

This doc records the validation evidence for #378 per the Phase 5 contract and the work list's Validation Requirements section.

---

## Automated validation — passed

### Build
- `pnpm exec turbo run build --concurrency=1` → **12 / 12 tasks successful**, including the Next.js `@customerEQ/web` build (which is the lint-as-error gate per CLAUDE.md memory `feedback_validate_phase_must_run_build`) and the `@customerEQ/demo-storefront` Next.js build. Total time ~1m40s. No warnings escalated to errors.

### Typecheck
- `pnpm --filter @customerEQ/database typecheck` → clean
- `pnpm --filter @customerEQ/shared typecheck` → clean
- `pnpm --filter @customerEQ/api typecheck` → clean
- `pnpm --filter @customerEQ/worker typecheck` → clean
- `pnpm --filter @customerEQ/web typecheck` → clean
- `pnpm --filter @customerEQ/demo-storefront typecheck` → clean

### Lint
- `pnpm --filter @customerEQ/web lint` → **0 errors** (10 pre-existing warnings unrelated to #378: `@typescript-eslint/no-explicit-any` in `apps/web/src/app/api/mcp/route.ts` and `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx`; 1 unused-eslint-disable in `apps/web/src/components/surveys/LoopMonitor.tsx`).

### Unit tests
- `@customerEQ/shared` — **643 / 643 pass** across 25 files. New coverage:
  - `distributionTokens.test.ts` — 10 tests (entropy, hash determinism, prefix derivation, 10k collision check, known SHA-256 of `"abc"`).
  - `datetime.test.ts` — 25 tests including all 15 brand-TZ spike fixtures (PT spring-forward / fall-back, IST half-hour, NZ Southern-hemisphere DST, boundary days, 0 / 7 / 90 day presets) + exact UTC regression fixtures.
  - `zod/distributionBatch.schema.test.ts` — 27 tests including explicit assertions that the load-bearing plaintext leak vector fails parse on `BatchDetailResponseSchema` (NFR-S2) and that `TokenStatusResponseSchema` rejects identifying fields on every state (NFR-S5).
- `@customerEQ/api` — **486 / 486 smoke pass**. Includes the new `distributionListParser.test.ts` (30 / 30 cases: separators, brand-kind tie-breaker, Name <email> single + multi-token + quoted, multi-column tie-breaker, OQ-S4 explicit-empty fallback, header inference, no-header inference, blank-row skipping).

### Integration tests (real Postgres)
- `pnpm --filter @customerEQ/api test:integration` — **407 / 408 pass**.
- New coverage:
  - `test/integration/distributionBatches.test.ts` — 15 / 15 cases. Covers all 5 admin endpoints (preview / generate / list / detail / patch-expiry / regenerate-tokens), cross-brand 404 (tenant isolation), 409 SURVEY_NOT_ACTIVE, 422 AUDIENCE_EMPTY, 422 EXPIRES_AT_MUST_BE_FUTURE, 422 REGENERATION_NOT_ACKNOWLEDGED, and the JSON.stringify-doesn't-contain-`plaintext` assertion on the GET detail body.
  - `test/integration/public-respond-token.test.ts` — 13 / 13 cases. Covers `GET /token-status` for all 5 states (valid / invalid / expired / responded / survey-not-open) and cross-survey token rejection; `POST /respond` token-authorized path (201 + DB binding to distributionBatchId + distributionTokenId; token.consumedAt set), 409 on second submit, 410 on expired / survey-not-open, 422 IDENTIFIER_MISMATCH; trigger endpoint retirement (status ∈ [401, 404]) and admin integrations no longer advertises `surveyTrigger`.
- 1 failure — `survey-lifecycle.test.ts` "activates a DRAFT survey via PATCH /v1/surveys/:id/status". **Pre-existing on `main`**: the `MISSING_TITLE` activation gate was added in commit 4311aef (`impl (#241) Slice 4b`, 4 days before this branch) but the `createSurvey` test-utils factory still defaults `title: null`. Out of scope for #378 per project Rule 21 (unrelated fix → separate issue + branch).

### Migration verification (Rule R-A — high-severity risk gate)
- `pnpm --filter @customerEQ/database exec prisma migrate deploy` against the Docker Postgres test DB applied the new `20260517000000_distribution_batches` migration cleanly. The constraint move (`survey_distributions_surveyId_memberId_key` → `survey_distributions_batchId_memberId_key`) succeeded without losing existing rows (`batchId IS NULL` preserves them under Postgres NULL-distinct unique semantics).
- The follow-up `pnpm --filter @customerEQ/database typecheck` confirmed the regenerated Prisma client matches the schema.

### Environment-blocked
- `pnpm test:smoke` (the workspace-wide runner at `scripts/test-suite-runner.mjs smoke`) failed on the `ai-baml-evals` suite with `BAML eval tests require a complete Azure OpenAI configuration. Missing: AZURE_OPENAI_API_KEY`. This is environmental (no Azure OpenAI key in this shell) and is the intentional fail-loud behavior per project Rule 11a — not a #378 regression. None of #378's surfaces touch the LLM path.

---

## Manual / UI validation requirements (from work list)

Per the work list `Validation Requirements` section, this issue has:

| Requirement | Status |
|---|---|
| `uiValidationRequired` | **YES** — the admin Distribute pages, the batch detail page, the filter row, and the respondent tokenized route are new. |
| `mobileValidationRequired` | NO — admin surface is desktop-first; respondent form responsive (existing #241 chrome). |
| `browserBaselineRequired` | YES (responsive). |
| Manual browser walk | **Pending user verification** (per L1 preference `feedback_mock_drift_is_my_responsibility` — user tests functionality; I close mock-to-implementation drift proactively after the functional pass). |

The pages built in S5 / S6 are wired against the S3 / S4 endpoints that integration-test green. The dev-server walk-through covers:

1. **Configure → Generate happy path**: open `/admin/surveys/<id>` on an ACTIVE survey, click `Send via my email tool →` tile, see Configure state, pick mode (Existing Members count=N OR Custom List paste), live preview populates, click Generate. Page transitions in-place to Success state in the same URL.
2. **Success state**: green banner with token count + expiry in brand TZ, info line about one-response-per-wave, amber STRONG WARNING banner (verbatim copy from R16), format dropdown, Download CSV button. CSV opens in spreadsheet with 6 columns matching the chosen format's headers; `mergeTagUrl` column contains `https://<host>/survey/<surveyId>/r/<token>` URLs.
3. **Respondent walk**: open one of the CSV's URLs, see the survey form with the member-id field suppressed, submit. Page renders the thank-you screen. Re-click the same URL → "This survey has already been submitted. Thank you for your response!" (R20 / responded state).
4. **4 token-error pages with no-PII-in-DOM**:
   - Expired: backdate the batch's expiresAt, click any URL → "This survey link has expired…"
   - Survey-not-open: STOP the parent survey, click any URL → "This survey is no longer open…"
   - Invalid: hit `/survey/<id>/r/GARBAGE` → "This link is not valid…"
   - Responded: already covered above
   In every error DOM, assert that no `memberId`, identifier, batch label, or brand support email appears (NFR-S4).
5. **Batch detail page** at `/admin/surveys/<id>/distribute/batches/<batchId>`: header (wave label + status pill + counters), Audience block (at-send-time + now counts), Expiry control with `[Edit]` opening date-time picker (both directions), Tokens table with friendly state labels, Regenerate links + download CSV → modal with verbatim strong-warning copy → confirm regenerates and downloads a new CSV.
6. **Filter row**: on the survey detail page between Loop Monitor and Response. Default option `All waves and direct responses`. After creating a batch, dropdown lists `<wave label> · <date> · <responded / sent>`. After a share-link response lands, dropdown also includes `Direct responses (share link / embed)`. When no batches and no direct responses, the row is hidden entirely.

Per the L1 mock-drift preference: after the user reports back from the functional walk, I'll close any drift between the spec mock at `docs/feature-specs/mocks/378-distribute-flow.html` and the implementation proactively (e.g., copy verbatim alignment, button positioning, color choices, status pill semantics) without waiting for a per-item ask.

---

## Errors investigated, none "expected"

Per the FRAIM principle "Every error in logs must be investigated":

- **Rate-limit redis stub warning** (`distribute.ratelimit.skipped` event with reason `redis_unavailable`) is emitted whenever the in-handler rate-limit detects that `fastify.redis.multi` is not a function — this fires in integration tests (where the mock redis omits `multi`) and on real `QUEUE_MODE=inline` deployments. This is the graceful-degradation path per OD-3a; the structured-log warn is the documented signal.
- **BAML eval suite failure** — confirmed environmental (missing key) per project Rule 11a's fail-loud contract; not a code regression.
- **survey-lifecycle.test.ts** — pre-existing on main per the git-blame chain in commit 4311aef (#241 Slice 4b); out of scope for #378 per Rule 21.

No other errors observed in any test run or in the build output.

---

## Phase 5 outcome

All automated gates (build, typecheck, lint, unit, integration) pass for #378-specific changes. Manual UI walk-through is pending user verification per the L1 mock-drift preference. Phase 5 advances to Phase 6 (implement-security-review) on this evidence.
