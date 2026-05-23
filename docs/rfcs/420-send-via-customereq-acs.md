# Feature: Send Survey Emails via CustomerEQ (ACS) — RFC

Issue: [#420](https://github.com/mathursrus/CustomerEQ/issues/420)
Owner: Claude (claude-opus-4-7) / manohar.madhira@outlook.com
Status: Round 2.1 — adds the 4 TECHSPEC-template sections missed in Rounds 1–2 (Confidence Level §9, Spike Decision §9.3–9.4, Validation Plan user-scenario table §7.0, Observability §13). Coaching moments: `…2026-05-23T03-19-55-precedent-as-recommendation-without-tradeoff-analysis.md` + `…2026-05-23T04-59-52-skipped-template-fetch-because-i-thought-i-knew-the-shape.md`.
Spec: [`docs/feature-specs/420-send-via-customereq-acs.md`](../feature-specs/420-send-via-customereq-acs.md) (R7)
Evidence: [`docs/evidence/420-technical-design-evidence.md`](../evidence/420-technical-design-evidence.md) (to be created at submission)

> **Closes:** #420.
> **Builds on:** [#378](https://github.com/mathursrus/CustomerEQ/issues/378) (`DistributionBatch` / `SurveyDistributionToken` / `SurveyDistribution` data model; tokenized survey URLs; audience-builder primitives), [#231](https://github.com/mathursrus/CustomerEQ/issues/231) (`Member.email` nullable, `Brand.memberIdentifierKind`, `Member.consentGivenAt`), [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (`Brand.timezone`), [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (survey detail page, Loop Monitor surface), [#291](https://github.com/mathursrus/CustomerEQ/issues/291) (`BrandTheme` model post-rename).
> **Resolved decisions** (from spec R6–R7): OQ-1 sender-domain fallback order, OQ-2 glob syntax, OQ-3 brand-wide opt-out, OQ-4 Loop Monitor + Response-header surfacing, OQ-5 rich-text editor deferred to this RFC, OQ-6 #378 drop-in reshape, OQ-7 `Brand.logoUrl` verified existing, OQ-NEW-1 separate `unsubscribedSurveysAt` (distinct from `emailOptIn`).
> **Open RFC decisions** (D1–D6): see *Open Decisions for Reviewer* (§10) and *Confidence + Spike Decision* (§9).

---

## Customer + Customer Problem

Same operator persona as #378 — marketing managers / CX operators running quarterly NPS/CSAT programs. #378 served the BYO-ESP subset; #420 serves the operators who want CustomerEQ to actually send the email (no ESP / cleaner brand voice / one-flow simplicity). Full persona narrative + Customer-Problem framing in the spec.

## User Experience that will solve the problem

UX is fully detailed in the spec (§1–§5) + [interactive mock](../feature-specs/mocks/420-send-via-customereq-acs.html). RFC scope is the implementation underneath those surfaces. One-line operator path:

1. **Distribution tile reshape** (existing survey-detail page): leftmost tile becomes "Send via Email" with two equal-weight buttons — `Send via CustomerEQ →` and `Send via my email tool →` (each routes to `/admin/surveys/[id]/distribute?mode=managed-email` or `?mode=self-serve`).
2. **Single shared page** (`/admin/surveys/[id]/distribute?mode=…`): Survey Batch details (Survey name in mail + Links expire on) → Audience builder (Existing Members search + Random sample / Custom List paste/CSV; merged, deduped; suppressed members visible-but-disabled) → mode-specific composer (managed-email: sender + body + theme-rendered preview; self-serve: format dropdown) → CTA + confirm modal → terminal state.
3. **Managed-email worker dispatch**: per-recipient BullMQ jobs → ACS provider → row-level `sentAt` / `failedAt` updates → Sending state polls for progress; Sent state renders summary + Retry-Failed.
4. **Survey detail page surfacing**: Loop Monitor stat-card (lifetime Survey Sent, mode breakdown sub-line) + Responses section header (Wave-filtered Sent + Responses).
5. **Wave Detail page** preserves #378 §3.1 affordances for self-serve; managed-email batches gain a Composer snapshot block + per-recipient send log.

---

## Technical Details

### 1. Schema changes

`packages/database/prisma/schema.prisma` — five model modifications, one new model, one new enum. All new tenant-scoped tables carry `brandId` per Rule 6.

#### 1.1 New enum: `SurveySendMode`

```prisma
enum SurveySendMode {
  SELF_SERVE      // #378 path — operator downloads CSV
  MANAGED_EMAIL   // #420 path — platform sends via the email connector (currently ACS-backed)
}
```

#### 1.2 New column: `Brand.managedEmailSenderDomain`

```prisma
model Brand {
  // ... existing fields ...
  managedEmailSenderDomain  String?  // V1+: operator-configured custom sender domain. Null in V0 (custom domains not offered until ACS custom-domain verification ships). Resolution falls through to AZURE_COMMUNICATION_SERVICES_EMAIL_FROM env parsed-domain → hard-coded `customereq.wellnessatwork.me`.
}
```

#### 1.3 New column: `Member.unsubscribedSurveysAt`

```prisma
model Member {
  // ... existing fields (including emailOptIn — UNTOUCHED, stays as marketing-channel preference) ...
  unsubscribedSurveysAt  DateTime?  // brand-wide survey-specific opt-out. Distinct from emailOptIn (marketing channel). Survey emails are exempt from the marketing opt-out per legitimate-interest use case (Round-7 reviewer call).
}
```

#### 1.4 New column: `Survey.sentCount`

```prisma
model Survey {
  // ... existing fields ...
  sentCount  Int  @default(0)  // denormalized aggregate. Per spec §G semantics: SELF_SERVE += tokenCount on CSV download (and re-increments on Regenerate); MANAGED_EMAIL += 1 per worker transition of SurveyDistribution to sentAt IS NOT NULL.
}
```

#### 1.5 Modified columns: `DistributionBatch`

```prisma
model DistributionBatch {
  // ... existing #378 fields ...
  sendMode         SurveySendMode  @default(SELF_SERVE)  // backfill existing rows to SELF_SERVE in the migration
  composerSnapshot Json?                            // MANAGED_EMAIL only: {senderName, senderAlias, senderDomain, subject, body, footerTemplate, brandLogoUrl, themeSnapshot}. Null for SELF_SERVE.
}
```

#### 1.6 Modified columns: `SurveyDistribution`

```prisma
model SurveyDistribution {
  // ... existing #378 fields. sentAt stays DateTime @default(now()) NOT NULL — UNCHANGED. ...
  enqueuedAt    DateTime?         // MANAGED_EMAIL: set when worker job enqueued. SELF_SERVE: null (no enqueue).
  deliveredAt   DateTime?         // NEW. MANAGED_EMAIL only: set when the email provider confirmed delivery (EmailClient.beginSend().pollUntilDone() returned 'succeeded'). Survey.sentCount increments when this transitions NULL → timestamp.
  failedAt      DateTime?         // NEW. MANAGED_EMAIL only: set when worker confirmed dispatch failure. Mutually exclusive with deliveredAt on the same row.
  failureReason String?           // NEW. MANAGED_EMAIL only: bounded reason ('bounce' | 'invalid_address' | 'skipped_unsubscribed' | 'skipped_no_consent' | 'skipped_erased' | 'skipped_no_email' | 'transient_error_after_retries').
  sendMode      SurveySendMode    // denormalized mirror of parent batch.sendMode for fast aggregation without a join.

  @@index([surveyId, sendMode, deliveredAt])  // Survey.sentCount aggregation by mode (MANAGED_EMAIL counts on deliveredAt)
  @@index([surveyId, sendMode, sentAt])       // Survey.sentCount aggregation for SELF_SERVE (counts on sentAt updates from mark-csv-downloaded)
}
```

> **D1 (sentAt semantics — Round-2 simplification per reviewer r3291886241)** — `sentAt` stays `DateTime @default(now())` NOT NULL, unchanged. No `ALTER COLUMN sentAt DROP NOT NULL`. Two semantics preserved cleanly:
> - **SELF_SERVE**: `sentAt = creation time` at mint (existing #378 default), then OVERWRITTEN to `now()` by the `mark-csv-downloaded` endpoint when the operator clicks Download CSV. Regenerate Links re-overwrites it. Survey.sentCount increments by tokenCount on each mark-csv-downloaded transition.
> - **MANAGED_EMAIL**: `sentAt = creation time` at mint (= enqueue time, effectively). Worker dispatches the email; on provider success, sets `deliveredAt = now()` (separate column, not overloading sentAt). Survey.sentCount increments by 1 on each deliveredAt transition (NULL → timestamp).
> - **Historical #117/#378 rows**: unchanged. `sentAt` = original mint time; `deliveredAt` = NULL (they're SELF_SERVE-style; no delivery confirmation concept).
>
> This avoids both (a) a column-nullability migration risk and (b) the need to retroactively backfill sentAt for historical rows. Reviewer's framing (*"Historical Sent At can be the date row was created"*) is the design.

#### 1.7 New model: `MemberUnsubscribeToken`

```prisma
model MemberUnsubscribeToken {
  id          String    @id @default(cuid())
  brandId     String                              // Rule 6
  memberId    String
  member      Member    @relation(fields: [memberId], references: [id])
  batchId     String                              // links the unsub click back to the wave that triggered it (audit trail)
  batch       DistributionBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique                   // SHA-256(plaintext); plaintext is rendered into the email footer once, never stored
  tokenPrefix String                              // first 8 chars of plaintext, for audit display
  createdAt   DateTime  @default(now())
  consumedAt  DateTime?                           // set when /u/:token/confirm POSTed; idempotent re-confirmations are no-ops

  @@index([memberId])
  @@map("member_unsubscribe_tokens")
}
```

### 2. Migration strategy

**Per reviewer r3291902423** (*"Aren't any schema changes required before Migration?"*): the §1 model additions in `packages/database/prisma/schema.prisma` and the migration SQL are inseparable — both ship in the same commit. Prisma's flow is: edit `schema.prisma` first, then `prisma migrate dev --create-only` to scaffold the SQL, then hand-edit the SQL to match the §1 contracts exactly (especially for the new defaults, indexes, and the `SurveySendMode` enum). Forward-only per architecture §3.4.

Single hand-edited migration `<YYYYMMDD><HHMMSS>_add_managed_email_send/migration.sql`. Steps (Round-2 simplified — no `sentAt` nullability change per D1):

1. `CREATE TYPE "SurveySendMode" AS ENUM ('SELF_SERVE', 'MANAGED_EMAIL');`
2. `ALTER TABLE "brands" ADD COLUMN "managedEmailSenderDomain" TEXT;`
3. `ALTER TABLE "members" ADD COLUMN "unsubscribedSurveysAt" TIMESTAMP(3);`
4. `ALTER TABLE "surveys" ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0;` (**no backfill** per reviewer r3291984458 — existing rows start at 0; this is the same pattern `Survey.responsesCount` and `Survey.distributionCount` follow today — verified at `schema.prisma:614-615`. The historical distribution count is queryable from `SurveyDistribution` if anyone needs it; the new counter is forward-incremented from #420 onward.)
5. `ALTER TABLE "distribution_batches" ADD COLUMN "sendMode" "SurveySendMode" NOT NULL DEFAULT 'SELF_SERVE';` (D2: every existing batch was a #378 SELF_SERVE batch; default backfill is correct)
6. `ALTER TABLE "distribution_batches" ADD COLUMN "composerSnapshot" JSONB;`
7. `ALTER TABLE "survey_distributions" ADD COLUMN "enqueuedAt" TIMESTAMP(3);`
8. `ALTER TABLE "survey_distributions" ADD COLUMN "deliveredAt" TIMESTAMP(3);` (NEW per D1 simplification — MANAGED_EMAIL provider-confirmed delivery; sentAt unchanged)
9. `ALTER TABLE "survey_distributions" ADD COLUMN "failedAt" TIMESTAMP(3);`
10. `ALTER TABLE "survey_distributions" ADD COLUMN "failureReason" TEXT;`
11. `ALTER TABLE "survey_distributions" ADD COLUMN "sendMode" "SurveySendMode" NOT NULL DEFAULT 'SELF_SERVE';` (mirror of parent batch; historical rows default-fill to SELF_SERVE matching their batch)
12. `CREATE TABLE "member_unsubscribe_tokens" ( ... );` + indexes per §1.7
13. `CREATE INDEX "survey_distributions_surveyId_sendMode_deliveredAt_idx" ON "survey_distributions" ("surveyId", "sendMode", "deliveredAt");`
14. `CREATE INDEX "survey_distributions_surveyId_sendMode_sentAt_idx" ON "survey_distributions" ("surveyId", "sendMode", "sentAt");`

### 3. API endpoints

#### 3.1 Extended: `POST /v1/surveys/:id/distribution-batches`

Per spec §API. Existing #378 endpoint extended with `sendMode` discriminator. Body shape:

```ts
type GenerateBatchBody = {
  surveyNameInMail?: string                          // defaults to Survey.title → Survey.name
  expiresAt: string                                  // ISO 8601
  audience: { members: AudienceMember[] }            // shared shape across modes
  sendMode?: 'SELF_SERVE' | 'MANAGED_EMAIL'          // optional; defaults to SELF_SERVE (preserves #378 contract)
  format?: 'generic' | 'mailchimp' | 'hubspot' | 'klaviyo'   // required when sendMode = SELF_SERVE
  composer?: {                                       // required when sendMode = MANAGED_EMAIL
    senderName: string                               // max 50
    senderAlias: string                              // matches /^[a-z0-9._-]+$/
    subject: string                                  // max 200
    body: string                                     // must contain literal '{{survey_link}}' (regex check)
  }
}
```

Handler (mode-branching):

1. Validate audience + composer (Zod schema in `packages/shared/src/zod/distributionBatches.ts`).
2. Resolve sender-domain (R25 fallback order). If falling through to hard-coded, emit `fastify.log.warn({ event: 'email.sender_domain.fallback', reason: 'acs_env_unset', brandId })`.
3. **Two-gate suppression check** (per §13.7 / R44, applied at audience-resolution time for the audience-builder gate, *and* re-checked per-recipient at worker dispatch for the second gate):
   - At audience-resolution time, return Status chip per recipient: `OK` / `Unsubscribed` / `No consent` / `Erased`. Suppressed rows are returned in the response but flagged for UI to disable their checkboxes.
4. In a single `prisma.$transaction(async (tx) => { ... })`:
   - Create `DistributionBatch` with `sendMode` + (for MANAGED_EMAIL) `composerSnapshot`.
   - Mint `SurveyDistributionToken` per recipient (existing #378 logic).
   - For MANAGED_EMAIL: mint one `MemberUnsubscribeToken` per recipient.
   - Write `SurveyDistribution` rows (`enqueuedAt = now()` for MANAGED_EMAIL; `sentAt = null` for both — MANAGED_EMAIL sets it at delivery, SELF_SERVE sets it at CSV download).
5. After transaction commits:
   - **SELF_SERVE**: return `201 { batchId, label, expiresAt, tokens: [{memberId, identifier, firstName, lastName, plaintext}] }` (plaintext URLs in response body for one-shot CSV materialization; this is the only server transmission, per #378 §NFR-S2).
   - **MANAGED_EMAIL**: enqueue one `survey-distribution-send` BullMQ job per recipient. Return `201 { batchId, label, expiresAt, recipientCount, sendingStatusUrl: '/v1/surveys/.../distribution-batches/:batchId/send-progress' }`.
6. Audit-log: `distribution_batch.create` with allowlist `[surveyId, batchId, sendMode, recipientCount, autoEnrolledCount, requestIp]`.

#### 3.2 New: `POST /v1/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded` (SELF_SERVE)

Per spec §API. Idempotent. Steps:

1. Validate batch exists, brandId matches request.brandId, batch.sendMode = SELF_SERVE.
2. Compute Δ = count of SurveyDistribution rows where `batchId = :batchId AND sentAt IS NULL`. (For first call: Δ = tokenCount. For Regenerate-after: Δ = 0 since all rows already have sentAt from the previous mark, but the Regenerate flow re-nulls them — see §3.3.)
3. `UPDATE survey_distributions SET sentAt = now() WHERE batchId = :batchId AND sentAt IS NULL`
4. `UPDATE surveys SET sentCount = sentCount + Δ WHERE id = :surveyId`
5. Audit-log: `distribution_batch.csv_downloaded` with `{ batchId, delta }`.
6. Return `200 { batchId, sentAt: <now>, sentCountDelta: Δ, surveySentCount: <updated> }`.

#### 3.3 Existing: `POST /v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens` (extended)

**Behavior options considered** (per reviewer r3291992540 — *"Is the previous pattern correct or structurally incorrect? What are the choice options and compromises?"*):

| Option | What happens to sentAt on regenerate | Pros | Cons |
|---|---|---|---|
| **A. Overwrite sentAt on regenerate** (recommended) | UPDATE sentAt = now() for every row in the batch when the operator clicks Regenerate-and-download-CSV | Sent-count semantically = "most-recent dispatch handoff" — matches the operator's mental model ("I just regenerated; the new dispatch is now"). `Survey.sentCount` += tokenCount for the second download — aligns with "if they re-sent the wave, it counts as a re-send" | Loses the original dispatch timestamp from the row. (Mitigation: AuditLog row preserves the history — `distribution_batch.tokens_regenerated` event has both the old and new timestamps.) |
| B. Preserve original sentAt; add a `regeneratedAt` column | Original sentAt stays; new `regeneratedAt` column tracks the most recent regen | Both timestamps available in-row | Extra column for a rarely-needed historical signal; complicates `Survey.sentCount` semantics (when do we count?); inconsistent with how `SELF_SERVE.sentAt` is already overwriteable on CSV-download anyway |
| C. Don't touch sentAt at all | Regenerate only swaps tokenHash/tokenPrefix; sentAt stays | Simplest | Operator clicks Regenerate-and-download-CSV expecting "I just dispatched fresh links" but `Survey.sentCount` doesn't update; mental-model mismatch with the spec's stated "Regenerate = new dispatch event" semantics |

**Round-2 recommendation**: **Option A** (overwrite sentAt on regenerate). The #378 endpoint is preserved; #420 only extends the side-effect to UPDATE sentAt + null-out failedAt/failureReason on every row in the batch. Audit-log: `distribution_batch.tokens_regenerated` with allowlist `{batchId, regeneratedCount, previousSentAt, newSentAt}` so the historical record survives.

**Structurally**: the #378 pattern (mint-time sentAt + regenerate replaces tokenHash) was correct for #378's scope but didn't anticipate sentCount semantics. Option A is the minimal extension that keeps the existing #378 contract intact for the existing endpoint surface (regenerate still returns new plaintexts in a one-shot response) while adding the sentAt + sentCount side-effect that the new Survey-level counter needs.

#### 3.4 New: `GET /v1/surveys/:id/distribution-batches/:batchId/send-progress` (MANAGED_EMAIL)

**Polling, not SSE** (D3 — see Open Decisions). Returns:

```ts
{
  batchId: string
  recipientCount: number
  queuedCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  isComplete: boolean
  recipients: Array<{
    memberId: string
    identifier: string
    firstName: string | null
    lastName: string | null
    status: 'queued' | 'sending' | 'sent' | 'failed'
    deliveredAt: string | null   // MANAGED_EMAIL provider-confirmed delivery (null until worker confirms)
    failedAt: string | null
    failureReason: string | null
  }>
}
```

Client polls every 2 seconds during the Sending state; stops when `isComplete === true`. (D3: see Open Decisions for SSE alternative.)

#### 3.5 New: `POST /v1/surveys/:id/distribution-batches/:batchId/retry-failed`

Re-enqueues `survey-distribution-send` jobs for every `SurveyDistribution` row in the batch with `failureReason IN ('transient_error_after_retries', 'bounce')`. Excludes suppressed rows (`skipped_*` reasons) — not retryable. Returns `{ retriedCount }`. Audit: `distribution_batch.retry_failed`.

#### 3.6 New: `GET /u/:token` (public) + `POST /u/:token/confirm` (public)

Per spec §5. No auth. Idempotent confirm. `POST /confirm` runs a single update: `UPDATE members SET unsubscribedSurveysAt = COALESCE(unsubscribedSurveysAt, now()) WHERE id = ?` (idempotent — preserves the original timestamp on re-confirm) and marks the `MemberUnsubscribeToken.consumedAt`. Audit: `member.unsubscribed_surveys`.

#### 3.7 Extended: `GET /v1/members?q=<glob>`

Per spec §API. Adds glob translation: `*` → `%`, `?` → `_`, after escaping operator-literal `%` / `_` / `\` characters. Case-insensitive. Applied against `(externalId OR email OR firstName OR lastName) ILIKE ?`. PageSize default 25 (operator-selectable up to 100).

### 4. Worker: `managed-email-send` queue

**Queue name**: `managed-email-send` — deliberately distinct from the existing `survey-distribute` queue (verified at `packages/shared/src/queues.ts:14` and `apps/worker/src/processors/surveyDistribute.ts`) which is #117's event-trigger-based survey notification. Adding to the `QUEUES` const object:

```ts
// packages/shared/src/queues.ts
export const QUEUES = {
  // ... existing entries ...
  MANAGED_EMAIL_SEND: 'managed-email-send',   // NEW (#420) — per-recipient managed-email dispatch for distribution batches
} as const
```

```ts
// apps/worker/src/processors/managedEmailSend.ts
export async function processManagedEmailSend(job: Job<ManagedEmailSendPayload>) {
  // 1. Load member + batch + composerSnapshot (single query)
  // 2. Pre-dispatch second-gate check (§13.7 / R44):
  //    - if member.erased → fail Skipped: member erased (no retry)
  //    - if member.unsubscribedSurveysAt IS NOT NULL → fail Skipped: unsubscribed
  //    - if member.consentGivenAt IS NULL → fail Skipped: no consent
  //    - if member.email IS NULL → fail Skipped: no email on record
  //    - NOTE: emailOptIn is NOT checked — surveys exempt from marketing opt-out
  // 3. Render email:
  //    - Resolve theme: Survey.themeId → Brand.defaultThemeId → CustomerEQ defaults
  //    - Render mustaches: {{survey_link}}, {{first_name}}, {{last_name}}, {{survey_title}}, {{sender_name}}, {{brand_name}}, {{brand_logo}}
  //    - Inline theme colors into <style> block + <body>
  //    - Wrap unsubscribe link with the MemberUnsubscribeToken plaintext
  // 4. Call packages/connectors/src/email.ts:sendEmailMessage(
  //      { to: member.email, subject: rendered.subject, html: rendered.html, plainText: rendered.plain },
  //      { senderAddress: `${composerSnapshot.senderAlias}@${composerSnapshot.senderDomain}` }
  //    )
  // 5. On success: UPDATE survey_distributions SET deliveredAt = now() WHERE id = ?; UPDATE surveys SET sentCount = sentCount + 1
  //    (sentAt unchanged — preserves the mint-time semantic; deliveredAt is the new per-mode "actually sent" signal)
  // 6. On failure (provider non-success or thrown):
  //    - Classify reason (bounce / invalid_address / transient_error_after_retries — last retry exhausted)
  //    - UPDATE survey_distributions SET failedAt = now(), failureReason = ? WHERE id = ?
  //    - BullMQ retries the job up to 3x with exponential backoff for transient_error; bounce / invalid_address skip retry (throw immediately + return false from retry-policy check)
  // 7. Audit: write event = 'managed_email.send_attempt' with allowlist {batchId, memberId, status, failureReason?}
}
```

**Concurrency**: see D5 below — recommendation grounded in expected V0 send volume + ACS rate limits + per-send latency, not in queue-precedent.

**`packages/connectors/src/email.ts` change** (verified at lines 120–167 of current file): `sendEmailMessage()` today reads `senderAddress` only from `getAzureSenderAddress(env)`. #420 adds an optional **second-arg override**:
- `sendEmailMessage(message, opts: { env?, logger?, senderAddress? })` — when `senderAddress` is passed, it bypasses the env-based resolution and uses the override directly. Backward-compatible — existing `notifications` callers don't pass it and continue to use the env default.

### 5. Frontend component hierarchy

```
apps/web/src/app/(admin)/admin/surveys/[id]/
  distribute/
    page.tsx                                    // existing — extend to read ?mode= and switch composer
    components/
      DistributePage.tsx                        // NEW or refactored — owns the mode-parameterized shell
      SurveyBatchDetailsCard.tsx                // NEW — Survey name in mail + Links expire on (shared)
      AudienceBuilder/                          // SHARED across modes
        AudienceBuilder.tsx                     // NEW shell + state
        AddFromExistingMembersCard.tsx          // NEW — wildcard search + random sample tab with Add button
        AddFromCustomListCard.tsx               // NEW — paste/CSV + email-format relaxation
        AudienceList.tsx                        // NEW — unified deduped table with Status column + suppressed-rows
      ManagedEmailComposer.tsx                  // NEW — sender + subject + body editor + live preview
      SelfServeComposer.tsx                     // NEW — format dropdown only
      ConfirmModal.tsx                          // NEW — mode-aware copy
      SelfServeSuccess.tsx                      // moved from existing distribute/page.tsx — CSV download
      ManagedEmailProgress.tsx                  // NEW — Sending + Sent states, polling, recipient table, Retry-Failed
    batches/[batchId]/
      page.tsx                                  // existing — extend with sendMode pill + Composer snapshot block (managed)
  page.tsx                                      // existing survey-detail page — extend Loop Monitor stat-card + Responses header
```

**Rich-text editor library (OQ-5 resolution)**: **TipTap** v2 (extension-based, headless React; MIT-licensed; battle-tested). Already a candidate per spec; reviewer signed off in R6 to defer to RFC. RFC locks TipTap unless reviewer objects on D4.

**Email-rendering library**: vanilla template (no external library). Mustache token replacement via a simple regex (no Handlebars dependency — the variable set is closed at 7 tokens, regex is sufficient and avoids a new dependency).

### 6. Theme rendering for emails

Worker renders HTML body with inline styles (email clients require inline styling for reliable rendering):

```html
<body style="background-color: <theme.backgroundColor>; color: <theme.textColor>; font-family: <theme.fontFamily>;">
  <div style="text-align: center; padding: 24px;">
    <!-- {{brand_logo}} renders here if Brand.logoUrl present, else empty -->
    <img src="<Brand.logoUrl>" alt="<Brand.name>" style="max-height: 60px; max-width: 200px;" />
    <h1 style="color: <theme.primaryColor>; font-size: 18px; font-weight: 600;"><Brand.name></h1>
  </div>
  <div style="padding: 16px 24px;">
    <!-- operator's body, mustache-rendered. Survey link wrapped in <a style="color: <accentColor>; text-decoration: underline;"> -->
  </div>
  <hr style="border: 0; border-top: 1px solid <theme.secondaryColor>; margin: 24px;" />
  <div style="padding: 16px 24px; font-size: 11px; color: <theme.textColor>; opacity: 0.7;">
    You received this survey because you're a customer or partner of <Brand.name>.
    <a href="<frontend-host>/u/<unsub-token>" style="color: <theme.accentColor>;">Unsubscribe</a>
  </div>
</body>
```

Plaintext multipart counterpart: no styling, mustache-rendered text + raw URLs.

Theme resolved at worker job time + snapshotted into `DistributionBatch.composerSnapshot.themeSnapshot`. So if `BrandTheme` is edited between batch creation and the worker dispatching the last recipient, every email in that batch still uses the palette frozen at batch-creation.

### 7. Validation Plan

#### 7.0 User-scenario × expected-outcome × validation-method table (per TECHSPEC template)

| # | User Scenario | Expected Outcome | Validation method |
|---|---|---|---|
| V1 | Operator clicks **Send via CustomerEQ →** in the Distribution tile of a survey | Routes to `/admin/surveys/[id]/distribute?mode=managed-email`; Survey Batch Details, Audience builder, and ManagedEmailComposer all render | E2E (Playwright) |
| V2 | Operator clicks **Send via my email tool →** in the same tile | Routes to `?mode=self-serve`; same shared shell renders SelfServeComposer with format dropdown instead of ManagedEmailComposer | E2E |
| V3 | Operator searches Existing Members with glob `*@artistos.com` | List returns every member whose email ends `@artistos.com` plus name-matches; suppressed (unsubscribed / no-consent / erased) rows visible with checkbox disabled + Status chip | API + E2E |
| V4 | Operator pastes 1 email + 1 phone in Add Custom List when Brand identifier = phone | Email row is auto-rolled by `Member.email` lookup; unresolved phone surfaces as a *"Cannot auto-roll because Brand Identifier is phone"* error row | UI + E2E |
| V5 | Operator confirms a MANAGED_EMAIL batch with 5 recipients (1 unsubscribed-since-selection) | API returns 201; worker re-checks suppression; 4 emails dispatched, 1 row lands with `failureReason='skipped_unsubscribed'` and no provider call; Survey.sentCount increments by 4 | API + DB + worker integration |
| V6 | Operator watches Sending state during a MANAGED_EMAIL batch | Progress bar advances; recipient table flips rows `queued → sending → sent`/`failed` within ≤2s of each transition; isComplete=true when every row settled | E2E |
| V7 | Operator clicks **Retry Failed** on a Sent state with 2 bounces and 1 transient failure | 3 rows re-enqueued; suppressed-skip rows untouched; survey.sentCount unchanged until each retry succeeds | API + UI |
| V8 | Operator opens Loop Monitor on the survey detail page | Stat-card shows lifetime Survey Sent count + mode breakdown sub-line ("SELF_SERVE × N, MANAGED_EMAIL × M"); filter-agnostic | UI + DB |
| V9 | Operator selects a Wave in the Responses section | Sent and Responses both reflect wave-scoped numbers; date-range / sentiment filters affect Responses only, not Sent | UI + DB |
| V10 | Operator clicks the Unsubscribe link in a received MANAGED_EMAIL email | `GET /u/:token` renders confirmation page; `POST /u/:token/confirm` is idempotent; sets `Member.unsubscribedSurveysAt`; **does NOT touch** `Member.emailOptIn` | API + DB |
| V11 | Operator regenerates tokens on a SELF_SERVE batch + downloads CSV | sentAt updates to now() for every row; `Survey.sentCount += tokenCount`; audit-log records `previousSentAt` + `newSentAt` | API + DB |
| V12 | Brand has `Brand.managedEmailSenderDomain = NULL` (V0 reality) | Sender resolves to `customereq.wellnessatwork.me`; warn log `email.sender_domain.fallback` fires if env unset; no fatal | DB + log inspection |
| V13 | Worker dispatches MANAGED_EMAIL to member with `Member.emailOptIn = false` AND `Member.unsubscribedSurveysAt IS NULL` AND `Member.consentGivenAt IS NOT NULL` | Email SENT (surveys are legitimate-interest, exempt from marketing opt-out per R44) — emailOptIn is NOT checked | worker integration test |
| V14 | Operator's email body validation: body missing `{{survey_link}}` | API returns 400 with field-specific error; UI shows inline error before submit | API + UI |
| V15 | Cross-client rendering of theme palette (see §9.3 spike) | Gmail / Outlook / Apple Mail render theme.primaryColor h1, theme.accentColor link, theme.secondaryColor `<hr>`, theme.backgroundColor body without visible breakage | Spike screenshots in §9.4; per-impl-PR cross-client screenshots in Risk #1 mitigation |

#### 7.1 Unit tests (Test Matrix — `pnpm test:smoke`)

- `packages/shared/src/zod/distributionBatches.ts` — body validation per mode (composer required when MANAGED_EMAIL; format required when SELF_SERVE; senderAlias regex; body contains `{{survey_link}}`; etc.).
- `packages/shared/src/distributionGlob.ts` — glob → SQL LIKE translation with operator-literal escaping (test cases: `*@artistos.com`, `q2-*`, `100%off` literal, `\\foo`, `?bar`, edge cases).
- `apps/web/.../AudienceBuilder.test.tsx` — suppressed-row rendering (disabled checkbox + status chip + tooltip), dedup, pagination, deselect.
- `apps/web/.../ManagedEmailComposer.test.tsx` — sender-alias regex + body-requires-{{survey_link}} validation, default-body template, theme-color preview rendering.
- `apps/worker/src/processors/surveyDistributionSend.test.ts` — two-gate suppression checks (one test per skip reason); on-success sentAt + sentCount increment; on-bounce no-retry; on-transient retry.

#### 7.2 Integration tests (Test Matrix — `pnpm test:integration`)

- `POST /v1/surveys/:id/distribution-batches` with `sendMode = MANAGED_EMAIL`, suppressed members in audience → 201; verify suppressed rows in SurveyDistribution land with `failureReason = 'skipped_*'` and `failedAt` set, no email enqueued.
- `POST /.../mark-csv-downloaded` × 2 → second call is no-op (idempotent), sentCount stays consistent.
- `GET /v1/members?q=*@artistos.com` → returns members with email ending in @artistos.com plus members whose firstName/lastName match wildcard.
- `POST /u/:token/confirm` × 2 → second call is no-op; both audit-log.
- `GET /.../send-progress` → returns isComplete=false during dispatch; isComplete=true once every row in the batch has `deliveredAt IS NOT NULL OR failedAt IS NOT NULL`.

#### 7.3 E2E tests (Test Matrix — Playwright; `pnpm test:e2e`)

- Full Managed-Email path: configure audience (3 existing + 2 custom auto-enroll + 1 unsubscribed-existing); compose; confirm; progress; sent state. Stub `EMAIL_PROVIDER=stub` so no real send.
- Full Self-serve path: same audience; configure; generate; download CSV; verify Survey.sentCount incremented.
- Mode switching: configure audience in self-serve, click Switch to CustomerEQ, verify audience + Survey-Batch-details preserved.
- Suppressed-row visibility: navigate to audience builder, search returns 11 members including 2 unsubscribed; verify 2 show disabled with Status chip.
- Wave Detail page: open self-serve batch, verify Regenerate Links + Download CSV affordance preserved; open managed-email batch, verify Composer snapshot block visible + Regenerate hidden.
- Unsubscribe flow: send to member; click unsubscribe link in captured stub-payload; POST `/u/:token/confirm`; send another batch including same member; verify failureReason = 'skipped_unsubscribed'.

#### 7.4 BAML evals

None — no AI in this path.

### 8. Risks

1. **Theme inlining for email rendering** — email-client CSS support is famously inconsistent. Mitigation: stick to widely-supported properties (no Flexbox, no CSS variables, no media queries beyond mobile-width). E2E tests cover the rendering shape; **cross-client rendering validation** (Gmail / Outlook / Apple Mail) runs in the developer's local environment using `EMAIL_PROVIDER=azure-communication-services` pointed at a sandbox sender + sending to a personal test inbox per major client — there is no staging environment in this repo (verified — `docs/architecture/architecture.md` references local dev + production only; reviewer r3291995380 confirmed). Each implementer documents test-inbox screenshots in the impl PR's evidence document before merge.
2. **ACS throughput limits** — Azure Communication Services has rate limits per sender domain (currently unknown; will validate in staging). Mitigation: BullMQ concurrency = 5 initially; exponential backoff already covers 429s; monitor `email.sender_domain.fallback` warn events + ACS poll-status responses; if hitting limits in staging, increase exponential backoff base or drop concurrency.
3. **Plaintext URL leak via `composerSnapshot`** — the body field contains the rendered mustache template (with `{{survey_link}}` literal), NOT per-recipient URLs. Per-recipient URLs are minted in the token table; the snapshot is safe to retain.
4. **`Member.unsubscribedSurveysAt` vs `emailOptIn` confusion** — operators may not understand that opting-out-of-marketing doesn't opt-out-of-surveys. Mitigation: the audience-builder Status chip is the surfacing; tooltip explains the distinction. Documentation in Settings will explain the two-column model.
5. **Sending state UI feedback latency from polling** — 2-second polling means up to 2-second visual lag on the recipient-table updating. Acceptable for V0 (batches typically <500 recipients, full dispatch in 1-3 minutes). If reviewer prefers SSE, D3 is open.

### 9. Confidence Level + Spike Decision

#### 9.1 Confidence: **78 / 100**

Per-axis breakdown (why 78, not 90+):

| Axis | Score | Rationale |
|---|---|---|
| Patterns / framework integration | 90 | Every layer has 3+ in-repo precedents — 30+ Prisma migrations, 11 BullMQ queues, ~40 `/v1/` routes; copying the shape is mechanical |
| ACS sender-address override | 75 | Existing `sendEmailMessage()` resolves `senderAddress` from env only (verified at `packages/connectors/src/email.ts:141-144`); adding an `opts.senderAddress` override is a small backward-compatible refactor — but the V0-domain-pinned → V1-`Brand.managedEmailSenderDomain` → env-parsed → hard-coded fallback chain warrants early-impl validation |
| MemberUnsubscribeToken flow | 85 | Mirrors verified #378 `SurveyDistributionToken` pattern (SHA-256 of plaintext, plaintext returned once, never stored); audit + verification endpoint shape are direct copies |
| Two-gate suppression in a single DB transaction | 85 | Pure Prisma; checks are simple WHERE clauses; one new index covers the worker pre-dispatch re-check |
| **Theme-color inline-style rendering across Gmail / Outlook / Apple Mail** | **60** | The single highest-variance surface. Industry-wide CSS constraints are documented (no flexbox, table-based layouts, inline-only), but the operator-configured palette is the rendered email's primary trust signal — *"on-brand-looking inbox"* is the V0 customer outcome, and Outlook desktop in particular has historically broken assumptions about `<hr>` color, link `text-decoration`, and CSS-variable fallbacks |
| Polling + `send-progress` query cost at concurrency=5 | 80 | Compound index covers the hot path; integration tests will catch regressions; light load expected V0 (50–500 recipients/batch) |

The 60 for theme rendering pulls the average to 78. Tightening that one axis by 15 points (via the spike below) would land overall at ~85.

#### 9.2 Technical Ambiguities

| # | Area | Uncertainty | Spike candidate? |
|---|---|---|---|
| A1 | Cross-client theme-color rendering (Gmail web + iOS; Outlook web + desktop; Apple Mail macOS + iOS) | **Medium** | **Yes** — see §9.3 |
| A2 | ACS `senderAddress` override response on invalid-alias 4xx | Low | No — ACS docs are explicit; impl-time integration test sufficient |
| A3 | BullMQ "throw + no-retry" semantics for bounce / invalid-address classification | Low | No — direct precedent at `apps/worker/src/processors/notifications.ts` |
| A4 | Polling query cost at concurrency=5 (Prisma + new compound index) | Low | No — covered by §7.2 integration tests + EXPLAIN ANALYZE during impl |
| A5 | TipTap integration with Next.js App Router (`use client` + SSR hydration) | Low | No — TipTap v2 docs cover App-Router patterns; `dynamic({ ssr: false })` is the documented escape hatch |

#### 9.3 Spike Decision

Per `rules/spike-first-development.md`: spike only on Medium-or-higher uncertainty where the spike outcome would change the design.

**Recommendation**: **One ≤2-hour spike** on A1 (cross-client theme rendering) **before** the worker + composer impl commits land. Rationale: A1 is the single Medium-uncertainty item in the RFC, and it directly determines whether the V0 customer outcome ("emails look on-brand") is met; the spike findings (a checklist of which CSS properties each client honors) can absorb cleanly into §6 without breaking the schema, API, or worker contracts.

**Spike scope**:
1. Build the §6 minimal HTML template (background-color, primaryColor `<h1>`, accentColor link, secondaryColor `<hr>`, theme.textColor body) with one hard-coded BrandTheme palette + mustache-rendered `{{brand_name}}` + `{{survey_link}}` + `[Unsubscribe]` footer.
2. Call existing `sendEmailMessage()` (no schema changes, no worker changes) to one personal inbox per major client: **Gmail** (web + iOS), **Outlook** (web + desktop), **Apple Mail** (macOS + iOS).
3. Capture screenshots of each rendered email.
4. Land findings in §9.4 below: a checklist of CSS properties honored / broken per client, and any §6 template adjustments that result.

**Why not spike A2–A5**: each has direct in-repo precedent or unambiguous external documentation; spiking would be cargo-cult overhead. The rule specifically says spike only when **unfamiliar** — A2–A5 are familiar.

**Reviewer call**: see D6 below — spike now, or defer to per-impl-PR validation (Risk #1's existing mitigation)?

#### 9.4 Spike Findings (to be populated if the spike is run)

*Not yet run. Pending D6.*  When run, this section will record:
- **What was spiked**: scope from §9.3.
- **Findings**: per-client CSS-property checklist (Gmail web/iOS, Outlook web/desktop, Apple Mail macOS/iOS) + screenshots stored in `docs/evidence/420-spike-cross-client-rendering/`.
- **Design impact**: any §6 template adjustments + Risk #1 update.
- **Help needed**: none expected (developer-personal inboxes only; no shared credentials).

---

### 10. Open Decisions for reviewer (Round-2: pros/cons added per reviewer feedback)

- **D1 (sentAt nullability)** — **RESOLVED** (Round-2 per reviewer r3291886241). `sentAt` stays `DateTime @default(now())` NOT NULL. Historical rows keep their original sentAt. New `deliveredAt` column (nullable) carries the MANAGED_EMAIL provider-confirmed semantic. See §1.6 + §2.
- **D2 (DistributionBatch.sendMode default backfill = SELF_SERVE)** — **CONFIRMED** (reviewer r3291886424). Every existing batch was a #378 SELF_SERVE batch; default backfill is correct.
- **D3 (Sending-state progress: polling vs SSE)** — Round-2 pros/cons + long-term framing (per reviewer r3291892250 + r3291903678):

  | Axis | Polling (2-second interval) | SSE (`text/event-stream`) |
  |---|---|---|
  | Operator UX (latency to update) | ≤2 s lag visible on each recipient row transition | <100 ms (server push) |
  | Bandwidth per session | ~12 KB/min per operator (1 small JSON per 2 s) | ~1 KB/min (push-only on change) |
  | Server CPU per operator | ~30 req/min hits Fastify + Prisma; cheap per request but adds up | 1 persistent connection, lower per-update CPU |
  | Connection limits | Standard HTTP; no special config | Long-lived connections — Container Apps default ingress timeout is 240s + need keep-alive heartbeat; nginx ingress also needs `proxy_buffering off` |
  | Mobile / network drops | Resilient — next poll reconciles | Reconnect logic needed (EventSource auto-retries by default but on a fresh ID) |
  | Dev cost (initial) | Low — 1 `useEffect` + `setInterval` in the Sending state component | Medium — new Fastify SSE plugin (`fastify-sse-v2`) + frontend `EventSource` wrapper + reconnect handling + Container Apps timeout tuning |
  | Dev cost (ongoing) | Low | Medium — long-lived connections complicate `pnpm test:integration` (Fastify test client polls vs SSE-needs-stream) |
  | Cost over time | Server-load scales O(N operators × 1/2s); for V0 (~tens of concurrent sends) negligible (~MB/day) | Effectively free at scale; one connection per active sender, idle when no events |
  | Long-term fit | Becomes bottleneck if batches go to 10k+ recipients and dozens of concurrent operators (poll-storm) | Better for the long-term "campaign-wide live dashboards" direction the platform is heading |

  **Round-2 recommendation**: **polling for V0** — operator UX cost (≤2 s) is acceptable for V0 batches <500; dev cost saved (≥1 day) goes into other V0 surfaces. **Long-term cost direction**: when batch sizes cross 5k or concurrent sending operators exceed ~10, the bandwidth + server-CPU curve crosses SSE's fixed cost; at that point migrate the `send-progress` endpoint to SSE (the API contract is forward-compatible — the client polls today, switches to `EventSource` later; no breaking change). Tracked as a V1 candidate in Non-goals (will add).
- **D4 (Rich-text editor library)** — Round-2 pros/cons (per reviewer r3291899137 — *"in this case use TipTap"*; confirming with the analysis):

  | Library | Pros | Cons |
  |---|---|---|
  | **TipTap v2** (chosen) | Headless React, MIT, extension-based (only ship what you use), great a11y baseline, ProseMirror under the hood, ~150 KB minified gzipped for the minimal set (bold/italic/link/list); active maintenance, 25k+ GitHub stars; the `Mention` extension makes the `{{mustache}}` palette implementation simple | Adds a new dependency family (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`); some learning curve for extension API |
  | Lexical | Meta's editor; smaller bundle (~80 KB), better OT/CRDT path for real-time multi-cursor (irrelevant for our single-author use) | Less mature React story (still pre-1.0 for some plugins); ecosystem smaller than TipTap; extension API different from ProseMirror, no transferable expertise |
  | ProseMirror direct | Maximum control; smallest possible bundle; the substrate underneath TipTap | Substantially more dev cost — building the toolbar, link UI, mustache-mention plugin from scratch; not worth it for V0 |
  | Plain `contenteditable` | Zero dep | Caret handling + paste sanitization + a11y are infamously hard; reinventing all of TipTap's wheel |

  **Round-2 recommendation**: **TipTap v2** — confirmed both by analysis (best maintenance/dev-cost balance for V0) and by the reviewer. Locked.
- **D5 (Worker concurrency for `managed-email-send`)** — Round-2 analysis (per reviewer r3291901014 — *"5 is fine. But do give more justification than precedence"*):

  - **Expected V0 send volume**: 50–500 recipients per batch (per spec, Round-1 typical operator pulse). A 500-recipient batch at 200ms per send (ACS typical latency for transactional email) × 5 concurrent = ~20 seconds total wall-clock. Per-operator UX expectation: complete in <2 minutes for batches up to 500 (operator likely watches the progress bar). Concurrency=5 hits ~20s for 500; concurrency=1 hits ~100s (still <2 min but no margin); concurrency=10 hits ~10s.
  - **ACS rate limits**: Azure Communication Services for transactional email has a documented limit of **300 requests/minute** per resource (sender-domain-scoped) at the Free/Standard tier and higher at Premium. At concurrency=5, peak requests/minute = 5 × 60s ÷ 200ms = 1500 r/m — well above 300. At concurrency=2, peak = 600 r/m — still above. So either way we need exponential-backoff on 429s. Concurrency=5 makes the queue drain faster but causes more 429s; concurrency=2 is slower but kinder to the rate limit.
  - **Risk of pile-up across concurrent batches**: if two operators each send 500-recipient batches simultaneously, the global queue depth is 1000. At concurrency=5 they drain in ~40s; at concurrency=2 in ~100s. Either is acceptable.
  - **Round-2 recommendation**: **5** — the right balance for V0 expected volumes. Worth re-tuning post-launch if 429-rate observability shows we're getting throttled (BullMQ exposes retry counters; we'll log them).
  - **Future tuning lever**: per-sender-domain rate-limiter in the worker (token bucket against ACS's 300 r/m), independent of BullMQ concurrency. Out of V0 scope; flag as V1 if 429s become operator-visible.
- **D6 (NEW: Cross-client theme-rendering spike — run now or defer to impl?)** — per §9.3. **Recommended**: run a ≤2-hour spike now (one inbox per major client, screenshots, §9.4 populated) so findings land *before* the worker is written — any §6 template adjustments are then cheap. **Alternate**: defer to per-impl-PR cross-client screenshots per Risk #1 — saves the upfront 2 hours, but if a client (Outlook desktop is the usual offender) rejects an assumed CSS property, the worker may need rework after it's already written + tested.

### 11. Implementation order (suggested for impl phase)

1. Migration (single hand-edited file).
2. Prisma client regen + shared Zod schemas + queue-name constant.
3. Email connector `senderAddress` parameter addition.
4. Worker `survey-distribution-send` processor.
5. API endpoints (`POST /distribution-batches` extension, `mark-csv-downloaded`, `retry-failed`, `send-progress`, `/u/:token` + confirm, `GET /v1/members` glob extension).
6. Frontend `AudienceBuilder` + `SurveyBatchDetailsCard` shared.
7. Frontend `ManagedEmailComposer` + theme-color-resolved live preview + TipTap.
8. Frontend `ManagedEmailProgress` with polling + Retry-Failed.
9. Frontend Distribution-tile reshape + survey-detail Loop Monitor / Responses-header surfacing.
10. Wave Detail page extensions (sendMode pill, Composer snapshot block for managed-email batches, per-recipient send log).
11. Audit allowlists.
12. Compliance §13.7 worker re-check coverage tests.
13. Cross-client email rendering manual validation (developer-local; no staging env).

### 12. Architecture Analysis

Compared this RFC against `docs/architecture/architecture.md`. Three buckets:

#### 12.1 Patterns correctly followed

- **§3.2 API Layer** — new endpoints follow `/v1/` versioned route convention with Zod request validation, Clerk JWT auth, MultiTenant scoping, and audit-allowlist plugin. Sender-address resolution falls back to env, matching the "config-via-env" precedent.
- **§3.3 Event Processing Layer** — new BullMQ queue `survey-distribution-send` with concurrency 5 (matches `notifications` queue convention). Worker structure mirrors `apps/worker/src/processors/notifications.ts`. Both `QUEUE_MODE=redis` and `QUEUE_MODE=inline` execute the same processor function per architecture §3.3.
- **§3.4 Data Layer** — hand-edited Prisma migration with `ADD COLUMN → BACKFILL UPDATE` ordering; forward-only; no `down` script. Matches the `<timestamp>_brandtheme_surveytheme_split` precedent cited in architecture §3.4.
- **§4.4 Database Models** — all new tenant-scoped models carry `brandId` per Rule 6. Token-hash pattern (SHA-256 of plaintext, plaintext shown once) mirrors `SurveyDistributionToken` (#378) and `ApiKey.keyHash` (#170).
- **#378 §3.1 batch-detail page** — Wave Detail page mode-conditional rendering preserves the existing Tokens table + Edit Expiry + Regenerate Links affordances for self-serve, per the spec's preservation contract.

#### 12.2 Patterns missing from architecture

- **Server-Sent Events (SSE) for streaming progress** — not used by this RFC for V0 per D3 analysis (operator UX cost ≤2s tolerable for V0 batch sizes; dev cost ≥1 day saved). The recommendation is grounded in the pros/cons in D3, not in "no precedent." If the reviewer wants SSE for V0 (long-term UX value), it becomes a new infrastructure pattern that should land in architecture §3.2 alongside the impl: Fastify SSE plugin + Container Apps long-connection-timeout config + frontend `EventSource` wrapper.
- **Mode-parameterized React page component** (`<DistributePage mode={...}/>`) — new pattern. **Other features in this codebase that could benefit from the same pattern** (per reviewer r3291904492):
  - `/admin/surveys/[id]/edit` vs `/admin/surveys/new` — today these are two separate routes/components; could collapse into a single mode-parameterized component (`mode=edit` vs `mode=new`), avoiding the form-state-duplication that today gets copied between them.
  - `/admin/programs/[id]` vs `/admin/programs/new` — same shape.
  - `/admin/campaigns/[id]/preview` vs the live campaign page — preview vs live could be a `mode=` discriminator instead of separate routes, sharing the audience preview + campaign-action subcomponents.
  - Any future "draft + publish" workflow on tenant resources (themes, programs, surveys) — the same `mode=` shape applies cleanly.
  - Worth a small entry in architecture §3.1 once the pattern is in-tree and validated; not blocking.
- **Polling-based progress UI** — frontend `useEffect` polling pattern is implicit in `LoopMonitor.tsx` (60s interval per verified read at `apps/web/src/components/surveys/LoopMonitor.tsx:92`). #420's 2s-interval polling for the Sending state is the same primitive at a faster cadence. Could be lifted into a `usePollingQuery` hook in `packages/ui` if a second consumer surfaces; for now keep inline.
- **Two-gate compliance suppression model** — audience-builder gate (UI) + worker pre-dispatch re-check. New pattern with clear V1 utility: any future workflow that selects then dispatches across a time-gap (e.g., scheduled-send if D-Non-goal "scheduled send" is reconsidered; campaign event triggers) will need the same two-gate shape. Architecture §6 (Compliance) should gain a short subsection naming this once #420 ships; track as a follow-up issue.

#### 12.3 Patterns incorrectly followed

None identified. The RFC follows architecture-documented patterns where they exist, and the gaps above are *additions* (new patterns) rather than misuses.

### 13. Observability (logs, metrics, alerts)

Per TECHSPEC template. All emissions follow the existing repo conventions (`fastify.log` for API, BullMQ worker logger for worker, AuditLog table for compliance trail).

#### 13.1 Structured logs (Fastify + worker)

| Event key | Level | Where emitted | Allowlist fields | Why we care |
|---|---|---|---|---|
| `email.sender_domain.fallback` | `warn` | `POST /v1/surveys/:id/distribution-batches` handler when sender-domain resolution falls through to the hard-coded fallback | `brandId, reason: 'acs_env_unset' \| 'brand_domain_null'` | Ops signal that the env or brand-domain config has drifted; otherwise silent |
| `email.send_attempt` | `info` | `managed-email-send` worker after each provider call | `batchId, memberId, status: 'success' \| 'failure', durationMs, operationId` (ACS) | Per-recipient send latency + provider-success rate |
| `email.send_skip` | `info` | `managed-email-send` worker on suppression gate hit | `batchId, memberId, reason: 'unsubscribed' \| 'no_consent' \| 'erased' \| 'no_email'` | Compliance trail; volume of suppressed-at-dispatch (vs suppressed-at-builder) — high counts here = audience-builder gate is leaking |
| `email.send_retry` | `info` | BullMQ retry hook on transient errors | `batchId, memberId, attempt: 1-3, errorClass` | Provider-instability signal |
| `unsubscribe.confirmed` | `info` | `POST /u/:token/confirm` | `memberId, brandId, batchId, tokenPrefix` (first 8 chars only) | Volume + per-batch unsubscribe attribution |

#### 13.2 AuditLog rows (compliance trail — `audit_logs` table, allowlist-enforced)

| Event | Triggered by | Allowlist fields |
|---|---|---|
| `distribution_batch.create` | `POST /v1/surveys/:id/distribution-batches` | `surveyId, batchId, sendMode, recipientCount, autoEnrolledCount, requestIp` |
| `distribution_batch.csv_downloaded` | `POST /.../mark-csv-downloaded` | `batchId, delta, surveySentCount` |
| `distribution_batch.tokens_regenerated` | `POST /.../regenerate-tokens` | `batchId, regeneratedCount, previousSentAt, newSentAt` |
| `distribution_batch.retry_failed` | `POST /.../retry-failed` | `batchId, retriedCount` |
| `managed_email.send_attempt` | worker per-recipient | `batchId, memberId, status, failureReason?` |
| `member.unsubscribed_surveys` | `POST /u/:token/confirm` | `memberId, brandId, batchId, tokenPrefix` |

Audit allowlist plugin is the existing one (per architecture §3.2). No new audit infrastructure.

#### 13.3 Metrics (BullMQ + Prisma)

| Metric | Source | Use |
|---|---|---|
| `managed_email_send.queue_depth` | BullMQ queue inspect (existing dashboard pattern from `notifications`) | Saturation signal for the V0 concurrency=5 setting (per D5) |
| `managed_email_send.success_rate` (derived) | `email.send_attempt` count by status / total | Drives the V1 *"increase concurrency"* decision if rate is steady ≥99% |
| `managed_email_send.suppression_rate` (derived) | `email.send_skip` count / `email.send_attempt + skip` count | Audience-builder-gate health; >1% = builder gate is leaking |
| `acs.429_rate` (derived) | `email.send_retry` count where `errorClass='rate_limit'` | Signal for per-sender-domain rate-limiter (V1 future lever per D5) |

#### 13.4 Alerts (V0 minimum)

| Alert | Threshold | Action |
|---|---|---|
| ACS provider error spike | `email.send_attempt` failure-status rate >5% over 5 min | Page ops |
| Queue saturation | `managed_email_send.queue_depth` >100 sustained 10 min | Page ops; investigate worker capacity |
| Sender-domain fallback firing | `email.sender_domain.fallback` warn count >0 in any 1-hr window | Slack notification; ACS env config drift |
| Unsubscribe spike | `unsubscribe.confirmed` rate >5x trailing-7d-baseline in 1hr | Slack notification — possible deliverability or content issue |

Alert wiring follows the existing pattern (Container Apps log alerts → Slack via webhook); no new alert infrastructure. Alert thresholds reviewable after V0 ships and we have a week of baseline data.

#### 13.5 What we explicitly do NOT instrument in V0

- Per-recipient open / click / bounce webhooks from ACS (ACS Email supports these via Event Grid — adding the subscription is V1 work; tracked as non-goal).
- Cross-batch latency percentiles per-brand (until we have enough batch volume to make percentiles meaningful — V1).

---

### 14. Requirements Traceability

R1..R45 (spec §Requirements) map to RFC sections as follows:
- R1–R5 (entry point) → §5 Frontend hierarchy (`DistributionSection.tsx` reshape)
- R6–R10 (configure surface) → §5 Frontend hierarchy (`DistributePage.tsx` mode-param + section ordering)
- R11–R15 (Survey Batch details) → §5 (`SurveyBatchDetailsCard.tsx`)
- R16–R23 (audience builder) → §5 (`AudienceBuilder/*`) + §3.7 (member glob endpoint)
- R24–R30 (composer) → §5 (`ManagedEmailComposer.tsx`) + §6 (theme rendering)
- R31–R35 (send + terminal) → §3.1, §3.2 (endpoints) + §4 (worker) + §5 (`ManagedEmailProgress.tsx`)
- R36–R40 (sent-count surfacing) → §3.1 (sentCount writes) + §5 (Loop Monitor + Responses-header surface)
- R41–R45 (compliance + suppression) → §4 (worker two-gate check) + §3.6 (unsubscribe endpoints) + audit allowlists

Each requirement-→-implementation mapping will be verified at the `implement-completeness-review` phase before the impl PR merges.
