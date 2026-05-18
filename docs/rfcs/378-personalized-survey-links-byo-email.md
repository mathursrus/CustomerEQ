# Feature: Personalized Survey Links for BYO-Email Distribution — RFC

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Owner: Claude (claude-opus-4-7) / manohar.madhira@outlook.com
Status: Iterating (Round 1 addressed — 15 inline RFC review comments + Phase 3 spike executed; awaiting reviewer signoff)
Spec: [`docs/feature-specs/378-personalized-survey-links-byo-email.md`](../feature-specs/378-personalized-survey-links-byo-email.md) (R3.1)
Evidence: [`docs/evidence/378-technical-design-evidence.md`](../evidence/378-technical-design-evidence.md)

> **Closes:** #378.
> **Coordinates with:** [#264](https://github.com/mathursrus/CustomerEQ/issues/264) (worker erasure job — required for GDPR Art. 17 / CCPA §1798.105 cascade on the new models; out of scope here), [#403](https://github.com/mathursrus/CustomerEQ/issues/403) (`Brand.supportEmail` for respondent-side error copy).
> **Builds on:** [#117](https://github.com/mathursrus/CustomerEQ/issues/117) (existing `SurveyDistribution` model), [#231](https://github.com/mathursrus/CustomerEQ/issues/231) (respond-endpoint policy semantics), [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (survey detail page, share-link URL shape), [#262](https://github.com/mathursrus/CustomerEQ/issues/262) (`text/csv` raw-body upload pattern), [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (`Brand.timezone`).
> **Resolved decisions** (D1–D19): 14 spec-locked + 5 design-locked Round 1 (2026-05-17). Spec: re-download = regenerate (Q1.1c); paste 10k / CSV 100k entries; trigger endpoint deleted (4a); separate `surveyName` CSV column (OQ-S1); Edit Expiry RBAC = `survey.distribute` (OQ-S2); CSV name-precedence "explicit columns win except when empty" (OQ-S4); Decision A mutually-exclusive audience modes. Design Round 1: D15 (CSV transport = `text/csv` raw body, R1-6); D16 (brand-TZ library = `date-fns-tz`, post-spike R1-3); D17 (rate-limit in-handler, R1-8); D18 (erasure scoped to #264, R1-10); D19 (migration hand-written, R1-11). Full table at §Resolved decisions.

---

## Customer

Marketing managers and CX operators on mid-market brands ($10M–$500M revenue) who own an ESP / CRM relationship and want CustomerEQ to give them per-recipient links to mail-merge — not to send the email themselves. Full persona narrative lives in the spec.

## Customer Problem being solved

Four interlocking gaps from the issue body: (P1) no BYO-email flow; (P2) `?email=` in URL is a GDPR / spoofing exposure; (P3) no audience-selector primitive; (P4) no "one response per wave" with cross-wave trending. The spec covers each in operator language; the RFC translates them into schema, endpoints, and migration sequencing.

## User Experience that will solve the problem

UX is fully detailed in the spec (§1–§5) and the [interactive mock](../feature-specs/mocks/378-distribute-flow.html). RFC scope is the implementation under those surfaces. One-line operator path:

1. On the existing survey detail page (#241), Distribution section has a third tile **Send via my email tool →** routing to `/admin/surveys/[id]/distribute`.
2. Single short page (no wizard): pick mode (Existing Members random sample, or Custom List paste/CSV) → Survey name in mail → expiry → live preview → **Generate `N` links**.
3. Transition in place to Success state: format dropdown + Download CSV (single transmission of plaintext URLs) + amber regenerate-warning.
4. Back on the survey detail page, a new filter row between Loop Monitor and Response lets the operator scope Response analytics to a specific wave (or to "Direct responses" = `batchId IS NULL` share-link/embed responses).
5. Batch detail page exposes Audience Spec (at-send-time + now counts), Edit Expiry (brand-TZ picker, both directions), Tokens table (operator-friendly status), and Regenerate-tokens (operator-error recovery — strong warning + confirmation modal).
6. Respondent receives email with `https://<host>/survey/<surveyId>/r/<token>` URL → standalone form (member-id field suppressed since token authorizes) → submit → token marked consumed; second submit = 409.

---

## Technical Details

### Schema changes

`packages/database/prisma/schema.prisma` — three additions, two modifications, one enum extension. All carry `brandId` per project rule R6.

#### New: `DistributionBatch`

```prisma
model DistributionBatch {
  id                 String                    @id @default(cuid())
  surveyId           String
  survey             Survey                    @relation(fields: [surveyId], references: [id])
  brandId            String                    // tenant-scoped (R6); enforced via explicit `where: { brandId }` in all handlers (matches Survey-side convention — see "Tenant-scoping" below)
  label              String                    // operator-facing wave name, auto-derived as `${Survey.title} · ${YYYY-MM-DD}` at create time; editable from batch detail header
  surveyNameInMail   String                    // respondent-facing survey name flowing into CSV's `surveyName` column; defaults to Survey.title at create time
  audienceSpec       Json                      // { mode: 'existing_members' | 'custom_list', count, percent?, identifiersRaw?: string, identifiersResolved: { memberId, identifier, kind }[], autoEnroll?: boolean, unmatched?: string[] } — see "audienceSpec shape" section below
  expiresAt          DateTime                  // wave expiry stored as UTC; copied to every child token at mint time and propagated on Edit Expiry
  samplingSeed       String?                   // base64url, internal infrastructure for V1 "Generate new tokens for same audience" — null for Custom List, set for Existing Members
  createdBy          String                    // clerk user id of the operator
  createdAt          DateTime                  @default(now())

  tokens             SurveyDistributionToken[]
  distributions      SurveyDistribution[]
  responses          SurveyResponse[]

  @@index([surveyId, createdAt])               // filter-row dropdown query, createdAt DESC
  @@index([brandId, expiresAt])                // future "expiring soon" surfaces; cheap to add now
  @@map("distribution_batches")
}
```

#### New: `SurveyDistributionToken`

```prisma
model SurveyDistributionToken {
  id          String              @id @default(cuid())
  batchId     String
  batch       DistributionBatch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  memberId    String
  member      Member              @relation(fields: [memberId], references: [id])
  brandId     String              // tenant-scoped (R6)
  tokenHash   String              @unique     // SHA-256(plaintext) — plaintext never stored
  tokenPrefix String                          // first 8 chars of plaintext, display-only for batch-detail table
  expiresAt   DateTime                        // copied from DistributionBatch.expiresAt; updated atomically when Edit Expiry runs on the parent batch
  consumedAt  DateTime?                       // single-use marker; set when a response is accepted via this token
  responses   SurveyResponse[]                // reverse relation for the optional FK on SurveyResponse

  @@unique([batchId, memberId])               // one token per member per batch — the issue's stated invariant
  @@index([tokenHash])                        // already implied by @unique; explicit for the response-submit hot path
  @@index([batchId, consumedAt])              // batch-detail "responded vs awaiting" counters
  @@map("survey_distribution_tokens")
}
```

#### Modified: `SurveyDistribution` (existing #117 model)

```prisma
model SurveyDistribution {
  id        String              @id @default(cuid())
  surveyId  String
  survey    Survey              @relation(fields: [surveyId], references: [id])
  memberId  String
  member    Member              @relation(fields: [memberId], references: [id])
  brandId   String
  sentAt    DateTime            @default(now())
  // NEW (#378):
  batchId   String?             // null for legacy and share-link / embed rows; required for rows written by token-mint
  batch     DistributionBatch?  @relation(fields: [batchId], references: [id], onDelete: Cascade)

  // CONSTRAINT MOVE: drop `@@unique([surveyId, memberId])`; add `@@unique([batchId, memberId])`.
  // Postgres treats NULL as distinct on unique constraints — multiple `(NULL, memberId)` rows
  // remain valid, which is the share-link/embed reality (one member can have many such rows over time).
  @@unique([batchId, memberId])
  @@index([surveyId, memberId, sentAt])        // cooldown-window query, unchanged
  @@map("survey_distributions")
}
```

#### Modified: `SurveyResponse`

```prisma
model SurveyResponse {
  // ...existing fields unchanged (lines 752–790)...
  // NEW (#378):
  distributionBatchId String?
  distributionBatch   DistributionBatch?       @relation(fields: [distributionBatchId], references: [id])
  distributionTokenId String?                  // optional: links the response to the specific token that authorized it
  distributionToken   SurveyDistributionToken? @relation(fields: [distributionTokenId], references: [id])

  // ...existing indexes unchanged...
  @@index([distributionBatchId, completedAt])  // "NPS by wave" aggregation
}
```

#### Modified: `MemberEnrolledVia` enum

```prisma
enum MemberEnrolledVia {
  MANUAL_API
  BULK_IMPORT
  SURVEY_RESPONSE
  EMBEDDED_FORM
  CLERK_OAUTH
  BULK_DISTRIBUTION   // NEW (#378) — Custom List auto-enroll
}
```

#### `audienceSpec` JSON shape

The Prisma `Json` column carries one of two discriminated unions:

```ts
type AudienceSpec =
  | {
      mode: 'existing_members';
      strategy: 'percent' | 'count';
      value: number;                          // 1–100 for percent; 1..N for count
      memberCountAtSendTime: number;          // snapshot for batch-detail "100 at send time" display
      samplingSeed: string;                   // mirrors DistributionBatch.samplingSeed
    }
  | {
      mode: 'custom_list';
      identifiersRaw: string;                 // operator's paste verbatim, or "<csv:filename.csv>" for upload
      identifiersResolved: { memberId: string; identifier: string; kind: 'email' | 'phone' | 'external_id' | 'member_id' }[];
      autoEnroll: boolean;
      autoEnrolledMemberIds: string[];        // subset of identifiersResolved that were created by this batch
      unmatched: string[];                    // identifiers that didn't resolve and weren't auto-enrolled
      memberCountAtSendTime: number;          // identifiersResolved.length
    };
```

Erasure-job extension contract (when #264 lands): the worker replaces `audienceSpec.identifiersResolved[].identifier` with `'[redacted]'` for erased members; the `memberId` references stay so audit lineage is preserved.

### Migration

Hand-edited per architecture §3.4 (Prisma's auto-generation emits DROP-and-CREATE for unique-constraint moves, which is wrong here — existing `SurveyDistribution` rows must be preserved). Forward-only; no `down`. Filename: `packages/database/prisma/migrations/<YYYYMMDDNNNNNN>_distribution_batches/migration.sql`. Per project rule R22c, the timestamp is claimed at PR submit time via `git log origin/main --oneline -- packages/database/prisma/migrations/` and bumped if another PR collides.

```sql
-- ── 1. Add enum value (additive; PostgreSQL ALTER TYPE … ADD VALUE) ───────────
ALTER TYPE "MemberEnrolledVia" ADD VALUE IF NOT EXISTS 'BULK_DISTRIBUTION';

-- ── 2. Create new tables ──────────────────────────────────────────────────────
CREATE TABLE "distribution_batches" (
  "id"               TEXT      NOT NULL,
  "surveyId"         TEXT      NOT NULL,
  "brandId"          TEXT      NOT NULL,
  "label"            TEXT      NOT NULL,
  "surveyNameInMail" TEXT      NOT NULL,
  "audienceSpec"     JSONB     NOT NULL,
  "expiresAt"        TIMESTAMP NOT NULL,
  "samplingSeed"     TEXT,
  "createdBy"        TEXT      NOT NULL,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribution_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "distribution_batches_surveyId_createdAt_idx"
  ON "distribution_batches" ("surveyId", "createdAt");
CREATE INDEX "distribution_batches_brandId_expiresAt_idx"
  ON "distribution_batches" ("brandId", "expiresAt");
ALTER TABLE "distribution_batches"
  ADD CONSTRAINT "distribution_batches_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "survey_distribution_tokens" (
  "id"          TEXT      NOT NULL,
  "batchId"     TEXT      NOT NULL,
  "memberId"    TEXT      NOT NULL,
  "brandId"     TEXT      NOT NULL,
  "tokenHash"   TEXT      NOT NULL,
  "tokenPrefix" TEXT      NOT NULL,
  "expiresAt"   TIMESTAMP NOT NULL,
  "consumedAt"  TIMESTAMP,
  CONSTRAINT "survey_distribution_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "survey_distribution_tokens_tokenHash_key"
  ON "survey_distribution_tokens" ("tokenHash");
CREATE UNIQUE INDEX "survey_distribution_tokens_batchId_memberId_key"
  ON "survey_distribution_tokens" ("batchId", "memberId");
CREATE INDEX "survey_distribution_tokens_batchId_consumedAt_idx"
  ON "survey_distribution_tokens" ("batchId", "consumedAt");
ALTER TABLE "survey_distribution_tokens"
  ADD CONSTRAINT "survey_distribution_tokens_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "distribution_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "survey_distribution_tokens_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. SurveyDistribution: add batchId, move unique constraint ────────────────
ALTER TABLE "survey_distributions"
  ADD COLUMN "batchId" TEXT;
ALTER TABLE "survey_distributions"
  ADD CONSTRAINT "survey_distributions_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "distribution_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the existing constraint. The schema marks it `@@unique([surveyId, memberId])` so Prisma
-- generated `survey_distributions_surveyId_memberId_key` — verified by reading the live DB before
-- this PR ships (the implement-validate phase MUST run `pnpm prisma migrate dev` against a real DB
-- per the L1 mistake-pattern recurrence #170 PR1).
ALTER TABLE "survey_distributions"
  DROP CONSTRAINT IF EXISTS "survey_distributions_surveyId_memberId_key";

CREATE UNIQUE INDEX "survey_distributions_batchId_memberId_key"
  ON "survey_distributions" ("batchId", "memberId");
-- Note: Postgres treats NULL as distinct in unique constraints, so all existing rows
-- (batchId IS NULL) coexist; future share-link/embed rows continue to write with batchId IS NULL
-- and never collide.

-- ── 4. SurveyResponse: add distributionBatchId + distributionTokenId ──────────
ALTER TABLE "survey_responses"
  ADD COLUMN "distributionBatchId" TEXT,
  ADD COLUMN "distributionTokenId" TEXT;
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_distributionBatchId_fkey"
  FOREIGN KEY ("distributionBatchId") REFERENCES "distribution_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "survey_responses_distributionTokenId_fkey"
  FOREIGN KEY ("distributionTokenId") REFERENCES "survey_distribution_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "survey_responses_distributionBatchId_completedAt_idx"
  ON "survey_responses" ("distributionBatchId", "completedAt");
```

Per architecture §3.4 + project rule R22a (column identifiers must match Prisma's camelCase quoting): every identifier above is the camelCase form Prisma generates. Confirmed by greping `packages/database/prisma/migrations/` for analogous patterns (`"surveyId"`, `"memberId"`, `"brandId"` all quoted, all camelCase).

**Tenant-scoping**: the `tenantScope.ts:3-13` middleware auto-scopes a fixed set of nine loyalty-side models (`Program`, `EarningRule`, `Member`, `LoyaltyEvent`, `Reward`, `Redemption`, `Campaign`, `CampaignEvent`, `AuditEvent`). **No survey-side model is in that set today** — `Survey`, `SurveyDistribution`, `SurveyResponse`, `SurveyRule`, `BrandTheme`, `QuestionTemplate`, `SurveyImportBatch`, `CxPlaybook` all rely on **explicit handler-level `where: { brandId: request.brandId }`** clauses (verified by grep: 5 occurrences in `apps/api/src/routes/surveys.ts` alone; same pattern in adjacent survey routes). #378's new models (`DistributionBatch`, `SurveyDistributionToken`) are survey-adjacent, so they follow the **same explicit-handler convention** as their immediate neighbors — every Prisma call in `apps/api/src/routes/distributionBatches.ts` includes a `where: { brandId: request.brandId }` clause for reads / updates / deletes, and the `brandId` is set on `data` for creates. The `multiTenant` plugin (`apps/api/src/plugins/multiTenant.ts`) continues to reject body `brandId` at `preValidation` for these routes. This is more explicit but matches the established survey-side neighborhood; opting into the middleware set instead would diverge from the local convention and force a parallel choice for the existing `SurveyDistribution` model.

### API Surface

All admin endpoints under `/v1/surveys/:id/distribution-batches/*` use the existing Clerk JWT + `multiTenant` + `audit` plugins. The respondent-facing endpoints stay under `/v1/public/*`. RBAC: a new permission `survey.distribute` is added to the existing role table and granted to the same role as `survey.edit` for V0 (Round 1 OQ2 carries — see ODs).

| Verb | Path | Auth | Brief |
|---|---|---|---|
| POST | `/v1/surveys/:id/distribution-batches/preview` | Clerk + `survey.distribute` | Idempotent preview — no rows written |
| POST | `/v1/surveys/:id/distribution-batches` | Clerk + `survey.distribute` | Generate links — atomic transaction; plaintext URLs returned once |
| GET | `/v1/surveys/:id/distribution-batches` | Clerk + `survey.read` | List batches (filter-row dropdown) |
| GET | `/v1/surveys/:id/distribution-batches/:batchId` | Clerk + `survey.read` | Batch detail (no plaintext URLs) |
| POST | `/v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens` | Clerk + `survey.distribute` | Regenerate; new plaintext URLs returned once |
| PATCH | `/v1/surveys/:id/distribution-batches/:batchId/expiry` | Clerk + `survey.distribute` | Edit Expiry (both directions) |
| POST | `/v1/public/surveys/:id/respond` | none (token-authorized) | EXISTING endpoint — adds optional `token` field |
| GET | `/v1/public/surveys/:id/token-status` | none | Pre-render check returning uniform shape per state |
| ~~POST `/v1/public/surveys/trigger`~~ | — | — | **DELETED in same PR** (R3-15 / R3-23, decision 4a); demo storefront migrated |

#### Request / response shapes (Zod, in `packages/shared/src/zod/distributionBatch.schema.ts`)

```ts
// Preview / Generate body — discriminated by `mode`
const PreviewBatchRequest = z.object({
  surveyNameInMail: z.string().min(1).max(80),
  expiresAt: z.string().datetime(),                       // ISO; server re-validates against Brand.timezone EOD snap if preset
  audience: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('existing_members'),
      strategy: z.enum(['percent', 'count']),
      value: z.number().int().positive(),
    }),
    z.object({
      mode: z.literal('custom_list'),
      identifiers: z.string().max(10_000 * 200),          // paste body — server splits + parses
      autoEnroll: z.boolean().default(true),
    }),
  ]),
});

// Generate response — the ONE plaintext transmission per NFR-S2
const GenerateBatchResponse = z.object({
  batchId: z.string(),
  label: z.string(),
  expiresAt: z.string().datetime(),
  tokenCount: z.number(),
  autoEnrolledMemberIds: z.array(z.string()),
  unmatched: z.array(z.string()),
  tokens: z.array(z.object({
    memberId: z.string(),
    identifier: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    plaintext: z.string(),                                // ONLY field that exists only in this response — never re-fetchable
  })),
});

// Edit Expiry body
const EditExpiryRequest = z.object({ expiresAt: z.string().datetime() });

// Regenerate body
const RegenerateTokensRequest = z.object({
  format: z.enum(['generic', 'mailchimp', 'hubspot', 'klaviyo']),
  confirmAcknowledge: z.literal(true),                    // server-side proof the operator passed the modal
});

// Respond endpoint — additive
// EXISTING schema is `PublicSurveyResponseSchema` at apps/api/src/routes/public.ts:30-46.
// Extend it with an optional `token` field; when present the handler validates the token
// and supersedes any body memberId / memberEmail / email / phone for identification.
const PublicSurveyResponseSchemaV2 = PublicSurveyResponseSchema.extend({
  token: z.string().optional(),
});

// Token-status response — uniform shape, varying respondent copy
const TokenStatusResponse = z.object({
  state: z.enum(['valid', 'expired', 'responded', 'survey-not-open', 'invalid']),
  // No memberId, no batchId, no surveyTitle — per NFR-S4 / NFR-S5
});
```

#### CSV upload — `multipart` vs `text/csv`

Verified (Phase 1 #3): `apps/api/src/routes/surveys.ts:915` uses `text/csv` raw-body with 11 MB bodyLimit and `parseCsvRaw` + `runAdapter(sourceType, headers, rows)`. `@fastify/multipart` is NOT registered.

**Recommendation**: the Distribute CSV upload uses the **same `text/csv` raw-body pattern**, not multipart — for two reasons: (a) zero new dependency, (b) operators paste/upload the same shape they would for survey-response import, so the parser is a near-clone. Filename rides as a `?filename=...` query param (the Distribute page already knows it from the `<input type="file">` change event). This corrects spec R6's "multipart" wording — see Open Decision OD-1.

Endpoint:
```
POST /v1/surveys/:id/distribution-batches/preview?filename=acme-q2-cohort.csv
Content-Type: text/csv
bodyLimit: 11 * 1024 * 1024
```

Server-side CSV parser is a new module `apps/api/src/utils/distributionListParser.ts` that wraps `parseCsvRaw` with #378's header-inference rules (email/phone/external_id/member_id/firstName/lastName aliases) and `Brand.memberIdentifierKind` tie-breaker. Returns `{ rows: { identifier, identifierKind, firstName?, lastName? }[], unmatched: string[] }`.

### Token generation + validation

```ts
// packages/shared/src/distributionTokens.ts — used by api (mint + validate)
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export function mintToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = randomBytes(24).toString('base64url');   // 24 bytes = 192 bits entropy; base64url-safe in URLs
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash, prefix: plaintext.slice(0, 8) };
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
```

Validation path (in the new public route handler):
1. `const hash = hashToken(plaintext)`.
2. `const token = await prisma.surveyDistributionToken.findUnique({ where: { tokenHash: hash } })`.
3. If `!token` → `{ state: 'invalid' }` (uniform body, 410 on submit / 200 on token-status check). DB-level lookup is constant-time across hashes; no further `timingSafeEqual` needed at this layer.
4. Else load `batch` + parent `survey`; branch on `survey.status !== 'ACTIVE'` → `survey-not-open` (410); on `token.expiresAt < now()` → `expired` (410); on `token.consumedAt !== null` → `responded` (409). All responses share the same body shape — copy variation is per-state on the respondent page, not server-side (NFR-S5).
5. On accept: single `prisma.$transaction()` writes `SurveyResponse` (with `distributionBatchId` + `distributionTokenId` populated) AND sets `token.consumedAt = now`. Conditional update `UPDATE survey_distribution_tokens SET consumedAt = now WHERE id = ? AND consumedAt IS NULL` is the race guard for concurrent submits — the second one's `UPDATE` affects 0 rows, the handler aborts and returns 409.

Pattern mirrors `apps/api/src/plugins/auth.ts:69` ApiKey precedent — hash-at-rest, plaintext only at provision time.

### Brand-timezone formatting

Spec requires brand-TZ display for: Edit Expiry preset snap (EOD in brand TZ), Success banner expiry string, batch detail Created-at + Members-now + Expiry, filter-row sent dates, preview Last-response columns. Locale flows through `Brand.locale` (verified at `schema.prisma:213`, default `"en-US"`, added by #277) — formatted output respects each brand's locale, not a hardcoded `'en-US'`.

**Library**: `date-fns-tz` (~25 KB add). Phase 3 spike confirms three candidate approaches (reviewer's "current time + add days + 23:59:59.999" native-Intl, RFC R0's clever-clog split-on-dash, and `date-fns-tz`'s `zonedTimeToUtc`) produce byte-identical outputs across all 15 DST + half-hour-TZ + boundary-day test cases. Library wins on merit: industry standard, used in millions of projects, one-line API per primitive, and future surfaces (digest emails, scheduled batches in V1.x, audit-log display, alert-rule cooldowns, expiring webhook secrets) reuse the same package. See `docs/evidence/378-tz-spike/{spike.mjs, findings.md}` for the spike script + 15-case test fixture + the merit-over-ease analysis.

The shared utility lives at `packages/shared/src/datetime.ts` (consumed by `apps/web`, `apps/api`, and `apps/worker` — Edge-runtime safe per `date-fns-tz`'s ESM build):

```ts
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

/**
 * Format an instant for display in a brand's TZ + locale.
 * `Brand.timezone` (IANA) and `Brand.locale` (BCP 47) both come from the brand row.
 * Default `dateFormat` matches the Success banner / batch detail convention; callers
 * may override per surface (e.g., date-only for the filter row).
 */
export function formatInBrandTz(
  date: Date | string,
  brandTimezone: string,
  brandLocale: string,
  dateFormat: string = "MMM d, yyyy h:mm:ss a zzz",
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, brandTimezone, dateFormat, { locale: resolveLocale(brandLocale) });
}

/**
 * EOD-in-brand-TZ arithmetic. Given a calendar date in the brand's TZ, return
 * the UTC instant that displays as 23:59:59.999 wall-clock in that TZ.
 * Used by R11 preset snap ("7 days" → EOD on the calendar day 7 days from now).
 */
export function endOfDayInBrandTz(localDate: Date, brandTimezone: string): Date {
  // Project localDate into the brand TZ → take its YYYY-MM-DD → assemble
  // "YYYY-MM-DDT23:59:59.999" as wall-clock in the brand TZ → convert to UTC.
  const ymd = formatInTimeZone(localDate, brandTimezone, "yyyy-MM-dd");
  return zonedTimeToUtc(`${ymd}T23:59:59.999`, brandTimezone);
}
```

Brand-locale lookup uses `date-fns/locale` (peer of `date-fns-tz`): a tiny `resolveLocale(bcp47)` switch maps `Brand.locale` strings (`"en-US"`, `"en-GB"`, `"fr-FR"`, `"de-DE"`, `"ja-JP"`, etc.) to the corresponding locale object, falling back to `enUS` for unknown values. The set is small (the Brand.locale field's allowed values are constrained by the Organization Settings UI from #277); extending it later is a one-line addition per locale.

`packages/api`-side and `packages/worker`-side consumers `import` from `@customerEQ/shared/datetime`. The `apps/web` admin pages do the same — `date-fns-tz`'s tree-shakable build keeps the bundle delta minimal (the `formatInTimeZone` + `zonedTimeToUtc` pair pulls only the necessary modules).

### In-handler rate-limit with `QUEUE_MODE` parity (NFR-SC1 / D17)

NFR-SC1 (≤10 batches/min/survey) is enforced inside the `POST /v1/surveys/:id/distribution-batches` handler — no plugin. The existing `apps/api/src/queues/bullmq.ts` queue-mode parity contract (verified Phase 1 #10: `QUEUE_MODE=redis` builds Queue objects at lines 52-69; `QUEUE_MODE=inline` short-circuits at line 53) is the precedent. The rate-limit follows the same shape: full enforcement when Redis is available, structured-log degradation when it isn't.

```ts
// apps/api/src/routes/distributionBatches.ts — inside POST /v1/surveys/:id/distribution-batches handler,
// before the prisma.$transaction() that mints tokens.

const RATE_LIMIT_KEY = (surveyId: string) => `ratelimit:distribute:${surveyId}`;
const RATE_LIMIT_MAX = 10;            // requests
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute

async function enforceBatchRateLimit(fastify: FastifyInstance, surveyId: string): Promise<void> {
  // QUEUE_MODE=inline path — Redis is null per apps/api/src/plugins/redis.ts.
  // Graceful degradation: skip the check, structured-log a WARN so ops can see.
  if (!fastify.redis) {
    fastify.log.warn(
      { event: 'distribute.ratelimit.skipped', reason: 'redis_unavailable', surveyId },
      'NFR-SC1 rate-limit skipped (QUEUE_MODE=inline or Redis down)',
    );
    return;
  }

  const key = RATE_LIMIT_KEY(surveyId);
  // INCR + EXPIRE on first hit. Pipeline both to avoid a round-trip on the warm path.
  const [count] = await fastify.redis
    .multi()
    .incr(key)
    .expire(key, RATE_LIMIT_WINDOW_SECONDS, 'NX')  // NX = only set TTL if not already set
    .exec()
    .then((results) => results.map(([, v]) => v as number));

  if (count > RATE_LIMIT_MAX) {
    throw fastify.httpErrors.tooManyRequests(
      `Batch creation rate-limit exceeded: ${RATE_LIMIT_MAX} per ${RATE_LIMIT_WINDOW_SECONDS}s per survey. Try again in a minute.`,
    );
  }
}
```

Adoption-trigger for the eventual `@fastify/rate-limit` migration (per [#218](https://github.com/mathursrus/CustomerEQ/issues/218)'s #378 comment): when a 3rd endpoint family in the repo needs throttling, OR when this in-handler approach can no longer express the limit shape (e.g., per-brand-per-minute rather than per-survey, or progressive backoff). Until then this implementation is the durable answer — it's ~15 lines, fully observable via the existing Pino logs, and inherits the queue-mode parity contract from `bullmq.ts`.

### File-level change list

Every path verified against the repo at Phase 1.

**Schema + migration**
- `packages/database/prisma/schema.prisma` — 3 model adds (`DistributionBatch`, `SurveyDistributionToken`), 2 modifies (`SurveyDistribution`, `SurveyResponse`), 1 enum extend (`MemberEnrolledVia`). New back-relations on `Survey`, `Member`.
- `packages/database/prisma/migrations/<timestamp>_distribution_batches/migration.sql` — new (hand-written; section above).
- `packages/database/src/middleware/tenantScope.ts` — **no change**. The new models follow the existing Survey-side convention (explicit handler-level `where: { brandId: request.brandId }`), not the middleware-auto-scoping convention used by the 9 loyalty-side models. See "Tenant-scoping" note in §Technical Details.

**Shared package**
- `packages/shared/src/zod/distributionBatch.schema.ts` — new (Zod schemas above).
- `packages/shared/src/distributionTokens.ts` — new (mint + hash helpers).
- `packages/shared/src/datetime.ts` — new (`formatInBrandTz`, `endOfDayInBrandTz` — both wrap `date-fns-tz` per D16; `Brand.locale` plumbed through `formatInBrandTz`).
- `packages/shared/package.json` — add `date-fns-tz` (and its peer `date-fns`) as runtime dependencies.
- `packages/shared/src/zod/responseSubmit.schema.ts` — extend the existing `PublicSurveyResponseSchema` (at `apps/api/src/routes/public.ts:30-46`) with optional `token` field. New name `PublicSurveyResponseSchemaV2 = PublicSurveyResponseSchema.extend({ token: z.string().optional() })`.

**API**
- `apps/api/src/routes/distributionBatches.ts` — new. 5 admin routes + handler logic; reuses existing `audit` + `multiTenant` plugins via per-route config.
- `apps/api/src/routes/public.ts` — modify: (a) add optional `token` to the existing `PublicSurveyResponseSchema` (at lines 30–46) and branch in handler to validate-and-consume — when the token validates, the handler also sets `request.brandId = survey.brandId` BEFORE returning, so the audit plugin's `onResponse` hook can record the `distribution_batch.token_responded` row (see "Audit-log declarations — public route handling" below for why this is necessary); (b) add `GET /v1/public/surveys/:id/token-status`; (c) **DELETE** trigger endpoint (`fastify.post` at line 604, comment block starting line 602, total range 602–679) + the comment at line 248 (which becomes stale).
- `apps/api/src/utils/distributionListParser.ts` — new (CSV header inference + `Brand.memberIdentifierKind` tie-breaker + RFC-822 `Name <email>` paste parser).
- `apps/api/src/services/memberResolution.ts` — verify the existing `resolveOrEnrollMember()` accepts the new `BULK_DISTRIBUTION` enum value (line 102); add to the channel-handler switch if needed.
- `apps/api/src/app.ts` — register the new route module.

**Worker** — no changes for V0. (Erasure-job extension waits for #264; documented as known dep.)

**Web admin**
- `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` — new (single-page Configure ↔ Success).
- `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` — new (batch detail).
- `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx:109` — modify: add a third **`Send via my email tool`** tile and place it **leftmost** in the row (Embed snippet center, Share link rightmost). Tile renders white-bg + 2px indigo border (no fill) to read as primary action without the banner-like indigo wash of earlier mocks. Existing `${window.location.origin}/survey/${id}` construction stays for the share link. This is a deliberate divergence from `docs/feature-specs/mocks/378-distribute-flow.html`, captured in the spec's Phase 12 deviation log entry P12-1.
- `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionBatchesFilter.tsx` — new (filter row between Loop Monitor and Response, with "Direct responses (share link / embed)" option per R23 + R3-12).
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — modify: insert the filter row component between Loop Monitor (§3 / #241 R32b) and Response (#241 R32).
- `apps/web/src/components/distribution/` — new directory for the configure/success components (`AudienceModeChooser.tsx`, `CustomListInput.tsx`, `LivePreview.tsx`, `SuccessState.tsx`, `RegenerateConfirmationModal.tsx`, `EditExpiryControl.tsx`).
- `apps/web/src/lib/datetime.ts` — new (re-exports from `@customerEQ/shared/datetime`).

**Web respondent**
- `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — new nested dynamic route. Calls `GET /v1/public/surveys/:id/token-status?token=...` on mount; renders the form (state=`valid`) or one of the four error states. Member-id field suppressed when token authorizes. Consumes `useSurveyResponseForm` (below) with `identityFromToken: true`.
- `apps/web/src/app/survey/[id]/page.tsx:109` — modify: remove the `?email=` query-param prefill per R3-15. The share-link path stays functional; it just no longer reads PII from the URL. Refactored to consume `useSurveyResponseForm` so its glue stops drifting from the new tokenized page.
- `apps/web/src/components/survey-form/useSurveyResponseForm.ts` — new shared hook. Owns survey/brand fetch, answers/consent/memberId state, clear-on-change handlers, required-question + explicit-consent validation, and the `effectiveConsentMode = surveyOverride ?? brandDefault` projection. Both live-respondent host pages consume it; each page contributes only its identity gate (member-id field vs token-status preflight) and POST body / response branching. Rationale: #378 introduces the second live host page; without the shared hook the validation logic duplicates and (as observed mid-PR) drifts — inline-error rendering was missing from the tokenized page until the extraction. The third rendering surface (embed widget at `apps/api/src/routes/public.ts:generateWidgetJs`) is intentionally out of scope; tracked at [#415](https://github.com/mathursrus/CustomerEQ/issues/415).

**Demo storefront** (per Rule 26 — in same PR)
- `examples/acme-coffee-demo/lib/customereq.js:124` — modify: replace `POST /v1/public/surveys/trigger` call with `POST /v1/surveys/:id/distribution-batches` (Custom List of one identifier — the demo's single test recipient).
- `examples/acme-coffee-demo/server.js:11` — modify: doc string update.
- `examples/acme-coffee-demo/README.md:16,60` — modify: API table + demo-flow doc.

**Other**
- `apps/api/src/routes/developer.ts:9,43` — no change (already constructs `${WEB_BASE_URL}/survey/${s.id}` without `?email=`).
- `apps/worker/src/processors/loyaltyEvents.ts:333` — no change (produces share-link URLs, not tokenized).
- `fraim/config.json` — add `competitors` array (8 vendors per spec R3-30). In same PR per Rule 26.

### Audit-log declarations

```ts
// apps/api/src/routes/distributionBatches.ts — per-route audit configs
fastify.post('/v1/surveys/:id/distribution-batches', {
  config: {
    auditAction: 'distribution_batch.create',
    auditResourceType: 'distribution_batch',
    auditAllowlist: ['surveyId', 'batchId', 'mode', 'tokenCount', 'autoEnrolledCount', 'requestIp'],
  },
  // ...
});

fastify.patch('/v1/surveys/:id/distribution-batches/:batchId/expiry', {
  config: {
    auditAction: 'distribution_batch.expiry_edit',
    auditResourceType: 'distribution_batch',
    auditAllowlist: ['surveyId', 'batchId', 'fromExpiresAt', 'toExpiresAt', 'requestIp'],
  },
});

fastify.post('/v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens', {
  config: {
    auditAction: 'distribution_batch.tokens_regenerated',
    auditResourceType: 'distribution_batch',
    auditAllowlist: ['surveyId', 'batchId', 'regeneratedCount', 'requestIp'],
  },
});

fastify.post('/v1/public/surveys/:id/respond', {
  // existing config — add:
  config: {
    auditAction: 'distribution_batch.token_responded',   // when body.token present; existing 'survey.respond' otherwise
    auditAllowlist: ['surveyId', 'batchId', 'tokenId', 'memberId', 'requestIp'],
  },
});
```

Verified shape matches `apps/api/src/plugins/audit.ts:115-121` (per-route `config` flags) + `:139-149` (`requestIp` capture via Fastify `request.ip`, trust-proxy-aware).

**Public-route audit handling — design constraint (verified by reading the audit plugin)**: the audit plugin's `onResponse` hook short-circuits when `request.brandId` is unset (`audit.ts:103-106`). Public routes carry `config: { public: true }` and don't have `brandId` set by the auth plugin. **For the token-respond audit row to be persisted, the handler MUST assign `request.brandId = survey.brandId` after the token validates and the survey/brand pair is known**, BEFORE the response is sent (`reply.send(...)` triggers `onResponse`). This is a small handler-level change (one line) that piggybacks the existing audit pipeline. Alternative — direct `fastify.prisma.auditEvent.create({...})` call inside the handler — is also acceptable but introduces a parallel audit path; the handler-assignment approach is preferred because it reuses the existing allowlist + IP capture. Per `auditPlugin` lines 102–112, this is the same pattern other handlers would need; the audit plugin is designed to fire for any successfully-mutating route with `brandId` set on the request.

## Confidence Level

**90 / 100** (post-spike + R1 corrections). High confidence on schema, migration ordering, token mint/validate, transaction shape, and audit wiring — all mirror well-trodden patterns in this repo (#231 dedup, #262 import, ApiKey hashing, `date-fns-tz` is industry standard with spike-confirmed correctness). The remaining 10-point reservation lives in:

- **Regenerate-tokens response-body plaintext containment** — the only place in the design where plaintext crosses the API boundary post-creation. Three concrete self-validation steps in impl:
  1. **Response-body schema-assert test** (integration): `POST /v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens` response must satisfy `RegenerateTokensResponse.parse(body)`; the schema declares `tokens[].plaintext: z.string()`. Any subsequent `GET .../batches/:batchId` response is parsed against `BatchDetailResponse`, which has NO `plaintext` field — Zod `.strict()` rejects a leaked one. Assertion: `expect(getBody).not.toHaveProperty('tokens.0.plaintext')` and `expect(() => BatchDetailResponse.strict().parse(getBody)).not.toThrow()`.
  2. **Static-analysis prohibition on plaintext leak** (CI): ESLint custom rule `no-plaintext-in-batch-get` — any `prisma.surveyDistributionToken.findUnique`/`findMany`/`findFirst` call site outside `distributionBatches.ts:mintTokens` / `:regenerateTokens` must not include `plaintext` in `select`. Fails CI on a new code path that violates the contract.
  3. **End-to-end old-URL-410 verification** (Playwright): after regenerate, a request to one of the *previous* tokenized URLs returns HTTP 410 with `state='invalid'` body shape; no plaintext field appears in the response. Run against a real test DB so the absence of the previous `tokenHash` row is the actual gate, not a mock.

- **#264 erasure job dependency**: scoped out of #378 (locked OD-4a, see Resolved decisions). #264's AC has been augmented (via PR #385 comment 2026-05-17) with the `audienceSpec.identifiersResolved[].identifier → '[redacted]'` redaction contract so the next implementor doesn't miss #378's schema. Schema is shape-compatible. The known-gap is a real compliance gap until #264 lands but not a #378 design defect.

- **Rate-limit infrastructure**: NFR-SC1 lands as in-handler Redis `INCR + EXPIRE` (locked OD-3a). #218's `@fastify/rate-limit` adoption tracker has been augmented (via PR #385 comment 2026-05-17) with the explicit trigger for when to migrate (≥3 endpoint families need throttling, or the in-handler approach can no longer express the limit shape).

## Validation Plan

| User Scenario | Expected outcome | Validation method |
|---|---|---|
| Operator on a survey with 1,243 members picks Existing Members → Count = 100 → Generate | 100 tokens minted; 100 distribution rows with batchId set; CSV downloads with 100 rows in chosen format | UI (Playwright happy path) + integration (Supertest against `POST /distribution-batches`) + DB (Prisma count + audit-row assertions) |
| Operator pastes `Jane Mitchell <jane@brand.com>, +15551234; usr_abc` against an email-keyed brand with auto-enroll ON | `jane@brand.com` resolves (or auto-enrolls with firstName='Jane', lastName='Mitchell'); other two appear in `unmatched`; preview reflects this; Generate creates 1 token | Unit (parser logic in `distributionListParser.ts`) + integration (preview endpoint) + UI (preview table renders correctly) |
| Operator uploads a 50k-row CSV with header `Email,First Name,Last Name` | CSV parsed via header inference; 50k tokens minted; CSV download contains 50k rows; flow completes in < 30s | Integration (preview + generate at scale) + Playwright smoke (file-upload to drag-and-drop) |
| Operator picks "7 days" preset at 14:00 PT under brand timezone `America/Los_Angeles` | `DistributionBatch.expiresAt` stored as UTC equivalent of `2026-05-22T23:59:59-07:00`; Success banner shows "Tokens expire 2026-05-22 11:59 PM PT" | Unit (`endOfDayInBrandTz` returns correct UTC) + integration (Generate endpoint persists correct timestamp) + Playwright (banner renders correctly) |
| Respondent clicks tokenized URL → form loads → submits | `SurveyResponse` row written with `distributionBatchId` + `distributionTokenId`; token's `consumedAt` set in same transaction; member-id field NOT shown in form | E2E (Playwright loads `/survey/:id/r/:token` → fills form → submits) + integration (DB assertion + atomicity test by killing API mid-write) |
| Respondent re-clicks same URL after submission | HTTP 409 from token-status check; form renders "This survey has already been submitted" copy; no PII in DOM | E2E + integration (assert response body has uniform shape) |
| Respondent clicks expired token URL (server clock advanced past `expiresAt`) | HTTP 410; form renders "This survey link has expired. If you still want to share feedback, please contact the sender." | E2E + integration |
| Operator edits expiry from "in 7 days" to "in 1 day" (shorten) while survey ACTIVE | `DistributionBatch.expiresAt` + all child token `expiresAt` updated in single transaction; audit row written | Integration + DB |
| Operator edits expiry to a past moment | HTTP 422 `code='EXPIRES_AT_MUST_BE_FUTURE'`; no DB changes | Integration |
| Operator clicks Regenerate, confirms modal | New tokens minted; old `tokenHash` replaced; previous URLs return 410 `state='invalid'`; previously-consumed tokens retain `consumedAt` (their responses remain valid); audit row `tokens_regenerated` written; new CSV downloads | Integration (DB before/after diff) + Playwright (modal flow + CSV download) |
| Operator opens filter row on a survey with 3 batches + 5 share-link responses | Dropdown lists 3 batches in createdAt DESC order + "Direct responses (share link / embed)" option; selecting filters Response; Loop Monitor unchanged | Playwright (DOM + network assertions) |
| `POST /v1/public/surveys/trigger` called after merge | HTTP 404 | Integration (existing route handler removed) |
| Demo storefront's "Simulate ticket resolved" flow exercised | Calls new `POST /distribution-batches` endpoint successfully; tokenized URL generated | Manual smoke against `examples/acme-coffee-demo` |
| Cross-brand access — Brand A operator queries Brand B's batch by id | HTTP 404 (not 403 — existence not disclosed) | Integration (assert response status + body) |

## Test Matrix

| Layer | Suites added | Suites modified |
|---|---|---|
| **Unit** | `packages/shared/src/distributionTokens.test.ts` (mint entropy, hash determinism); `packages/shared/src/datetime.test.ts` (`endOfDayInBrandTz` across DST + Intl edge cases); `apps/api/src/utils/distributionListParser.test.ts` (paste parser, CSV header inference, `Brand.memberIdentifierKind` tie-breaker, `Name <email>` form, OQ-S4 empty-column fallback) | `apps/api/src/services/memberResolution.test.ts` — add `BULK_DISTRIBUTION` enum case |
| **Integration** | `apps/api/test/integration/distributionBatches.test.ts` (5 admin endpoints — preview, generate, list, detail, regenerate, expiry-edit; cross-brand 404; auto-enroll path); `apps/api/test/integration/public-respond-token.test.ts` (4 token states; response-policy interactions R22/R22b/R22c; race-window NFR-S6) | `apps/api/test/integration/public-respond.test.ts` — add `token` body field path; `apps/api/test/integration/public-trigger.test.ts` — assert 404 after deletion |
| **Worker** | None — no new processors. | None. |
| **E2E** | `apps/web/test/e2e/distribute-flow.e2e.ts` (happy path: configure → generate → download CSV → respondent submits); `apps/web/test/e2e/distribute-error-states.e2e.ts` (4 token-error pages, no PII in DOM) | None. |

Per project rule R9 (#378 is a P1 feature ~ NFR-S2-load-bearing → upgraded de-facto to P0 test discipline): unit + integration + E2E all required. Per CLAUDE.md "Testing Rules" + project rule R11a, tests fail loudly when prerequisites are missing — no silent skips.

## Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-A | `SurveyDistribution` unique-constraint move is a one-way door; pre-#378 rows have `batchId IS NULL` and must coexist | High | Hand-written migration (above) drops old constraint AFTER adding the column; Postgres NULL-distinct semantics keep legacy rows valid. Implement-validate phase MUST run `pnpm prisma migrate dev` against a real Docker DB (per L1 mistake-pattern #170 PR1) before PR submit. |
| R-B | Token-validation timing attack | Medium | Primary lookup is `findUnique({ where: { tokenHash } })` — DB B-tree on a UNIQUE index is constant-time per query relative to candidate token. Uniform error-response body shape across `invalid`/`expired`/`responded`/`survey-not-open` (NFR-S5). No conditional-branch leak on the hot path. |
| R-C | Regenerate atomicity — plaintext must be returned once without storing it | Medium | Single `prisma.$transaction()`; build plaintext array in memory pre-write; write only hashes; return plaintext array as the immediate POST response body. No GET endpoint ever sees plaintext. |
| R-D | Edit Expiry shorten race with in-flight response submit (NFR-S6) | Medium | Postgres MVCC under read-committed: the response-submit's `expiresAt > now()` check reads the row's *committed* `expiresAt`. The expiry-edit either commits before the submit's SELECT (submit sees new value, may reject) or after (submit sees old value, accepts) — never partial. Test case covers both orderings. |
| R-E | CSV `text/csv` raw-body can't carry the operator-uploaded filename natively | Low | Filename rides as a `?filename=...` query param (the Distribute page already knows it). Matches the #262 import endpoint precedent. |
| R-F | **#264 (worker erasure job) NOT IMPLEMENTED** | Medium → Scoped out (D18) | Erasure is scoped to #264; #378 schema is shape-compatible (`audienceSpec.identifiersResolved[].identifier` redaction rule + `SurveyResponse.distributionBatchId` non-PII). #264's AC has been augmented (PR #385 comment 2026-05-17) with the redaction contract so the next implementor doesn't miss #378. Compliance section reframes from "extended" to "dependency on #264". |
| R-G | **No rate-limit plugin exists** in `apps/api/src/plugins/` | Low → Implemented in-handler (D17) | NFR-SC1 (10 batches/min/survey) implemented in the `POST /v1/surveys/:id/distribution-batches` handler via Redis `INCR + EXPIRE` with `QUEUE_MODE=inline` graceful-degradation (skip + structured-log warn at WARN level). #218's `@fastify/rate-limit` adoption tracker has been augmented (PR #385 comment 2026-05-17) with explicit migration trigger (≥3 endpoint families need throttling, or the in-handler approach can no longer express the limit shape). |
| R-H | Brand-TZ formatting is greenfield | Low → Library-backed (D16) | `date-fns-tz`'s `formatInTimeZone` + `zonedTimeToUtc` provide both surfaces; spike confirms correctness across 15 DST + half-hour-TZ edge cases. Library is industry-standard; future surfaces (digest emails, scheduled batches, audit-log display, alert-rule cooldowns) reuse the same package. `Brand.locale` plumbed through so formatting respects each brand's locale. |
| R-I | Token URL length (`/survey/<surveyId>/r/<token>` ≈ 24+8+24 base64 chars ≈ 90 chars) on platforms with URL-length truncation | Low | Total length ≤ 100 chars after host prefix — well within ESP merge-tag column limits (Mailchimp 1000+, HubSpot 1000+). No mitigation needed. |
| R-J | Bulk auto-enroll path triggers many `resolveOrEnrollMember` calls; each is a write transaction | Medium | Custom List Generate processes identifiers in chunks of 200 inside the outer `prisma.$transaction()`. NFR-P1/P2 budgets account for this; a 10k-batch auto-enrolling 100% new members worst-cases at ~30s wall-clock — covered by the conservative loading-state estimate (50ms/member). |
| R-K | `?email=` removal on `apps/web/src/app/survey/[id]/page.tsx:109` may break in-flight links operators have already mailed pre-merge | Low | Receiver-side reading of `?email=` has already been retired since #241 Slice 5 (`apps/api/src/routes/public.ts:248` comment). The remaining read on the page is cosmetic (pre-fills the member-id input). Removing it just means the respondent re-types their email — same behavior as a share-link click today. No regression. |

## Spike Findings

**EXECUTED** — Phase 3 spike on brand-TZ EOD arithmetic, run 2026-05-17 in response to RFC review comment [R1-3](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254599820). Full findings doc: [`docs/evidence/378-tz-spike/findings.md`](../evidence/378-tz-spike/findings.md). Spike script: [`docs/evidence/378-tz-spike/spike.mjs`](../evidence/378-tz-spike/spike.mjs).

### What was spiked

Three approaches to "given `Brand.timezone` + N-day preset, return the UTC instant representing 23:59:59.999 in that TZ on (today + N)":
- **Approach A** — reviewer's proposed "current time + add days + 23:59:59.999," native `Intl`.
- **Approach B** — RFC R0's clever-clog `'en-CA'` locale split-on-dash, native `Intl`.
- **Approach C** — `date-fns-tz`'s `zonedTimeToUtc('YYYY-MM-DDT23:59:59.999', brandTz)`.

### Result

**15/15 pass across all three approaches** — byte-identical UTC `Date` outputs for: PT/ET DST spring-forward + fall-back windows, exact boundary days, NZ Southern-hemisphere DST, half-hour IST (`+05:30`), N=0 same-day EOD, and a 90-day window crossing fall-back.

| Edge case | Sample output |
|---|---|
| PT spring-forward window | `utc: 2026-03-13T06:59:59.999Z · tz: Mar 12, 2026, 11:59:59 PM PDT` |
| PT fall-back window | `utc: 2026-11-06T07:59:59.999Z · tz: Nov 05, 2026, 11:59:59 PM PST` |
| IST half-hour offset | `utc: 2026-05-22T18:29:59.999Z · tz: May 22, 2026, 11:59:59 PM GMT+5:30` |
| 90-day window crossing fall-back | `utc: 2026-11-14T07:59:59.999Z · tz: Nov 13, 2026, 11:59:59 PM PST` |

### Decision impact

Correctness is not the deciding axis — all three converge. The decision becomes ergonomics + maintenance cost:
- `date-fns-tz` `zonedTimeToUtc(...)` is one line per primitive.
- Native approaches require ~30 lines including a `wallClockToUtc` helper that future contributors maintain.
- Future surfaces (digest emails, scheduled batches, audit-log display, alert-rule cooldowns, expiring webhook secrets) will reuse the same primitive — library wins by amortization.

**OD-2 reversed from 2a (native Intl) to 2b (`date-fns-tz`) on merit.** Pre-spike RFC's 2a recommendation cited "zero new dependency" — that is the merit-over-ease anti-pattern L1 `feedback_merit_over_ease.md` (P-HIGH 8.0) was authored to prevent. Coaching moment for the misfire: [`fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-17T17-00-00-merit-over-ease-misfired-on-od-2.md`](../../fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-17T17-00-00-merit-over-ease-misfired-on-od-2.md).

## Observability (logs, metrics, alerts)

Per NFR-O1–O3:

- **Structured logs** (Pino, existing pattern): every batch creation, expiry edit, regenerate, and token response-submit emits a structured log with `surveyId`, `batchId`, `tokenId`, `actorId` (sourced from `request.clerkUserId` — matches the `AuditEvent.actorId` column shape), `requestIp`, `latencyMs`. Generate logs include `tokenCount` + `autoEnrolledCount` + `unmatchedCount`.
- **Audit log** (existing `apps/api/src/plugins/audit.ts`): per-route allowlists declared above. Audit log is the substrate for any future "distribution activity" view.
- **Per-batch counters** (`sentCount`, `respondedCount`, `awaitingCount`, `expiredCount`): materialized via simple SELECT in the list endpoint; no separate counter table in V0. If batch counts grow beyond ~10k batches per brand, V1 may add a denormalized counter (matches the Survey.distributionCount precedent).
- **No new metrics / alerts**: existing API latency dashboards cover the new endpoints under their `/v1/surveys/*` route group. If NFR-P2 (30s budget for 10k-token batch) is violated in prod, that surfaces via existing route-level p95 alerting.

---

## Open Decisions for the reviewer

**All Round-1 ODs resolved as of 2026-05-17** — see Resolved decisions table below. This block is preserved as a record of what was deliberated and what the reviewer locked, so the implementation has the trail.

| OD | Subject | Pre-spike `← recommended` | **Locked outcome** |
|---|---|---|---|
| OD-1 | CSV upload transport | 1a (`text/csv` raw body) | **NOT AN OD — locked in spec.** Reviewer R1-6: *"Already confirmed in the spec - follow the format of Import Survey Results."* Moved to Resolved decisions; spurious as an "open" question. |
| OD-2 | Brand-timezone library | 2a (native `Intl` + 30-line helper) | **2b (`date-fns-tz`)** — reversed post-spike on merit (`feedback_merit_over_ease.md`). Reviewer R1-3 directed Phase 3 spike; spike confirms all 3 approaches converge correctness-wise; library wins on long-term ergonomics. See Spike Findings. |
| OD-3 | NFR-SC1 rate-limit posture | 3a (in-handler Redis) | **3a (in-handler Redis with `QUEUE_MODE=inline` graceful-degradation)**, plus comment on #218 with adoption trigger for the `@fastify/rate-limit` migration. Reviewer R1-8 "Implement". |
| OD-4 | Erasure-job extension | 4a (scope out, document #264) | **4a** — reviewer R1-10 "Agreed". #264 AC augmented via PR #385 comment with the redaction contract. |
| OD-5 | Migration shape | 5a (hand-written per architecture §3.4) | **5a** — reviewer R1-11 "Agreed". Auto-generate-then-hand-edit explicitly rejected. |

---

## Resolved decisions

14 carried forward from spec + 5 locked in design Round 1 (post-spike + reviewer signoff 2026-05-17).

| # | Decision | Source | Locked outcome |
|---|---|---|---|
| D1 | URL shape | spec §4 / R19 / R3-9 / R3.1 | `/survey/:surveyId/r/:token` — path segment, no query param, no `app.` subdomain |
| D2 | Audience modes | spec R4 / R2-2 | Mutually exclusive: Existing Members XOR Custom List per batch |
| D3 | Re-download semantics | spec R18 / R29 / Q1.1c | Re-download = regenerate; new tokens; strong warning at both surfaces |
| D4 | Paste / CSV caps | spec R6 / Q2 / Q3 | 10k paste / 100k CSV / 11 MB body |
| D5 | Trigger endpoint | spec §5 / R3-15 / 4a | Deleted in this PR; demo storefront migrated |
| D6 | RBAC | spec API surface / OQ-S2 | `survey.distribute` permission; same as `survey.edit` role for V0 |
| D7 | CSV `surveyName` column | spec §2.6 / OQ-S1 | Separate column (per format-specific naming table) |
| D8 | CSV multi-column name precedence | spec R6 / OQ-S4 | Explicit columns win except when empty (bracketed `Name <email>` fallback) |
| D9 | Identifier kind tie-breaker | spec R6 / R3-18 | `Brand.memberIdentifierKind` |
| D10 | Brand-TZ everywhere | spec R3-A / R11 / R16 / R26 | All displayed timestamps in `Brand.timezone`; expiry stored as UTC. Locale per `Brand.locale` (R1-1/R1-2). |
| D11 | `<No batch>` filter option | spec R23 / R3-12 | Shown as "Direct responses (share link / embed)" when ≥1 such response exists |
| D12 | `samplingSeed` UI | spec R8 | Internal-only; never surfaced |
| D13 | No Revoke / No Re-run in V0 | spec R27 | Edit Expiry covers cut-off; Re-run = V1 |
| D14 | `fraim/config.json.competitors` | spec R3-30 | 8-vendor block landed in spec PR per Rule 26 |
| **D15** | **CSV upload transport (formerly OD-1)** | design R1-6 | **`text/csv` raw body, filename via `?filename=...` query param, parser mirrors #262 import endpoint at `apps/api/src/routes/surveys.ts:915` (11 MB bodyLimit, in-memory `parseCsvRaw` + `runAdapter`).** Not multipart. |
| **D16** | **Brand-timezone library (formerly OD-2)** | design R1-3 / R1-7 / spike | **`date-fns-tz`** — wrappers at `packages/shared/src/datetime.ts`. Reversed from native Intl post-spike on merit (`feedback_merit_over_ease.md`). |
| **D17** | **NFR-SC1 rate-limit posture (formerly OD-3)** | design R1-8 | **In-handler Redis `INCR + EXPIRE`** in the `POST /v1/surveys/:id/distribution-batches` handler, with `QUEUE_MODE=inline` graceful-degradation (skip + structured-log warn). Adoption trigger for `@fastify/rate-limit` recorded on #218. |
| **D18** | **Erasure-job extension scope (formerly OD-4)** | design R1-10 / R1-5 | **Scoped out of #378.** #264 AC augmented via PR #385 comment with the `audienceSpec.identifiersResolved[].identifier → '[redacted]'` redaction contract. Schema shape-compatible. |
| **D19** | **Migration shape (formerly OD-5)** | design R1-11 | **Hand-written per architecture §3.4** + `20260430000000_patch_survey_distribution_gap` precedent. Single ordered DDL: ADD column → DROP old constraint → ADD new constraint. |

---

## Architecture Analysis (Phase 4 — architecture-gap-review)

Per validated pattern *"Three-bucket architecture-gap classification structures the gap-review"* (4 recurrences). Comparing this RFC's design against `docs/architecture/architecture.md` (603 lines, last touched 2026-04-21):

### Patterns Correctly Followed

These design elements map to documented architecture.md rows; no doc change needed.

| # | Pattern | architecture.md row | #378 application |
|---|---|---|---|
| 1 | Standard CRUD admin route | §3.1 — `/admin/{entity}`, `/admin/{entity}/[id]`, `/admin/{entity}/[id]/edit`; ADR 0001 | `/admin/surveys/[id]/distribute` + `/admin/surveys/[id]/distribute/batches/[batchId]` sub-routes |
| 2 | Single-page in-place transition (Configure → Success) | §3.1 — inline view/edit on `[id]` (Programs reference) | Distribute page transitions State 1 → State 2 on same route, no URL change |
| 3 | Multi-tenant scoping (two-track) | §3.2 — auth-plugin extracts `brandId`; `multiTenant` plugin rejects body `brandId`; tenantScope middleware auto-scopes 9 loyalty-side models | New models follow the **existing Survey-side convention** of explicit handler-level `where: { brandId: request.brandId }` (matches neighbors: `Survey`, `SurveyDistribution`, `SurveyResponse`, `SurveyRule`, `BrandTheme`, etc. — none of which use the middleware). `multiTenant` plugin's body-`brandId` rejection still applies. |
| 4 | Per-route audit-allowlist | §3.2 / §4.2 audit-plugin row | 5 new audit actions declared with `auditAllowlist` + `auditAction` + `auditResourceType` per-route config |
| 5 | Audit `requestIp` capture (trust-proxy-aware) | §4.2 — *"the plugin auto-enriches `metadata.requestIp` from `request.ip`"* | Token-respond audit row carries `requestIp` per NFR-S7 (handler sets `request.brandId` after token validates so the plugin fires — see "Public-route audit handling" note above) |
| 6 | Fire-and-forget audit on mutations (POST/PATCH/DELETE) | §4.2 audit row + §6 *Append-Only Audit Trail* | Generate / Regenerate / Edit-Expiry all audit via `onResponse` hook normally (authed admin routes have `brandId` from JWT). Token-respond also audits via the same hook, with the handler-level `request.brandId` assignment described above. |
| 7 | Hand-written Prisma migration with ADD/BACKFILL/DROP ordering | §3.4 — *"the canonical hand-edit ordering is ADD COLUMN → BACKFILL UPDATE → DROP COLUMN"* + `20260430000000_patch_survey_distribution_gap` precedent | Migration adds `batchId` column → drops old `(surveyId, memberId)` constraint → adds new `(batchId, memberId)` unique |
| 8 | Forward-only migrations; rollback via follow-up forward migration | §3.4 + project rule R22 | No `down` script; idempotent guards inline |
| 9 | Column-quoting / camelCase identifiers | project rule R22a + every existing migration in `packages/database/prisma/migrations/` | Every DDL identifier in §Migration is the camelCase quoted form Prisma emits |
| 10 | Hash-at-rest credential with plaintext-shown-once | §6 *Credential Encryption at Rest* + ApiKey precedent at `apps/api/src/plugins/auth.ts:69` | `SurveyDistributionToken.tokenHash` = SHA-256(plaintext); plaintext returned exactly once in `POST /distribution-batches` response body |
| 11 | Atomic write-pair via `prisma.$transaction()` | §6 *Transactional Integrity* (loyalty + redemption precedents) | Generate (batch + tokens + distribution rows); Edit-Expiry (batch + all child tokens); response submit (SurveyResponse + token `consumedAt`); Regenerate (replace all `tokenHash` for batch) |
| 12 | Queue-mode parity (`redis` vs `inline` outcomes identical) | §3.3 + §6 *Idempotency* | In-handler rate-limit (OD-3a) uses Redis when present, structured-log warning when `QUEUE_MODE=inline` — same shape as `apps/api/src/queues/bullmq.ts:52-69` |
| 13 | Public unauthenticated endpoint for respondent | §4.1 — `/v1/public/*` row, *"survey response submission (no auth)"* | `/v1/public/surveys/:id/respond` (additive `token` field) + `/v1/public/surveys/:id/token-status` |
| 14 | Standard pagination envelope on list endpoints | §4.1 — *"All list endpoints return a standard pagination envelope: `{ data, total, page, pageSize, totalPages }`"* | `GET /v1/surveys/:id/distribution-batches` follows the envelope; batch detail's token list also paginates |
| 15 | shadcn/ui + Tailwind v4 + Radix primitives | §2 tech-stack row | Configure / Success / Batch-detail / Filter-row components all reuse existing admin chrome |
| 16 | Zod-validated request bodies (strict mode) | §2 + §4.1 (`UpdateSurveySchema.strict()` precedent for #241) | All new admin endpoints validate body with `z.object(...).strict()`; preview / generate / regenerate / expiry-edit schemas above |
| 17 | State-aware admin entry-tile | §3.1 — state-aware editability + survey state machine | "Send via my email tool" tile disabled when `Survey.status !== 'ACTIVE'` with state-keyed tooltip |
| 18 | `text/csv` raw-body upload with per-route bodyLimit | §3.4 implied by #262 import precedent at `apps/api/src/routes/surveys.ts:915` (11 MB) | OD-1a: Distribute CSV upload mirrors exactly (`text/csv` body + `?filename=...` query param) |
| 19 | `resolveOrEnrollMember` consent-stamping for bulk channels | §6 *GDPR/CCPA by Default* + project rule R23 *Bulk import consent contract* | Custom List auto-enroll uses `enrolledVia='BULK_DISTRIBUTION'` and inherits the consent-stamp path; consistent with `BULK_IMPORT` precedent |
| 20 | Synchronous AI / synchronous response paths within Fastify request | §6 *Synchronous AI on note creation (exception to event-driven default)* | Generate / Regenerate / Edit-Expiry / token-respond are all synchronous within the request — no queue dependency on the hot path; event-driven loyalty pipeline (project rule R5) is unaffected because tokenized responses still emit the same `cx.<type>_response` event into the existing pipeline |

### Patterns Missing from Architecture

These shapes are introduced by #378 but not yet documented. Following Phase 4's rule *"No architecture updates yet"*, the doc rows below are **proposed**; the architecture.md edit lands in the address-feedback phase only after the reviewer confirms each addition is load-bearing enough to document.

| # | Proposed pattern | Status (Round 1 reviewer) | Suggested architecture.md location |
|---|---|---|---|
| M-1 | **Hash-at-rest tokenized public endpoint** — any unauthenticated public route that needs to identify a specific actor uses SHA-256(plaintext) hash-at-rest, DB-unique-index lookup, uniform error-response body across `valid`/`expired`/`responded`/`survey-not-open`/`invalid` to prevent token-existence-leak timing attacks, plaintext returned exactly once at provisioning time. | **✅ Agreed (R1-12)** — add during impl. | New §6 bullet *Hash-at-rest tokenized public endpoint* with cross-reference to ApiKey precedent (`apps/api/src/plugins/auth.ts:69`) + #378 implementation |
| M-2 | **Brand-timezone + locale display utility** — `formatInBrandTz(date, brandTimezone, brandLocale, formatString)` + `endOfDayInBrandTz(localDate, brandTimezone)` at `packages/shared/src/datetime.ts`. Implemented via `date-fns-tz` (locked D16). | **✅ Agreed (R1-13)** — add during impl. Implementation shape revised post-spike from native-Intl to `date-fns-tz`. | New §3.5 row under *Shared Layer* listing `packages/shared/src/datetime.ts` (using `date-fns-tz`) |
| M-3 | **In-handler rate-limit with queue-mode parity** — small Redis `INCR + EXPIRE` block in the request handler; fallback to structured-log warning when `QUEUE_MODE=inline` and Redis isn't available. | **✅ Implicitly agreed via OD-3a acceptance (R1-8)** — add during impl. | New §6 bullet *In-handler throttling with `QUEUE_MODE` parity* with cross-ref to #218 (plugin-based migration tracker) and the adoption-trigger criteria in #218's #378 comment |
| M-4 | **Re-download = regenerate semantics** — for one-time-secret transmissions that need operator-error recovery, the second-attempt action regenerates and invalidates the prior, rather than re-fetching. Strong-warning + confirmation-modal `confirmAcknowledge` body gate. | **✅ Agreed (R1-14)** — add during impl. Pairs with M-1. | New §6 bullet *One-time secret regeneration as the only re-fetch path*, paired with M-1 |
| M-5 | **Detail-page filter-row UX pattern** — between two existing sections (Loop Monitor and Response in this case), narrows the analytics section below while leaving the upstream section unchanged. | **⏸ DEFERRED (R1-15)** — *"Not yet. We will decide when second occurrence comes up."* The pattern ships as part of #378 R23; the architecture.md doc-row waits for a second feature that needs the same shape. | (no doc-row landing in this PR) |

### Patterns Incorrectly Followed

**None.** Two spec claims (extending an existing erasure job; extending an existing rate-limit plugin) were both reframed in this RFC after Phase 1's code audit surfaced that neither artifact exists today — the RFC scopes erasure out to #264 (OD-4a) and proposes in-handler rate-limit (OD-3a). Both are honest gap-acknowledgements per project rule R25c (the "remove" / "deferred" language re-litigation guard), not deviations from documented architecture.

### Phase 4 outcome

5 patterns to document in `architecture.md` (M-1 through M-5), proposed but not yet written per Phase 4's "no architecture updates yet" rule. Each will be surfaced as a confirm-or-reject question in the RFC PR body so the reviewer can lock the doc-update scope before any architecture.md edit is made. Architecture-doc edits ride with the impl-phase commits per project rule R26, not separate chore-issues.

---

## Phase progress

| Phase | Status |
|---|---|
| 1 — requirements-analysis | ✅ complete (`docs/evidence/378-technical-design-evidence.md`) |
| 2 — design-authoring | ✅ complete (RFC R0 → R1) |
| 3 — technical-spike | ✅ executed Round 1 — brand-TZ EOD spike (`docs/evidence/378-tz-spike/findings.md`); 15/15 pass; OD-2 reversed to 2b on merit |
| 4 — architecture-gap-review | ✅ complete (RFC §Architecture Analysis — M-1..M-4 confirmed, M-5 deferred) |
| 5 — design-completeness-review | ✅ complete (evidence doc §Traceability Matrix — 0 Unmet) |
| 6 — design-submission | ✅ commits on PR #385 (rebased onto main 2026-05-17 per Rule 26 — RFC + evidence + feedback file all on feature branch) |
| 7 — address-feedback | 🔄 Round 1 addressed (this commit); awaiting reviewer signoff on R1 resolutions + R2 if any |
| 8 — retrospective | ⏳ pending |
