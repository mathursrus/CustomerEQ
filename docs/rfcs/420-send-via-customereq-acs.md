# Feature: Send Survey Emails via CustomerEQ (ACS) — RFC

Issue: [#420](https://github.com/mathursrus/CustomerEQ/issues/420)
Owner: Claude (claude-opus-4-7) / manohar.madhira@outlook.com
Status: Round 1 — first draft for reviewer signoff
Spec: [`docs/feature-specs/420-send-via-customereq-acs.md`](../feature-specs/420-send-via-customereq-acs.md) (R7)
Evidence: [`docs/evidence/420-technical-design-evidence.md`](../evidence/420-technical-design-evidence.md) (to be created at submission)

> **Closes:** #420.
> **Builds on:** [#378](https://github.com/mathursrus/CustomerEQ/issues/378) (`DistributionBatch` / `SurveyDistributionToken` / `SurveyDistribution` data model; tokenized survey URLs; audience-builder primitives), [#231](https://github.com/mathursrus/CustomerEQ/issues/231) (`Member.email` nullable, `Brand.memberIdentifierKind`, `Member.consentGivenAt`), [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (`Brand.timezone`), [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (survey detail page, Loop Monitor surface), [#291](https://github.com/mathursrus/CustomerEQ/issues/291) (`BrandTheme` model post-rename).
> **Resolved decisions** (from spec R6–R7): OQ-1 sender-domain fallback order, OQ-2 glob syntax, OQ-3 brand-wide opt-out, OQ-4 Loop Monitor + Response-header surfacing, OQ-5 rich-text editor deferred to this RFC, OQ-6 #378 drop-in reshape, OQ-7 `Brand.logoUrl` verified existing, OQ-NEW-1 separate `unsubscribedSurveysAt` (distinct from `emailOptIn`).
> **Open RFC decisions** (D1–D5): see *Open Decisions for Reviewer* at bottom.

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

#### 1.1 New enum: `SendMode`

```prisma
enum SendMode {
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
  sendMode         SendMode  @default(SELF_SERVE)  // backfill existing rows to SELF_SERVE in the migration
  composerSnapshot Json?                            // MANAGED_EMAIL only: {senderName, senderAlias, senderDomain, subject, body, footerTemplate, brandLogoUrl, themeSnapshot}. Null for SELF_SERVE.
}
```

#### 1.6 Modified columns: `SurveyDistribution`

```prisma
model SurveyDistribution {
  // ... existing #378 fields ...
  enqueuedAt    DateTime?    // MANAGED_EMAIL: set when worker job enqueued. SELF_SERVE: null (no enqueue).
  sentAt        DateTime?    // SEMANTIC CHANGE: was @default(now()) at row creation (#378 mint-time). Now: SELF_SERVE = CSV-download time (set + overwritable on regenerate); MANAGED_EMAIL = provider-confirmed delivery time (set once, immutable).
  failedAt      DateTime?    // MANAGED_EMAIL only: set when worker confirmed dispatch failure. Mutually exclusive with sentAt on the same row.
  failureReason String?      // MANAGED_EMAIL only: bounded reason ("bounce" | "invalid_address" | "skipped_unsubscribed" | "skipped_no_consent" | "skipped_erased" | "skipped_no_email" | "transient_error_after_retries").
  sendMode      SendMode     // denormalized mirror of parent batch.sendMode for fast aggregation without a join.

  @@index([surveyId, sendMode, sentAt])  // Survey.sentCount aggregation by mode
}
```

> **D1 (migration ordering)** — see Open Decisions. Existing `SurveyDistribution.sentAt` is `@default(now())` and NOT nullable today. Migrating to nullable + per-mode semantic requires a hand-edit (per architecture §3.4): `ALTER COLUMN sentAt DROP NOT NULL`, then backfill existing rows are left as-is (they have a sentAt value from old #117 / #378 semantics — preserved as historical truth).

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

Single hand-edited migration `<timestamp>_add_managed_email_send_via_acs/migration.sql`. Forward-only (per architecture §3.4 default). Steps:

1. `CREATE TYPE "SendMode" AS ENUM ('SELF_SERVE', 'MANAGED_EMAIL');`
2. `ALTER TABLE "brands" ADD COLUMN "managedEmailSenderDomain" TEXT;`
3. `ALTER TABLE "members" ADD COLUMN "unsubscribedSurveysAt" TIMESTAMP(3);`
4. `ALTER TABLE "surveys" ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0;`
5. `ALTER TABLE "distribution_batches" ADD COLUMN "sendMode" "SendMode" NOT NULL DEFAULT 'SELF_SERVE';` (existing rows backfill to SELF_SERVE — see D2 for rationale)
6. `ALTER TABLE "distribution_batches" ADD COLUMN "composerSnapshot" JSONB;`
7. `ALTER TABLE "survey_distributions" ADD COLUMN "enqueuedAt" TIMESTAMP(3);`
8. `ALTER TABLE "survey_distributions" ADD COLUMN "failedAt" TIMESTAMP(3);`
9. `ALTER TABLE "survey_distributions" ADD COLUMN "failureReason" TEXT;`
10. `ALTER TABLE "survey_distributions" ADD COLUMN "sendMode" "SendMode" NOT NULL DEFAULT 'SELF_SERVE';` (backfill mirror from parent batch)
11. `ALTER TABLE "survey_distributions" ALTER COLUMN "sentAt" DROP NOT NULL;` — required for MANAGED_EMAIL rows that exist briefly between enqueue and dispatch
12. `CREATE TABLE "member_unsubscribe_tokens" ( ... );` + indexes
13. `Survey.sentCount` backfill: `UPDATE "surveys" SET "sentCount" = (SELECT COUNT(*) FROM "survey_distributions" WHERE "surveyDistributions"."surveyId" = "surveys"."id");` — backfills the existing distribution count for pre-existing surveys so the new counter starts from a true historical baseline rather than zero.
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

#378 endpoint preserved. Extended to ALSO null-out `SurveyDistribution.sentAt` for every row in the batch (so the next `mark-csv-downloaded` call sees them as "new dispatch"). Behavior: regenerates all tokenHashes, returns new plaintext URLs once, sets sentAt = null + failedAt/failureReason = null. Audit-log: `distribution_batch.tokens_regenerated`.

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
    sentAt: string | null
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

### 4. Worker: `survey-distribution-send` queue

New BullMQ queue. Convention follows §3.3 / §4.3 of architecture.

```ts
// packages/shared/src/queues.ts
export const SURVEY_DISTRIBUTION_SEND_QUEUE = 'survey-distribution-send'

// apps/worker/src/processors/surveyDistributionSend.ts
export async function processSurveyDistributionSend(job: Job<SurveyDistributionSendPayload>) {
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
  // 5. On success: UPDATE survey_distributions SET sentAt = now() WHERE id = ?; UPDATE surveys SET sentCount = sentCount + 1
  // 6. On failure (provider non-success or thrown):
  //    - Classify reason (bounce / invalid_address / transient_error_after_retries — last retry exhausted)
  //    - UPDATE survey_distributions SET failedAt = now(), failureReason = ? WHERE id = ?
  //    - BullMQ retries the job up to 3x with exponential backoff for transient_error; bounce / invalid_address skip retry (throw immediately + return false from retry-policy check)
  // 7. Audit: write event = 'managed_email.send_attempt' with allowlist {batchId, memberId, status, failureReason?}
}
```

**Concurrency**: 5 per worker (matches `notifications` queue per architecture §3.3). Reviewable based on observed ACS throughput limits.

**`packages/connectors/src/email.ts` change**: add optional `senderAddress` parameter to `sendEmailMessage()` so the per-batch composer's sender alias + domain overrides the env default. Backward-compatible — existing `notifications` callers don't pass it and continue to use the env default.

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

#### 7.1 Unit tests (`pnpm test:smoke`)

- `packages/shared/src/zod/distributionBatches.ts` — body validation per mode (composer required when MANAGED_EMAIL; format required when SELF_SERVE; senderAlias regex; body contains `{{survey_link}}`; etc.).
- `packages/shared/src/distributionGlob.ts` — glob → SQL LIKE translation with operator-literal escaping (test cases: `*@artistos.com`, `q2-*`, `100%off` literal, `\\foo`, `?bar`, edge cases).
- `apps/web/.../AudienceBuilder.test.tsx` — suppressed-row rendering (disabled checkbox + status chip + tooltip), dedup, pagination, deselect.
- `apps/web/.../ManagedEmailComposer.test.tsx` — sender-alias regex + body-requires-{{survey_link}} validation, default-body template, theme-color preview rendering.
- `apps/worker/src/processors/surveyDistributionSend.test.ts` — two-gate suppression checks (one test per skip reason); on-success sentAt + sentCount increment; on-bounce no-retry; on-transient retry.

#### 7.2 Integration tests (`pnpm test:integration`)

- `POST /v1/surveys/:id/distribution-batches` with `sendMode = MANAGED_EMAIL`, suppressed members in audience → 201; verify suppressed rows in SurveyDistribution land with `failureReason = 'skipped_*'` and `failedAt` set, no email enqueued.
- `POST /.../mark-csv-downloaded` × 2 → second call is no-op (idempotent), sentCount stays consistent.
- `GET /v1/members?q=*@artistos.com` → returns members with email ending in @artistos.com plus members whose firstName/lastName match wildcard.
- `POST /u/:token/confirm` × 2 → second call is no-op; both audit-log.
- `GET /.../send-progress` → returns isComplete=false during dispatch, isComplete=true after worker finishes.

#### 7.3 E2E tests (Playwright; `pnpm test:e2e`)

- Full Managed-Email path: configure audience (3 existing + 2 custom auto-enroll + 1 unsubscribed-existing); compose; confirm; progress; sent state. Stub `EMAIL_PROVIDER=stub` so no real send.
- Full Self-serve path: same audience; configure; generate; download CSV; verify Survey.sentCount incremented.
- Mode switching: configure audience in self-serve, click Switch to CustomerEQ, verify audience + Survey-Batch-details preserved.
- Suppressed-row visibility: navigate to audience builder, search returns 11 members including 2 unsubscribed; verify 2 show disabled with Status chip.
- Wave Detail page: open self-serve batch, verify Regenerate Links + Download CSV affordance preserved; open managed-email batch, verify Composer snapshot block visible + Regenerate hidden.
- Unsubscribe flow: send to member; click unsubscribe link in captured stub-payload; POST `/u/:token/confirm`; send another batch including same member; verify failureReason = 'skipped_unsubscribed'.

#### 7.4 BAML evals

None — no AI in this path.

### 8. Risks

1. **Theme inlining for email rendering** — email-client CSS support is famously inconsistent. Mitigation: stick to widely-supported properties (no Flexbox, no CSS variables, no media queries beyond mobile-width). E2E tests + a manual cross-client check (Gmail / Outlook / Apple Mail) in pre-deploy validation.
2. **ACS throughput limits** — Azure Communication Services has rate limits per sender domain (currently unknown; will validate in staging). Mitigation: BullMQ concurrency = 5 initially; exponential backoff already covers 429s; monitor `email.sender_domain.fallback` warn events + ACS poll-status responses; if hitting limits in staging, increase exponential backoff base or drop concurrency.
3. **Plaintext URL leak via `composerSnapshot`** — the body field contains the rendered mustache template (with `{{survey_link}}` literal), NOT per-recipient URLs. Per-recipient URLs are minted in the token table; the snapshot is safe to retain.
4. **`Member.unsubscribedSurveysAt` vs `emailOptIn` confusion** — operators may not understand that opting-out-of-marketing doesn't opt-out-of-surveys. Mitigation: the audience-builder Status chip is the surfacing; tooltip explains the distinction. Documentation in Settings will explain the two-column model.
5. **Sending state UI feedback latency from polling** — 2-second polling means up to 2-second visual lag on the recipient-table updating. Acceptable for V0 (batches typically <500 recipients, full dispatch in 1-3 minutes). If reviewer prefers SSE, D3 is open.

### 9. Open Decisions for reviewer

- **D1 (Migration safety on `SurveyDistribution.sentAt` nullable transition)** — Round-1 recommended: hand-edit the migration with `ALTER COLUMN sentAt DROP NOT NULL` as a discrete step. Existing rows keep their current `sentAt` (which is row-creation time per #117 / #378 — preserved as historical truth, not retroactively re-interpreted). New rows from #420 follow the new per-mode semantics. **Reviewer call**: OK to leave existing rows as-is, or do we need a backfill that sets `sentAt = NULL` for any rows where the historical "sent" event is unverifiable?
- **D2 (Backfill of `DistributionBatch.sendMode` for existing rows)** — Round-1 recommended: backfill all existing `DistributionBatch` rows to `SELF_SERVE` (every batch created pre-#420 was a #378 BYO batch by definition). **Reviewer call**: confirm.
- **D3 (Sending-state progress: polling vs SSE)** — Round-1 recommended: **polling** at 2-second intervals. No SSE precedent in this codebase (`apps/api/src/routes/` has zero SSE endpoints today; verified). SSE would be a new infrastructure pattern (cookie + nginx config + Fastify SSE plugin); polling is well-trodden and adequate for V0 batches <500. **Reviewer call**: accept polling, or invest in SSE for the smoother UX?
- **D4 (Rich-text editor library)** — Round-1 recommended: **TipTap v2**. Battle-tested, MIT-licensed, no existing rich-text editor in the codebase to fight against (verified via `grep -r tiptap apps/web/` → no matches; the codebase uses only `<textarea>` today). **Reviewer call**: TipTap or alternative (Lexical, ProseMirror direct, etc.)?
- **D5 (Worker concurrency for `survey-distribution-send`)** — Round-1 recommended: **5** (matches `notifications` queue convention). **Reviewer call**: confirm or adjust based on expected V0 send volume.

### 10. Implementation order (suggested for impl phase)

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
13. Cross-client email rendering manual validation in staging.

### 11. Architecture Analysis

Compared this RFC against `docs/architecture/architecture.md`. Three buckets:

#### 11.1 Patterns correctly followed

- **§3.2 API Layer** — new endpoints follow `/v1/` versioned route convention with Zod request validation, Clerk JWT auth, MultiTenant scoping, and audit-allowlist plugin. Sender-address resolution falls back to env, matching the "config-via-env" precedent.
- **§3.3 Event Processing Layer** — new BullMQ queue `survey-distribution-send` with concurrency 5 (matches `notifications` queue convention). Worker structure mirrors `apps/worker/src/processors/notifications.ts`. Both `QUEUE_MODE=redis` and `QUEUE_MODE=inline` execute the same processor function per architecture §3.3.
- **§3.4 Data Layer** — hand-edited Prisma migration with `ADD COLUMN → BACKFILL UPDATE` ordering; forward-only; no `down` script. Matches the `<timestamp>_brandtheme_surveytheme_split` precedent cited in architecture §3.4.
- **§4.4 Database Models** — all new tenant-scoped models carry `brandId` per Rule 6. Token-hash pattern (SHA-256 of plaintext, plaintext shown once) mirrors `SurveyDistributionToken` (#378) and `ApiKey.keyHash` (#170).
- **#378 §3.1 batch-detail page** — Wave Detail page mode-conditional rendering preserves the existing Tokens table + Edit Expiry + Regenerate Links affordances for self-serve, per the spec's preservation contract.

#### 11.2 Patterns missing from architecture

- **Server-Sent Events (SSE) for streaming progress** — *not used* by this RFC; we picked polling (D3) precisely because SSE has no precedent in `apps/api/src/routes/` today. **If the reviewer chooses SSE on D3**, then SSE becomes a new infrastructure pattern that should be documented in architecture §3.2 (or §6) before/concurrent with impl.
- **Mode-parameterized React page component** — `<DistributePage mode={...}/>` rendering different composers based on a URL query param is a new component-design pattern; existing admin pages don't use this discriminator pattern. Worth adding a one-liner to architecture §3.1 / §3.6 if the reviewer wants the pattern formalized; otherwise the RFC documents the convention adequately.
- **Polling-based progress UI** — frontend `useEffect` polling at 2-second intervals during a transient state is implicit elsewhere (e.g., Loop Monitor refreshes every 60s) but not formalized as a pattern. Borderline; doesn't need an architecture-doc entry.
- **Two-gate compliance suppression model** — audience-builder gate (UI) + worker-time re-check is a new pattern. Architecture §6 (Compliance) could gain a short subsection naming this two-gate model; not urgent for impl but useful for future features.

#### 11.3 Patterns incorrectly followed

None identified. The RFC follows architecture-documented patterns where they exist, and the gaps above are *additions* (new patterns) rather than misuses.

### 12. Requirements Traceability

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
