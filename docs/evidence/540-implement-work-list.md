# Issue #540 — Implementation Work List

**Issue type:** Bug (P0 + 2 × P1; bundled per user directive)
**Branch:** `feature/540-bug-p0-managed-email-links-point-to-placeholder-host-logo-unsized-sent-counts-ignore-self-serve-waves`
**Worktree:** `C:\Github\mathursrus\CustomerEQ - Issue 540`

## 1. Three findings (one PR)

| ID | Severity | One-liner |
|---|---|---|
| F1 | P0 | Sent email's `{{survey_link}}` substitutes to `https://app.customereq.example/...` because the worker Container App has no `NEXT_PUBLIC_FRONTEND_URL` env var and the code falls through to a placeholder default. |
| F2 | P1 | Large brand logos fill half the email body because the `<img>` for `{{brand_logo}}` uses inline `max-width` / `max-height` only — Outlook desktop's Word renderer ignores both. |
| F3 | P1 | Survey-detail "Survey Sent: N" and "Responses X of N" exclude SELF_SERVE recipients because `Survey.sentCount` is only incremented by `markDelivered` (managed-email per-recipient) and `mark-csv-downloaded` (operator-triggered, often never fires). |

## 2. Fix shape per finding

### F1 — IaC + code defensiveness

1. **IaC (`.github/workflows/deploy.yml`)**: add a `Set Worker non-secret env vars` step mirroring the existing `Set API non-secret env vars` step (line 263-269). Sets `NEXT_PUBLIC_FRONTEND_URL=https://customereq.wellnessatwork.me` on `customereq-worker` after every deploy. Declarative, idempotent, survives container-app recreation. Plain `--set-env-vars` (not Key Vault — public URL, not a secret).
2. **Code (`apps/worker/src/processors/managedEmailSend.ts:176`)**: change the placeholder fallback to **throw at module load**. Silent fallback to a fake host is the failure mode that produced this incident; loud fail is the structural fix.
3. **Manual step (one-time)**: until the next deploy applies the IaC change, set the env var on the live container app via `az containerapp update --name customereq-worker --resource-group customereq-prod --set-env-vars NEXT_PUBLIC_FRONTEND_URL=https://customereq.wellnessatwork.me`. Record the value verification in implementation evidence.

### F2 — Outlook-respecting `<img>` attributes

`packages/shared/src/email/renderTemplate.ts:87` — change:

```html
<img src="..." alt="..." style="max-height: 60px; max-width: 200px; border: 0; vertical-align: middle;" />
```

to:

```html
<img src="..." alt="..." width="200" style="max-width:200px; max-height:60px; width:100%; height:auto; border:0; display:block;" />
```

The `width="200"` attribute is Outlook's only honored sizer for `<img>`. The `width:100%` lets modern clients use the CSS box. `height:auto` preserves aspect ratio (resize, not crop). `max-height:60px` is the upper bound for very wide-short logos in CSS-respecting clients.

### F3 — Mint-time `Survey.sentCount` increment for SELF_SERVE

Confirmed root cause via code reading:

- `apps/api/src/routes/distributionBatches.ts:1163-1190` — `mark-csv-downloaded` is the only path that bumps `Survey.sentCount` for SELF_SERVE batches. Operators frequently never hit it.
- `apps/worker/src/processors/managedEmailSend.ts:markDelivered` — bumps `Survey.sentCount` by 1 per managed-email delivery (correct).
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx:229` passes `surveyLifetimeSentCount={survey.sentCount ?? 0}` to the header strip.
- `apps/web/.../components/SurveyResponsesHeaderStrip.tsx:81` uses `surveyLifetimeSentCount` as the lifetime "Sent" number when filter = "all".

Fix: in `POST /v1/surveys/:id/distribution-batches` create handler, inside the existing transaction, for `sendMode === 'SELF_SERVE'`, bump `Survey.sentCount` by `minted.length` at mint time. The existing `mark-csv-downloaded` increment becomes redundant for the count (the audit timestamp it sets on `SurveyDistribution.sentAt` remains valuable). Drop the `Survey.sentCount` bump from `mark-csv-downloaded`; the wave-level summary `batch.sentCount` (which is `tokens.length`) already correctly reflects total-minted for both modes.

This aligns SELF_SERVE semantics with the Loop Monitor's reference behavior: "sent" means "the operator committed to sending these," whether via downloading the CSV or via dispatching managed email.

Backward compatibility — a SELF_SERVE batch created today, post-fix, that the operator had previously marked-as-downloaded twice would not double-count because `mark-csv-downloaded` no longer bumps the count. Pre-fix SELF_SERVE batches whose operator did call `mark-csv-downloaded` are already counted; no migration needed for them.

## 3. Files to change

### F1 (worker + deploy)

- [ ] `.github/workflows/deploy.yml` — add a `Set Worker non-secret env vars` step after `Deploy Worker`.
- [ ] `apps/worker/src/processors/managedEmailSend.ts` — replace placeholder fallback with throw at module-load (or first-call, depending on test ergonomics).
- [ ] `apps/worker/src/processors/managedEmailSend.test.ts` — add unit test asserting `NEXT_PUBLIC_FRONTEND_URL` is honored when set, and that an absent env var throws (or uses the prod default — TBD during implement-code).

### F2 (email template)

- [ ] `packages/shared/src/email/renderTemplate.ts` — update the `brandLogoFragment` literal.
- [ ] `packages/shared/src/email/renderTemplate.test.ts` — assert `width="..."` attribute is present and `height="auto"` is in the inline style.

### F3 (server + tests)

- [ ] `apps/api/src/routes/distributionBatches.ts` — in the create handler's transaction, bump `Survey.sentCount` by `minted.length` for SELF_SERVE. In `mark-csv-downloaded`, drop the `Survey.sentCount` increment (keep the `sentAt` audit timestamp).
- [ ] `apps/api/test/integration/distributionBatches.test.ts` — integration tests for:
  - SELF_SERVE batch create → `Survey.sentCount` bumped immediately.
  - `mark-csv-downloaded` called → `Survey.sentCount` unchanged.
  - MANAGED_EMAIL batch create → `Survey.sentCount` NOT bumped at create time (still tracked by markDelivered as today).

**File count: 6 source + 3 test = 9.** Under the 15-file ceiling.

## 4. Validation plan

### Automated

- `pnpm typecheck` — all packages green.
- `pnpm --filter @customerEQ/shared test:smoke` (renderTemplate)
- `pnpm --filter @customerEQ/api test:integration -- distributionBatches`
- `pnpm --filter @customerEQ/worker test` (managedEmailSend unit tests)

### Manual

- `uiValidationRequired: false` — F1 + F3 produce no rendered-surface change visible until you send a real email (F1) or look at the response header (F3). F2 changes one HTML attribute in the email body; the composer preview already uses inline `max-*` and would not show a difference unless we replicate the new attribute there too (which we will — preview should match worker output).
- **Post-deploy manual repro for F1**: send a managed-email test → confirm link origin is `https://customereq.wellnessatwork.me`.
- **Manual UI for F3**: send a SELF_SERVE wave → confirm "Survey Sent: N" updates immediately on the Survey detail page (does not require operator to click "I downloaded the CSV").
- **Cross-client visual for F2**: render-template unit test asserts the new HTML shape; real-client check (Outlook desktop, Gmail, Apple Mail) is a post-merge spot check, same pattern as the architecture doc's existing #420 email-template entry.
- `mobileValidationRequired: false` — admin-only surface; email rendering is checked in desktop clients.

### Production deploy validation

- After PR auto-merge + Deploy-to-Azure: re-run `az containerapp show -g customereq-prod -n customereq-worker --query "properties.template.containers[0].env"` and confirm `NEXT_PUBLIC_FRONTEND_URL` is present with the right value.

## 4b. Scope expansion mid-implementation (reviewer feedback)

After user review of the initial diff:

- **F1 fix had a real gap.** Production runs `QUEUE_MODE=inline` on both `customereq-api` and `customereq-worker`, so the API process actually runs `dispatchManagedEmailSend` in-process. Setting the env var only on the worker would have left the API throwing on every send post-deploy — worse than the placeholder bug.
- **The codebase had more wrong-host defaults than F1.** Comprehensive audit (`https?://[^\s'"]+customereq[^\s'"]+` + `\?\? ['"`]https?://`) found:
  - `apps/api/src/routes/developer.ts:8` — `API_BASE_URL ?? 'https://api.customerEQ.io'` (non-existent host shown on operator-facing Developer page)
  - `apps/api/src/routes/developer.ts:9` — `ADMIN_UI_BASE_URL ?? 'http://localhost:3000'` (localhost as prod default for survey share URLs)
  - `apps/api/src/routes/public.ts:20` — same `api.customerEQ.io` for embed widget snippets
  - `apps/api/src/routes/oauth.ts:5-6` — `localhost:4000` / `localhost:3000` OAuth fallbacks
  - `apps/worker/src/processors/loyaltyEvents.ts:27` — `localhost:4000` for worker→API callbacks
- **Wider scope decision:** all of these consume the same kind of value (canonical public URL or API origin), so they share the same fix shape (shared constant + per-container env var). Fold into #540 instead of fragmenting. User confirmed.

## 4c. New shared constants (in `packages/shared/src/constants.ts`)

- `PUBLIC_FRONTEND_HOST = 'customereq.wellnessatwork.me'` — bare host (no scheme).
- `PUBLIC_FRONTEND_URL = ` derived from `PUBLIC_FRONTEND_HOST` so the two cannot drift.
- `PUBLIC_ADMIN_UI_URL = PUBLIC_FRONTEND_URL` — alias for explicit admin-UI intent.
- `PUBLIC_API_URL = 'https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'` — **scope A** decision: keep the legacy Azure-generated FQDN as the canonical default for now. Filed follow-up **#542** for custom-domain binding (scope B).
- `EXPORTS_POWERED_BY_URL` now aliases `PUBLIC_FRONTEND_URL` (was a hand-written literal — couldn't drift before, can't now either).

## 4d. Consumer refactors (5 files)

- `apps/api/src/routes/developer.ts` — uses `PUBLIC_API_URL` + `PUBLIC_ADMIN_UI_URL`.
- `apps/api/src/routes/public.ts` — uses `PUBLIC_API_URL`.
- `apps/api/src/routes/oauth.ts` — uses `PUBLIC_API_URL` + `PUBLIC_ADMIN_UI_URL`.
- `apps/worker/src/processors/loyaltyEvents.ts` — uses `PUBLIC_API_URL`.
- `apps/api/src/routes/distributionBatches.ts` — already updated for sender-domain (uses `PUBLIC_FRONTEND_HOST`).
- `apps/api/src/routes/admin-brand-profile.ts` — already updated (SUPPORT_EMAIL_FALLBACK uses `PUBLIC_FRONTEND_HOST`).

## 4e. IaC step expansion

`.github/workflows/deploy.yml`:
- `Set API non-secret env vars` adds: `NEXT_PUBLIC_FRONTEND_URL`, `ADMIN_UI_BASE_URL`, `CEQ_ADMIN_UI_BASE_URL` (normalize from legacy Azure FQDN to friendly URL), `API_BASE_URL`.
- `Set Worker non-secret env vars` adds: `NEXT_PUBLIC_FRONTEND_URL`, `API_BASE_URL`.

## 4f. F1 resolver behavior change (mid-review)

Switched `resolveFrontendBaseUrl()` from **throw on missing** to **default to PUBLIC_FRONTEND_URL with structured warn log**. Rationale: we know the canonical host; refusing to dispatch breaks production on env-config drift, whereas a known-correct default keeps the user-facing artifact working with operations alerted via the log. Matches the existing sender-domain fallback pattern at `distributionBatches.ts:605`. Two worker unit tests were updated from "expects throw" to "expects default."

## 5. Out of scope

- **#529** — Fastify `setErrorHandler` — independent.
- **#542** — custom API domain binding (`api.customereq.wellnessatwork.me`). Scope B from this issue's audit.
- Tech debt: declarative IaC (Bicep / Container Apps YAML) to replace the 7+ inline `az containerapp update` mutations in `deploy.yml`. Worth its own ticket.
- Deprecating `Survey.sentCount` denormalization altogether — bigger refactor (19 references across schema + tests + docs). F3 fixes the consumer-visible bug without removing the field.
- Backfill of `Survey.sentCount` for historical SELF_SERVE batches that minted before this fix and where the operator never called `mark-csv-downloaded`.

## 6. Risks

- **F1 throw at module load**: if any code path imports `managedEmailSend` for non-dispatch purposes (e.g., a smoke test that doesn't set the env var), the module-load throw will be noisy. Mitigation: lazy-evaluate at first call instead of at top-level, so unit tests can mock or set the env var pre-call. Decide during implement-code.
- **F3 backward compatibility**: existing in-flight SELF_SERVE batches whose operator already called `mark-csv-downloaded` are already counted correctly; new batches are bumped at create. No retroactive change. New code skips the bump in `mark-csv-downloaded` so we don't double-count.
- **F2 width attribute math in Outlook**: `width="200"` is interpreted as 200 device-independent pixels by Outlook. For very small logos (e.g., 50×50) this UPSIZES rather than just constrains. To avoid that, the inline style's `width:100%` lets the natural box stay smaller. Accept this trade-off; the user's complaint is about LARGE logos which is the side that matters.

## 7. Test traceability

| # | AC | Layer | File |
|---|---|---|---|
| T1 | F1 — worker honors `NEXT_PUBLIC_FRONTEND_URL` env var | Unit | `apps/worker/src/processors/managedEmailSend.test.ts` |
| T2 | F1 — worker throws (or prod-defaults) on missing env var | Unit | same |
| T3 | F2 — `renderEmailHtml` emits `width="..."` attribute for `{{brand_logo}}` | Unit | `packages/shared/src/email/renderTemplate.test.ts` |
| T4 | F2 — `height:auto` inline style preserves aspect | Unit | same |
| T5 | F3 — SELF_SERVE batch create bumps `Survey.sentCount` immediately | Integration | `apps/api/test/integration/distributionBatches.test.ts` |
| T6 | F3 — `mark-csv-downloaded` no longer double-bumps | Integration | same |
| T7 | F3 — MANAGED_EMAIL batch create does NOT bump `Survey.sentCount` (still per-delivery) | Integration | same |
| T8 | Deploy verification (post-merge) | Manual | recorded in implementation evidence |
| T9 | Production send (post-deploy) — link origin correct | Manual | recorded in implementation evidence |
