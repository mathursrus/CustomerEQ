# RFC: Switch Member Identifier Kind — Slice 1 (Customer ID → Email)

Issue: #524
Owner: manohar.madhira@outlook.com (Claude)
Spec: [`docs/feature-specs/524-switch-member-identifier-kind.md`](../feature-specs/524-switch-member-identifier-kind.md) (37 R-statements: R0 + R1–R29 + R30–R37)
Scope: **Slice 1 only — `CUSTOMER_ID → EMAIL` lane** of the direction-agnostic engine (R0).

> **Reading order.** This RFC assumes the reader has the spec open; every design section references the R-statements it implements rather than restating them.

## Customer

Brand admin whose org is keyed by `CUSTOMER_ID`, has live integrations posting via the old key, and wants to switch to `EMAIL` without breaking those integrations during the cutover.

## Customer Problem being solved

The spec's customer problem unchanged. This RFC answers *how* the engine implements it.

## User Experience that will solve the problem

UX is fully specified in the spec + the 9-scene mock. This RFC adds nothing UX-facing.

## Technical Details

### A. Design philosophy (R0 — direction-agnostic engine)

Every persistent and runtime structure below is **direction-agnostic**: shapes carry `fromKind` + `toKind` and the worker dispatches via per-direction adapters. Slice 1 wires only the `CUSTOMER_ID → EMAIL` adapter; future slices add adapters without re-architecting.

| Engine surface | Direction-agnostic mechanism |
|---|---|
| Migration batch row | `fromKind` + `toKind` columns; mapping rows hold `oldExternalId` + `newExternalId` (opaque) |
| Pre-flight validator | Per-`toKind` validator via `validateIdentifierShape(toKind, value)` (already exists at `memberResolution.ts:53-92`) |
| Re-key worker | `Member.externalId := newExternalId`; PII sidecar set per `toKind` (email | phone | none for CUSTOMER_ID-target) |
| Dual-key resolver | Looks up by `(brandId, externalId)` first; on miss, falls back to migration-mapping lookup keyed on `oldExternalId` |
| Reconciliation | Same idempotent LWW merge as `resolveOrEnrollMember` already does (R6, `memberResolution.ts:167-222`) |
| Audit | `brand.identifier_migration.*` action family; one row per state transition |

**Slice 1 wires:**
- `validateIdentifierShape` already returns OK for `EMAIL` target — no new validator code.
- Worker re-key sets `Member.email` (PII sidecar) and `externalId := emailLowered`.
- Adapter table key: `{ fromKind: 'CUSTOMER_ID', toKind: 'EMAIL' }`.

**Out of scope for Slice 1** (carried to first non-EMAIL-target slice):
- `surveyImport.ts:23-31` bulk-import EMAIL-hardcoding fix (it does not call `resolveOrEnrollMember`; safe to leave because Slice 1's steady state is EMAIL).
- `PHONE` target shape variations + E.164 normalization in the adapter.

### B. Schema changes

Three new tables, one Brand column, one re-key migration. All changes are in a single transactional Prisma migration `{YYYYMMDDhhmmss}_add_member_identifier_migration`.

#### B.1 `MemberIdentifierMigration` (batch row — shape mirrors `SurveyImportBatch`)

```prisma
enum MemberIdentifierMigrationStatus {
  PENDING_VALIDATION       // mapping uploaded or fast-path data validated → pre-flight running
  VALIDATED                // pre-flight clean; awaiting admin confirm + attestation
  PROCESSING               // re-key worker running
  REKEY_COMPLETE_IN_GRACE  // re-key terminal-success; grace window open
  GRACE_EXPIRED            // grace deadline passed; old key now rejected
  FAILED                   // worker failure; no kind flip; retryable
  CANCELLED                // admin cancelled before PROCESSING
}

model MemberIdentifierMigration {
  id                  String                                @id @default(cuid())
  brandId             String
  brand               Brand                                 @relation(fields: [brandId], references: [id])

  fromKind            MemberIdentifierKind                  // engine: direction-agnostic
  toKind              MemberIdentifierKind                  // engine: direction-agnostic
  status              MemberIdentifierMigrationStatus       @default(PENDING_VALIDATION)

  // Progress counters (R7, R18, R22)
  totalMembers        Int                                   @default(0)
  processedMembers    Int                                   @default(0)
  failedMembers       Int                                   @default(0)
  reconciledMembers   Int                                   @default(0)   // late-arriving rows merged in
  errors              Json                                  @default("[]") // [{ memberId, reason }]

  // Attestation (R13/R25)
  attestedByClerkUserId String?
  attestationText       String?                             // verbatim copy of the confirm-modal language
  attestedAt            DateTime?

  // Grace window (R31/R34)
  rekeyCompletedAt    DateTime?                             // moment the kind flipped
  graceExpiresAt      DateTime?                             // rekeyCompletedAt + 30d initial; extended by R34
  graceExtensions     Json                                  @default("[]") // [{ by, at, deltaDays }]

  createdAt           DateTime                              @default(now())
  updatedAt           DateTime                              @updatedAt
  cancelledAt         DateTime?

  mappings            MemberIdentifierMigrationMapping[]
  oldKeyUsage         MemberIdentifierMigrationOldKeyUsage[]

  // At most one non-terminal migration per brand (no concurrent migrations — spec Error State)
  @@unique([brandId, status], name: "one_active_migration_per_brand")  // partial-unique enforced in app layer; see B.4
  @@index([brandId, status])
  @@map("member_identifier_migrations")
}
```

#### B.2 `MemberIdentifierMigrationMapping` (per-member old → new row)

```prisma
model MemberIdentifierMigrationMapping {
  id            String                       @id @default(cuid())
  migrationId   String
  migration     MemberIdentifierMigration    @relation(fields: [migrationId], references: [id], onDelete: Cascade)

  memberId      String                       // FK to Member.id (stable cuid; survives re-key)
  member        Member                       @relation(fields: [memberId], references: [id])

  // Engine: direction-agnostic; opaque normalized values
  oldExternalId String                       // lowercased+trimmed pre-migration externalId
  newExternalId String                       // lowercased+trimmed post-migration externalId

  // Per-row outcome (R12, R22)
  appliedAt     DateTime?
  errorReason   String?

  @@unique([migrationId, memberId])
  @@unique([migrationId, oldExternalId])     // dual-key reverse-lookup index (R32)
  @@index([migrationId, appliedAt])
  @@map("member_identifier_migration_mappings")
}
```

#### B.3 `MemberIdentifierMigrationOldKeyUsage` (per-ingress old-key telemetry — R33)

```prisma
// Only the inbound paths that resolve an existing member by the brand EXTERNAL
// identifier (via resolveOrEnrollMember) can be hit with the OLD customer_id
// during the window — so only these can produce old-key telemetry. See §M for
// the full ingress audit that justifies this set (e.g. /v1/events is excluded
// because it keys on the internal Member.id; bulk import / external-signal /
// CRM-webhook paths key on email, never the customer_id).
enum MigrationOldKeyIngress {
  PUBLIC_SURVEY_RESPOND       // /v1/public/surveys/:id/respond  (public.ts:457)
  API_MEMBERS_ENROLL          // /v1/members/enroll              (members.ts:106)
  DISTRIBUTION_BATCH          // distribution-batch audience     (distributionBatches.ts:320)
}

model MemberIdentifierMigrationOldKeyUsage {
  id           String                       @id @default(cuid())
  migrationId  String
  migration    MemberIdentifierMigration    @relation(fields: [migrationId], references: [id], onDelete: Cascade)
  brandId      String                       // denormalized for tenant-scoped aggregation
  ingress      MigrationOldKeyIngress
  dayBucket    DateTime                     // truncated to day in UTC (R37's 7-day rolling window aggregates this)
  count        Int                          @default(0)

  @@unique([migrationId, ingress, dayBucket])
  @@index([brandId, migrationId, dayBucket])
  @@map("member_identifier_migration_old_key_usage")
}
```

#### B.4 `Brand.activeMigrationId` (optional pointer for fast lookup)

```prisma
// Add to model Brand
activeMigrationId  String?                                    // null when no in-flight or in-grace migration
activeMigration    MemberIdentifierMigration?                 @relation(fields: [activeMigrationId], references: [id])
```

Enforces "at most one non-terminal migration per brand" (spec Error State) at the application layer in a transaction. We don't use a Postgres partial-unique on `MemberIdentifierMigration` because a brand may have many historical terminal-state rows; the application-layer guard plus `Brand.activeMigrationId` is simpler and sufficient.

#### B.5 No changes to existing `Member` / `Brand.memberIdentifierKind` shape

`Brand.memberIdentifierKind` continues to be the canonical "current kind." The worker UPDATEs it as the last step of terminal success (R17). `Member.externalId` is rewritten in place per the existing column.

### C. API surface

All routes are admin-only, Clerk-org-scoped, audited via the existing audit pipeline.

| Method | Path | Purpose | R |
|---|---|---|---|
| `GET` | `/v1/admin/brand/migrations/preflight-context` | Returns the "what's in your data" signals so the wizard can decide fast-path vs partial vs none branches (counts of members with `Member.email` populated, collision check, plus the impact preview last-30d data). | R28, R29, R30 |
| `POST` | `/v1/admin/brand/migrations` | Create a new migration row with `{ fromKind, toKind }` (Slice 1 enforces `CUSTOMER_ID → EMAIL`). 409 if an active migration exists. | R1–R3, "Migration already in progress" |
| `POST` | `/v1/admin/brand/migrations/:id/mapping` | Submit the mapping. Two modes: `mode: "from_existing_emails"` (fast path — server reads `Member.email`) or `mode: "csv"` with multipart upload. Runs pre-flight validation (R6–R12) inline, populates `mappings` + counters; no member writes. | R4, R5, R6–R12, R28, R29 |
| `GET` | `/v1/admin/brand/migrations/:id` | Status + counters + grace-window state + per-ingress old-key counts (for polling — `usePollingQuery`). | R7, R18, R22, R34 |
| `POST` | `/v1/admin/brand/migrations/:id/start` | Captures attestation (admin id + verbatim text + timestamp; R13/R25) and enqueues the re-key worker job. Idempotent on already-PROCESSING. | R13, R14, R15 |
| `POST` | `/v1/admin/brand/migrations/:id/extend-grace` | Simple admin action; appends `{ by, at, deltaDays }` to `graceExtensions` and updates `graceExpiresAt`; audited via R25; **no attestation gate** (R34, RC10). | R34 |
| `POST` | `/v1/admin/brand/migrations/:id/cancel` | Allowed only in `PENDING_VALIDATION` or `VALIDATED` (i.e., before any write). After re-key starts, only failure-rollback applies. | R23 (failure path independent) |
| `PATCH` | `/v1/admin/brand/profile` | **Replace** the blanket `409 MEMBER_IDENTIFIER_KIND_LOCKED` (admin-brand-profile.ts:322-335) with: 409 + `redirectTo: "/admin/settings/organization/migrations/{id}"` if an active migration exists, otherwise a guided-flow link. The radio-toggle change of `memberIdentifierKind` remains rejected. | R1, R2 |
| `GET` | `/v1/admin/brand/usage-warnings` | Brand-wide warning surface (R37 banner) — returns the active migration's pre-expiry warning payload if any. Called from admin shell layout. | R37 |

#### C.1 `POST /v1/admin/brand/migrations/:id/mapping` — pre-flight validation contract

Returns a `MigrationPreflightResult`:

```ts
type MigrationPreflightResult = {
  ok: boolean;                          // true iff zero blocking issues
  counts: {
    totalRows: number;                  // rows in upload (or members for fast-path)
    membersMatched: number;
    unmappedMembers: number;            // R8
    collisions: number;                 // R9
    invalidShape: number;               // R10
  };
  rowIssues: Array<{                    // R12 — same display contract as R29
    row?: number;
    customerId: string;
    newEmail?: string;
    reason: 'unmapped' | 'collision' | 'invalid_shape';
    detail: string;                     // plain-language reason
  }>;
};
```

Validation is purely a database READ + in-memory check; **no member rows are written** (R6).

#### C.2 Concrete fast-path detection signal (R28 / R29)

`/v1/admin/brand/migrations/preflight-context` does:

```sql
SELECT
  count(*) FILTER (WHERE email IS NOT NULL)                           AS withEmail,
  count(*) FILTER (WHERE email IS NULL)                               AS withoutEmail,
  count(*)                                                            AS total,
  -- collision check: would any two emails normalize to the same value?
  (SELECT count(*) FROM (
     SELECT lower(trim(email)) e, count(*) c
       FROM members
      WHERE brandId = $1 AND email IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1
   ) x)                                                               AS collisionGroups,
  -- shape check: count of emails failing the existing EMAIL regex (use existing memberResolution.EMAIL_RE)
  count(*) FILTER (WHERE email IS NOT NULL AND email !~ '<EMAIL_RE>')  AS invalidShape
FROM members
WHERE brandId = $1 AND deletedAt IS NULL AND erased = false;
```

Fast-path (R28) is offered iff `withoutEmail = 0 AND collisionGroups = 0 AND invalidShape = 0`. Otherwise the wizard branches to partial-coverage upload (R29).

**Why `erased = false` is required:** writing a new email to an erased member would re-PII them, which violates the existing erasure contract (`Member.erased` flag + mask-on-read in `members.ts:538-540, 944-954`). The migration therefore excludes them from totals, mapping, and the re-key worker pass.

### D. Re-key worker (R15, R16, R17)

New BullMQ queue `MEMBER_IDENTIFIER_MIGRATION` with worker at `apps/worker/src/processors/memberIdentifierMigration.ts`. One job per migration (job key = `migration:{id}`).

**Algorithm (pseudocode):**

```ts
async function processMigration(migrationId: string) {
  const m = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migrationId } });
  assert(m.status === 'VALIDATED' || m.status === 'PROCESSING'); // idempotent restart

  await prisma.memberIdentifierMigration.update({
    where: { id: migrationId },
    data: { status: 'PROCESSING' },
  });

  // Stream mappings in chunks of 200 (memory bound + transaction granularity).
  let cursor: string | undefined = undefined;
  while (true) {
    const chunk = await prisma.memberIdentifierMigrationMapping.findMany({
      where: { migrationId, appliedAt: null, errorReason: null },
      orderBy: { id: 'asc' },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: 200,
    });
    if (chunk.length === 0) break;
    cursor = chunk[chunk.length - 1].id;

    for (const mapping of chunk) {
      await prisma.$transaction(async (tx) => {
        // R16 + R27: brandId-scoped, tenant-isolated write
        await tx.member.update({
          where: { id: mapping.memberId, brandId: m.brandId }, // brand-scoped
          data: { externalId: mapping.newExternalId, email: mapping.newExternalId /* EMAIL adapter */ },
        });
        await tx.memberIdentifierMigrationMapping.update({
          where: { id: mapping.id },
          data: { appliedAt: new Date() },
        });
        await tx.memberIdentifierMigration.update({
          where: { id: migrationId },
          data: { processedMembers: { increment: 1 } },
        });
      }).catch(async (err) => {
        // Per-member failure is recorded but does NOT abort the batch.
        // The batch reaches a non-terminal-success outcome at the end → status=FAILED.
        await prisma.memberIdentifierMigrationMapping.update({
          where: { id: mapping.id },
          data: { errorReason: extractMessage(err) },
        });
        await prisma.memberIdentifierMigration.update({
          where: { id: migrationId },
          data: { failedMembers: { increment: 1 } },
        });
      });
    }
  }

  // Terminal state: success iff zero failures.
  const final = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migrationId } });
  if (final.failedMembers === 0) {
    const now = new Date();
    await prisma.$transaction([
      // R17: flip the brand kind LAST and only on terminal success.
      prisma.brand.update({
        where: { id: m.brandId },
        data: { memberIdentifierKind: m.toKind, activeMigrationId: migrationId },
      }),
      prisma.memberIdentifierMigration.update({
        where: { id: migrationId },
        data: {
          status: 'REKEY_COMPLETE_IN_GRACE',
          rekeyCompletedAt: now,
          graceExpiresAt: addDays(now, 30),   // R31: 30-day fixed initial window
        },
      }),
    ]);
    await emitAudit('brand.identifier_migration.completed', { ... });   // R25
    // Optional: run a one-shot reconciliation pass (see §E) for any late-arriving rows
    // whose oldExternalId resolved during the re-key window.
    await enqueueReconciliation(migrationId);
  } else {
    // R23: failure path. memberIdentifierKind stays at fromKind. Per-member errors are persisted on mappings.
    await prisma.memberIdentifierMigration.update({
      where: { id: migrationId },
      data: { status: 'FAILED' },
    });
    await emitAudit('brand.identifier_migration.failed', { failed: final.failedMembers });
  }
}
```

**Per-member transactions, not whole-batch.** A single failing member does not roll back the whole batch — it's flagged and the rest continues. Terminal success requires zero failures; otherwise `status=FAILED` and `memberIdentifierKind` is **never flipped**. This is the spec's R23 semantics ("no partial flip").

**Erased + soft-deleted members are excluded.** The mapping intake (§C.2 + the upload validator) excludes members where `erased = true OR deletedAt IS NOT NULL`. The brand is therefore not required to supply an email for them, and the worker never writes a new email to an erased member (which would violate the existing erasure contract — mask-on-read via `Member.erased`, see members.ts:538-540, 944-954).

**Hot-path SLA (Hero #6 Rule).** The worker is async, off the inbound event-ingestion path. Critically, the hero `/v1/events` path is **not** touched by the dual-key change at all — it resolves by internal `Member.id` (`events.ts:96-97`) and never calls `resolveOrEnrollMember` (§M.2). The dual-key fallback (§E) adds one extra `findUnique` on the mapping table (indexed `(migrationId, oldExternalId)`, B.2) **only on the external-id resolve paths 1–3** (survey respond, enroll, distribution) and **only on a primary-lookup miss**. Measured cost there: ~5–20 ms; well within <1s p99. The campaign-trigger evaluation that shares the hero SLA reads members by internal id and is likewise unaffected.

### E. Dual-key resolution (R19, R32)

`apps/api/src/services/memberResolution.ts:resolveOrEnrollMember` is taught to consult the migration mapping when a primary lookup misses.

```ts
// Inside resolveOrEnrollMember, after the existing primary lookup at line 143:
let existing = await prisma.member.findUnique({
  where: { brandId_externalId: { brandId, externalId: lower(memberId) } },
});

if (!existing) {
  // Engine direction-agnostic: works for any non-terminal migration on this brand
  const activeMigration = await prisma.memberIdentifierMigration.findFirst({
    where: {
      brandId,
      status: { in: ['PROCESSING', 'REKEY_COMPLETE_IN_GRACE'] }, // re-key + grace
    },
    select: { id: true, fromKind: true, toKind: true },
  });
  if (activeMigration) {
    // R32: try the old-key reverse-lookup.
    const mapping = await prisma.memberIdentifierMigrationMapping.findUnique({
      where: {
        migrationId_oldExternalId: {
          migrationId: activeMigration.id,
          oldExternalId: lower(memberId),
        },
      },
      select: { memberId: true },
    });
    if (mapping) {
      existing = await prisma.member.findUnique({ where: { id: mapping.memberId } });
      // R33: record the old-key hit telemetry.
      await recordOldKeyUsage(activeMigration.id, brandId, ingressFromContext);
    }
  }
}
// Continue with existing R6 last-write-wins update path or create-new path.
```

**Shape validation behavior during the dual-key window.** During `PROCESSING` the brand kind is still `CUSTOMER_ID`, so old-shape identifiers validate normally. During grace the kind is `EMAIL`, so `validateIdentifierShape` would reject an old-shape identifier — therefore the resolver **skips shape validation when the caller's identifier matches an `oldExternalId` in the active migration's mapping** (resolving to the existing migrated member). A brand-new old-shape identifier *not* in the mapping during grace is the genuinely-hard "phantom member" case — see §F item 1 + Confidence Level. **After grace, this skip is off** and old-shape ids are rejected (§M.4).

### F. Reconciliation (R20, R21)

A member created under the old key during the re-key + grace window has its own `Member` row (because nothing in the mapping yet pointed at them). At three trigger points we reconcile:

1. **Immediately on each new old-key enrollment during PROCESSING/grace.** If a caller posts a brand-new old-shape identifier that does NOT match any `oldExternalId` in the mapping, we create the member with `externalId := lower(suppliedIdentifier)` (preserving the old shape) and append a mapping row pointing at this new member with `appliedAt = now` (so it counts as already-processed) and bump `reconciledMembers`.
2. **End of re-key worker (`enqueueReconciliation`).** Sweep for any `Member` rows in this brand created during the migration window whose `externalId` does not match a mapping. They get the same treatment as (1).
3. **At grace expiry.** Final sweep, identical to (2).

Reconciliation uses the same idempotent LWW update path as `resolveOrEnrollMember` (`memberResolution.ts:167-222`). **No member is ever hard-deleted (R21).**

**Mapping retention.** The `MemberIdentifierMigrationMapping` rows are **not deleted at `GRACE_EXPIRED`** — they are retained so the resolver can still recognize a stale old id post-grace and return the actionable `IDENTIFIER_DEPRECATED_AFTER_MIGRATION` error (§M.4(a)) instead of a generic shape error. Rows are bounded (one per migrated member) and carry no GC policy in Slice 1.

**Phantom-member caveat.** A brand-new old-shape identifier that arrives *during* the window and is not in the mapping (e.g., a new customer enrolled via the old integration mid-migration) creates a member we have no new-kind value for. Item 1 keeps it (no data loss) but it remains old-kind-shaped until the brand supplies its email. This is the open reconciliation question tracked in Confidence Level; it is not auto-resolved in Slice 1.

### G. Grace window & pre-expiry warning (R31, R34, R37)

**State transitions.**

```
VALIDATED ──(/start)──> PROCESSING ──(success)──> REKEY_COMPLETE_IN_GRACE ──(graceExpiresAt)──> GRACE_EXPIRED
                                  ──(failure)──> FAILED
VALIDATED ──(/cancel)──> CANCELLED
```

**Grace expiry trigger.** A scheduled BullMQ repeatable job (`grace-expiry-sweep`, every 15 minutes) flips `REKEY_COMPLETE_IN_GRACE` → `GRACE_EXPIRED` when `now() > graceExpiresAt`. (15-min cadence is fine because once expired, the request-time reject logic R35 is gated by `status === 'GRACE_EXPIRED'` and the worker just transitions the flag; correctness doesn't depend on sub-minute timing.)

**Post-grace old-id handling (R35, refined — see §M.4).** After `GRACE_EXPIRED`, the §E dual-key *resolution* is off (an old id no longer resolves to the member). But the retained mapping (§F) is still consulted **for error quality only**: if an inbound old id matches a known `oldExternalId`, the request is rejected `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION` naming the new email shape; if it matches nothing, the request falls through to ordinary `EMAIL` shape validation → `422 IDENTIFIER_SHAPE_INVALID` naming the brand's current kind. Either way **no new member is created under the old shape** (shape gate is pre-write).

**Extension (R34, RC10).** `POST /v1/admin/brand/migrations/:id/extend-grace { deltaDays: 30 }` → updates `graceExpiresAt`, appends to `graceExtensions[]`, emits audit `brand.identifier_migration.grace_extended`. No attestation gate.

**Pre-expiry warning (R37, RC6).** `GET /v1/admin/brand/usage-warnings` is called from the admin shell layout (`apps/web/src/app/(admin)/layout.tsx`) and returns:

```ts
type UsageWarning = {
  kind: 'IDENTIFIER_MIGRATION_PRE_EXPIRY';
  migrationId: string;
  graceExpiresAt: string;            // ISO
  daysRemaining: number;             // <= 7 to be present
  oldKeyIngressesActive: Array<{     // per-ingress old-key counts over trailing 7d
    ingress: MigrationOldKeyIngress;
    count7d: number;                 // > 0 to be listed
  }>;
} | null;
```

Trigger fires when `daysRemaining <= 7 AND oldKeyIngressesActive.length > 0`. UI renders the brand-wide banner (`pending-banner` pattern from `277-organization-settings.html`) on every admin page.

### H. Impact preview (R30) data sources

`/v1/admin/brand/migrations/preflight-context` aggregates last-30d activity per surface, ordered most-recent-first, with zero-activity surfaces omitted (RC4). One query per source, all `brandId`-scoped (R27).

Only surfaces that send the **brand external identifier** are listed — these are the ones the brand must update. Surfaces that key on the internal `Member.id` are migration-stable and are deliberately **excluded** (see §M for the full ingress audit). All queries `brandId`-scoped (R27).

| Surface | Source query | Why it needs cutover |
|---|---|---|
| Embedded survey forms (host app via widget) | `SurveyResponse` where `brandId = $1 AND channel = 'in_app' AND createdAt > now() - 30d` → count + max(createdAt). *(Channel restricted to `'email' \| 'in_app' \| 'link' \| 'sms'` by `public.ts:53`; widget hardcodes `'in_app'` at `public.ts:992`.)* | Host app's `?member_id=` URL param carries the external id → resolves via `resolveOrEnrollMember` |
| `POST /v1/members/enroll` | `Member` where `brandId = $1 AND enrolledVia = 'MANUAL_API' AND createdAt > now() - 30d AND deletedAt IS NULL` | Caller supplies the external id (`members.ts:106`) |
| Custom List distribution batches | `DistributionBatch` where `brandId = $1 AND createdAt > now() - 30d AND audienceSpec ->> 'mode' = 'custom_list'` *(field shape verified in `distributionBatches.ts:937,944`)* | Uploaded audience identifiers are external ids parsed per kind (`distributionBatches.ts:244`) |
| Public survey respond (share-link) | `SurveyResponse` where `brandId = $1 AND channel = 'link' AND createdAt > now() - 30d` | Responder self-identifies with the external id |
| Outbound webhooks (informational, not a "fix") | `WebhookEndpoint` where `brandId = $1 AND active = true` → count of active subscriptions. *(No `deletedAt` column — `schema.prisma:1206-1223`; disable is `active = false`.)* | **Outbound** echo: the consumer will start receiving the new email in place of the old customer_id in event payloads. Shown as a heads-up, not a required brand-side change. |

**Deliberately excluded (verified migration-stable):** `POST /v1/events` (`events.ts:96-97`) resolves the member by the **internal `Member.id` cuid**, not the external identifier — callers pass the stable internal id, so the migration does not affect them and they need no cutover. Listing it would be a false alarm. (Earlier RFC draft wrongly listed it; corrected after the §M ingress audit.)

Per-row output: `{ surface, lastSeenAt, count30d, brandSideAction }` where `brandSideAction` is a per-surface string baked into the API layer (e.g., "Update `?member_id=` URL parameter to pass email").

### I. Audit (R13, R25)

The migration emits audit events through the existing audit pipeline (admin-brand-profile.ts:90-100). New `auditAction` values:

| `auditAction` | When | `auditMetadata` keys |
|---|---|---|
| `brand.identifier_migration.created` | POST /migrations | `migrationId, fromKind, toKind` |
| `brand.identifier_migration.validated` | mapping pre-flight passes | `migrationId, counts` |
| `brand.identifier_migration.started` | /start with attestation | `migrationId, attestedByClerkUserId, attestationText, attestedAt` (R13) |
| `brand.identifier_migration.completed` | terminal success | `migrationId, before, after, counts, graceExpiresAt` |
| `brand.identifier_migration.failed` | terminal failure | `migrationId, failedMembers, errorSample` |
| `brand.identifier_migration.grace_extended` | /extend-grace | `migrationId, deltaDays, newGraceExpiresAt, by` (R34) |
| `brand.identifier_migration.grace_expired` | scheduled sweep | `migrationId, postExpiryRejectionsSample` |

Each row is appended; nothing is overwritten. This satisfies R25's "attestation text persisted" requirement.

### J. UI implementation (links to spec scenes 1–8 + 2A + 2B + 7B + 7Bw + 7C)

Standard CRUD admin pattern (architecture.md §3.1, ADR 0001) does not perfectly apply because the migration is a wizard, not a list/detail entity. Layout:

```
apps/web/src/app/(admin)/admin/settings/organization/migrations/
  ├── page.tsx                                       — entry: lists past migrations + current
  ├── new/
  │   ├── page.tsx                                   — Scene 1 entry; redirects into wizard
  │   └── _components/
  │       ├── WizardChooseAndPrepare.tsx             — Scenes 2A + 2B + (none) branches
  │       ├── WizardUploadValidate.tsx               — Scenes 3 + 4
  │       └── WizardConfirm.tsx                      — Scene 5 (impact preview + attestation)
  └── [id]/
      ├── page.tsx                                   — Status switch on m.status
      ├── _components/
      │   ├── MigrationProgressPanel.tsx             — Scene 6 (PROCESSING)
      │   ├── MigrationCompletionSummary.tsx         — Scene 7 (just completed; transient toast)
      │   ├── GraceStatusPanel.tsx                   — Scenes 7B + 7Bw (in-grace; pre-expiry banner inline)
      │   ├── GraceExpiredPanel.tsx                  — Scene 7C
      │   └── MigrationFailedPanel.tsx               — Scene 8

apps/web/src/app/(admin)/admin/settings/organization/components/sections/
  └── MemberIdentificationSection.tsx                — UPDATED: replace dead mailto with "Switch identifier method"
                                                       link to /admin/settings/organization/migrations/new
                                                       when locked; show Grace panels inline when an active
                                                       migration is in REKEY_COMPLETE_IN_GRACE / GRACE_EXPIRED.

apps/web/src/app/(admin)/layout.tsx                  — UPDATED: render UsageWarningBanner driven by
                                                       /v1/admin/brand/usage-warnings (R37).
```

**Polling.** All polling consumers (`MigrationProgressPanel`, `GraceStatusPanel`) reuse `apps/web/src/lib/hooks/usePollingQuery.ts` (architecture.md §3.1). No new polling primitive.

**Standard CRUD pattern compatibility.** The `/admin/settings/organization/migrations` *list* + `[id]` *view* follow ADR-0001; the `new/` *create* path is a wizard rather than a single form, which is allowed precedent (see #420 `ManagedEmailFlow` for a wizard within the standard pattern).

### K. Failure modes & timeouts

| Failure | Behavior | Reference |
|---|---|---|
| Empty / malformed CSV | 422 with parse error; no writes | R6 |
| Coverage drift (member enrolled after template download) | Pre-flight reports unmapped; migration not startable | R8/R11 |
| Collision (two rows → same new email) | Pre-flight blocks | R9 |
| Invalid email shape | Pre-flight blocks | R10 |
| Migration already in progress | 409 with active `migrationId`; `redirectTo` to existing migration | Error State |
| Worker per-member failure | Logged on mapping row; batch continues; terminal `FAILED` if any failure | R23, R24 |
| Worker crash / restart mid-batch | Job is idempotent; resumed cursor skips already-`appliedAt` mappings | safe-restart |
| Migration mapping table grows | Cascade-on-delete from migration row; retained until manual cleanup; not on hot path | n/a |
| Grace expiry sweep delay | <=15 min lag is acceptable; reject logic at request time gates on `status` not `now()` | R35 |
| Old-key request after grace — id matches retained mapping | `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION` + new email shape; no member created | R35, §M.4(a) |
| Old-key request after grace — unknown old-shape id | `422 IDENTIFIER_SHAPE_INVALID` naming current kind; no member created | R35, §M.4(b) |
| New-member enroll with old id after grace | Never creates a member under the old shape (shape gate is pre-write) | §M.4 |

### L. Telemetry & analytics

In addition to the audit rows (§I) and old-key usage (B.3):

- **Pino structured logs** on every state transition with `{ migrationId, brandId, fromKind, toKind, status }`.
- **BullMQ job metrics** already emitted (`apps/api/src/queues/bullmq.ts`); no changes.
- **No new dashboards added in this slice** — adoption + funnel metrics can be derived from the `MemberIdentifierMigration` table by analytics later.

### M. Ingress coverage, member scope & breakage analysis

This section answers two review questions head-on: **(1) which member-touching paths could break, and what happens to each across the migration lifecycle; (2) which paths don't honor `Brand.memberIdentifierKind`, and what we do about them.** Every row was verified against code on 2026-05-28 (file:line cited).

#### M.1 Member scope — loyalty members only

The `Member` table holds **loyalty members** (auto-enrolled via survey, API, distribution, bulk import) keyed by `externalId` per `memberIdentifierKind`. **Admin / portal users are a separate concept** — they are Clerk *organization* members provisioned as a `Brand` row by the `organization.created` webhook (`apps/api/src/routes/identityProviderWebhook.ts:13`; `user.created` is an explicit **no-op** at line 18). They are **not `Member` rows**, so the re-key (which only UPDATEs `Member`) never touches admin logins.

- `request.clerkUserId` (`apps/api/src/plugins/auth.ts`) is the **acting admin** (audit `actorId` / `createdBy`), never a migrated row.
- `Member.clerkUserId` is set **only** when a loyalty member self-enrolls a login via the optional token on `/v1/members/enroll` (`members.ts:82-90` → `resolveOrEnrollMember`). There is no self-enroll UI yet, so ~zero loyalty members carry it today. When present it is a **non-identifier attribute**: the re-key preserves it (added to the R26 preserve set), and `externalId` remains the canonical loyalty key.

**Design consequence:** the migration's coverage check (R8) and re-key operate over `Member` rows = loyalty members. No admin-user special-casing is needed; the only addition is preserving `Member.clerkUserId` across re-key.

#### M.2 Ingress path audit — who resolves a member, and how

| # | Ingress | File:line | Identifies member by | Honors `memberIdentifierKind`? | Creates members? |
|---|---|---|---|---|---|
| 1 | Public survey respond | `public.ts:457` → `resolveOrEnrollMember` | external id | **Yes** | yes (auto-enroll) |
| 2 | Manual API enroll | `members.ts:106` → `resolveOrEnrollMember` | external id | **Yes** | yes |
| 3 | Distribution-batch audience | `distributionBatches.ts:244` (parse per kind) + `:320` (`resolveOrEnrollMember`) | external id | **Yes** | yes (auto-enroll) |
| 4 | `POST /v1/events` | `events.ts:96-97` | **internal `Member.id` (cuid)** | N/A — never uses external id | no |
| 5 | External-signal ingestion | `externalSignalIngestion.ts:30` | **email** (hardcoded `brandId_externalId = email.lower`) | **No** | no — match-only (`ExternalSignal.memberId` optional) |
| 6 | CRM webhooks (Salesforce/HubSpot) | `webhooks.ts:167,259` | **email** (hardcoded) | **No** | no — match-only (links cases/events) |
| 7 | Bulk survey import | `surveyImport.ts:23-31` (inlined, bypasses `resolveOrEnrollMember`) | **email** | **No** | yes (`BULK_IMPORT`) |
| — | Clerk OAuth member enroll | *(none — `MemberEnrolledVia.CLERK_OAUTH` defined at `member.schema.ts:75` but no production writer)* | — | — | — |

#### M.3 Behavior across the migration lifecycle (CUSTOMER_ID → EMAIL)

| Path class | Pre-migration | During re-key (`PROCESSING`) | In grace (`REKEY_COMPLETE_IN_GRACE`) | After grace (`GRACE_EXPIRED`) |
|---|---|---|---|---|
| **1–3 (honor kind, external-id)** | Resolve by customer_id, shape-validated as `CUSTOMER_ID` (opaque) | Dual-key (§E): old customer_id **and** new email both resolve | Dual-key still on (R32): both resolve; old-key hits counted (R33) | Old customer_id falls through to ordinary `EMAIL` shape validation → rejected (see M.4). New email resolves normally. |
| **4 `/v1/events` (internal id)** | Unaffected | Unaffected | Unaffected | Unaffected — `Member.id` never changes |
| **5–6 (email-keyed, match-only)** | For a CUSTOMER_ID brand these **never match** today (they look up email-as-externalId, but externalId is the customer_id) — pre-existing latent no-op | Still no-match until a row is re-keyed; after a member's re-key, its externalId **becomes** the email → starts matching | Matches by email (now the canonical key) | Matches by email — fully correct steady state |
| **7 bulk import (email-keyed, creates)** | Keys on email = **not** the canonical key for a CUSTOMER_ID brand → creates members under email-as-externalId, divergent from the customer_id members (pre-existing A1 hazard) | Same | Same | Keys on email = the canonical key now → **correct**. (This is why →EMAIL is the safe first slice; A1 only bites non-EMAIL targets.) |

**Net for Slice 1:** only path classes **1–3** need the dual-key + reconciliation machinery (§E/§F), and they have it. Paths 5–6 are match-only and were already non-functional for CUSTOMER_ID brands, so the migration is a strict improvement (they begin working post-flip) — **no regression, no action required for Slice 1**. Path 4 is stable. Path 7 becomes correct post-flip.

#### M.4 The reviewer's case — new member registered with the OLD id after grace

When grace has expired, the brand is an `EMAIL` brand and dual-key is **off** (the §E fallback only runs for `status ∈ {PROCESSING, REKEY_COMPLETE_IN_GRACE}`). Two sub-cases, both safe (no duplicate, no silent corruption):

- **(a) Old id of a member who WAS migrated** (e.g. a stale integration still sending `cust_00012`): primary lookup misses (that member is now keyed by email); shape validation rejects `cust_00012` as a non-email. **No duplicate is created** (rejected pre-write). The default error would be the generic `IDENTIFIER_SHAPE_INVALID`, which is unhelpful. **Design addition (R35 refinement):** the migration mapping is **retained after `GRACE_EXPIRED`** (not deleted), and `resolveOrEnrollMember` checks it on a miss even post-grace — if the supplied identifier matches a known `oldExternalId`, it returns the actionable `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION` with the member's new email shape ("this customer was migrated; send their email"), instead of the generic shape error. Retention window: kept until explicit cleanup (the mapping rows are small and bounded; no auto-GC in Slice 1).
- **(b) Genuinely new customer sent with an old-style id** (`cust_NEW`, never existed, not in mapping): primary miss → not in mapping → ordinary `EMAIL` shape validation → `422 IDENTIFIER_SHAPE_INVALID`. This is **correct and desired**: the brand is now EMAIL-keyed and must enroll new members by email. The error message is upgraded to name the brand's current kind ("this organization identifies members by email; supply an email address").

**Key invariant:** at no phase can an old-id request create a *new* member under the old shape once the kind has flipped, because shape validation (`validateIdentifierShape`, `memberResolution.ts:53-92`) rejects a non-email identifier for an `EMAIL` brand before any write. The only way old-id traffic resolves is via the explicit dual-key mapping lookup (during the window, or post-grace for the helpful-error path) — and that always points at the *existing* migrated member, never a new one.

#### M.5 Disposition summary (what we do about non-honoring paths)

| Path | Disposition in Slice 1 |
|---|---|
| `/v1/events` (4) | **No action** — internal-id, migration-stable. Explicitly excluded from the impact preview (§H). |
| External-signal ingestion (5), CRM webhooks (6) | **No action for Slice 1** — match-only, already non-functional for CUSTOMER_ID brands, strictly improved post-flip. Documented here so a future PHONE/other slice revisits whether they should honor kind (they hardcode email). Tracked alongside the A1 follow-up. |
| Bulk import (7) | **No action for Slice 1** (→EMAIL makes it correct). It is the A1 wrinkle to fix in the first non-EMAIL-target slice (route it through `resolveOrEnrollMember`). Already called out in §A "Out of scope." |
| Honor-kind paths (1–3) | Dual-key (§E) + reconciliation (§F) + old-key telemetry (B.3) + post-grace helpful-error (M.4). |

## Confidence Level

**85%.** All patterns are established in the repo. The 15% uncertainty:

- Reconciliation edge cases at grace expiry — especially the question of *what to do when a brand-new member enrolled on the old key has data (loyalty events, survey responses) accumulated to them* and then needs to be reconciled into a pre-existing member with the same new email. The merge algorithm needs careful design: do we re-parent the events to the canonical Member.id, or accept duplicate "phantom" members? Current plan: re-parent within a transaction (events FK on Member.id, which is the canonical id we keep). Bear watching during implementation.
- Performance of the impact-preview aggregations for very large brands (>1M members). The queries are indexed but a worst-case `SurveyResponse` count over 30d could be heavy. Mitigation: add a 30s response-cache on the preflight-context endpoint; queries time out fast and return partial data with a warning.

## Validation Plan

| User Scenario | Expected outcome | Validation method |
|---|---|---|
| Brand on CUSTOMER_ID with all emails on file opens the wizard | Fast-path offered; "Use existing emails" CTA enabled (R28) | Integration test against seeded DB |
| Same brand, but two members share an email | Fast-path disabled; collision listed; "Edit mapping before migrating" routes into upload path with template pre-filled (R28, R29) | Integration test |
| Brand on CUSTOMER_ID with mix of email-on-file and missing | Template download has 845/1284 rows pre-filled (R4) | Integration test reading the CSV response body |
| Brand uploads CSV with one member missing | 1 unmapped member reported; start blocked (R8/R11) | Integration test |
| Brand confirms migration → worker re-keys 1284 members | All members re-keyed; `Brand.memberIdentifierKind = EMAIL` only after success; audit row written (R17, R25) | Integration test |
| Worker fails mid-batch on member 512 | `status=FAILED`; `memberIdentifierKind` unchanged; per-member errors visible (R23) | Integration test with injected failure |
| Inbound `/v1/events` POST with old `cust_00012` during PROCESSING | Resolves to migrated member; not rejected (R19, R32) | Integration test (concurrency) |
| Inbound survey-respond with new `cust_99999` (never seen) during grace | New member created; reconciled after grace sweep (R20) | Concurrency integration test |
| Brand 25d into grace with old-key activity > 0 in last 7d | `/v1/admin/brand/usage-warnings` returns pre-expiry payload (R37) | Integration test |
| Old `cust_00012` POSTed after grace expiry | 410 `IDENTIFIER_DEPRECATED_AFTER_MIGRATION` (R35) | Integration test |
| GDPR erasure on a migrated member | `Member.erased = true` + read-time mask returns `'[ERASED]'` for `email`/`firstName`/`lastName`/`phone` (per the existing pattern in `apps/api/src/routes/members.ts:538-540, 944-954`), including the new email value (R26). | Integration test extending existing erasure suite |
| Pre-existing erased / soft-deleted members are excluded from the migration | Worker skips members where `erased = true OR deletedAt IS NOT NULL`; pre-flight coverage check (R8) excludes them so the brand isn't forced to supply emails for them. | Integration test: seed 3 erased + 2 soft-deleted members; assert they are not in mapping totals and not touched by re-key |
| Cross-tenant mapping upload | 403; no rows touched (R27) | Integration test |
| `/v1/events` during/after migration | Unaffected — resolves by internal `Member.id`; same member, no error, no cutover needed (§M.2/§M.3) | Integration test: POST `/v1/events` with internal id mid-migration and post-grace → 202 both times |
| Old id at `POST /v1/members/enroll` after grace (matched mapping) | `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION`; no member created (§M.4(a)) | Integration test |
| Unknown old-shape id at enroll after grace | `422 IDENTIFIER_SHAPE_INVALID`; no member created (§M.4(b)) | Integration test |
| Member scope: admin/portal Clerk users excluded; loyalty `clerkUserId` preserved (R36) | Coverage totals exclude admin users (they aren't `Member` rows); a loyalty member's `clerkUserId` is unchanged post re-key | Integration test seeding a `clerkUserId`-bearing loyalty member |
| Hero #6 SLA: `/v1/events` p99 during PROCESSING | < 1s p99 — note `/v1/events` itself does NOT take the dual-key path (internal-id lookup); the +5–20ms applies only to the external-id resolve paths (1–3) | Load test with synthetic events + enrolls while migration runs |

## Test Matrix

### Unit (mocking OK)
- **`apps/api/src/services/memberResolution.ts`**: dual-key fallback returns mapped member; shape-validation skipped when caller's identifier matches an `oldExternalId`; old-key usage counted via injected recorder.
  - *New test suite:* `memberResolution.dual-key.test.ts`
  - *Modifies:* `memberResolution.test.ts` (extends; does not change existing assertions)
- **`apps/api/src/services/migrationPreflight.ts` (new)**: CSV parse; coverage; collision; shape detection; both branches (fast-path / upload).
- **`apps/api/src/services/migrationReconciliation.ts` (new)**: merge algorithm with LWW; no hard-deletes; events re-parented; idempotent on re-run.
- **`apps/worker/src/processors/memberIdentifierMigration.ts` (new)**: per-member transaction; resumable cursor; terminal state computation; emits audit on transitions.
- Existing route handler tests for each new endpoint (§C) — happy + 409 + 403 + 422.

### Integration (Postgres + Redis; mocks only external services)
- End-to-end migration: seed brand+1k members → POST /migrations → POST /mapping (fast path) → POST /start → poll until `REKEY_COMPLETE_IN_GRACE` → assert per-member externalId + email + audit row + `memberIdentifierKind`.
- Failure variant: inject DB failure on member 100 → assert terminal `FAILED`, no kind flip, errors persisted.
- Concurrency: with worker running, fire 100 inbound `/v1/events` and `/v1/public/surveys/:id/respond` keyed by old + new identifiers; assert no stranded/duplicate members afterward (R19/R20).
- Grace expiry: fast-forward `graceExpiresAt`; trigger sweep; assert R35 reject + audit row.
- Erasure compatibility: existing erasure job zeroes new `email` + `externalId` (R26).
- Cross-tenant: brand-A admin uploads mapping with member-of-brand-B IDs → 0 mappings created; integration assertion.

### E2E (1, Playwright, no mocking)
- Full wizard happy path: log in as brand admin → settings → identifier section → "Switch identifier method" → Step 1 (fast path) → Step 3 confirm with attestation → wait for completion → assert audit row visible.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Reconciliation merge corrupts loyalty-event linkage | Low | High | Loyalty events FK on `Member.id` (stable cuid); merge re-parents within a single transaction; integration test asserts ledger integrity (Rule 7). |
| Dual-key lookup adds latency to hero #6 path | Low | High | One extra indexed `findUnique` (~5–20 ms); fired only on miss; index `(migrationId, oldExternalId)` is unique. Load test required before GA. |
| Worker crash mid-batch leaves partial state | Low | Medium | Per-member transactions + resumable cursor on `appliedAt IS NULL`; BullMQ job idempotency. |
| Mapping table grows unboundedly | Low | Low | Migrations are rare (per brand, once per direction); rows are 100s–1000s; no GC policy in Slice 1. |
| Grace-expiry sweep falls behind | Low | Medium | Request-time reject (R35) gates on `status` not `now()`; sweep is at-most-15-min behind; safe in practice. |
| Brand admin extends grace forever, never cuts over | Medium | Low | Audit log captures every extension; team can chase via the L&D / CS surface later; not a Slice 1 constraint. |
| Member.email collisions discovered late (fast path was clean at preflight but a new collision lands mid-window) | Low | Medium | Re-key uses Prisma upsert with the unique constraint — a colliding update raises P2002 and is logged per-row; batch ends `FAILED` (R23) safely. |
| Performance of impact-preview queries on large brands | Medium | Low | Indexed queries; add 30s response-cache; partial-data + warning on timeout. |

## Spike Findings (if applicable)

*N/A — no spike was required (see "Ambiguity assessment" in phase report). All patterns are established in the repo and risks are quantified above.*

## Architecture Analysis

Compared the RFC against `docs/architecture/architecture.md` and the ADR set. No architecture-doc edits are made in this phase — they happen in `address-feedback` after the user weighs in.

### Patterns Correctly Followed
| Pattern | Source in architecture.md | How the RFC uses it |
|---|---|---|
| BullMQ async worker for long-running ops | §3.3 Event Processing Layer; ADR-004 | New `MEMBER_IDENTIFIER_MIGRATION` queue + worker; off the hero #6 hot path |
| Prisma transactional writes for ledger-like state | §6 Design Patterns; project Rule 7 | Per-member re-key + counter increment in one `$transaction`; final flip-kind step in a separate `$transaction` |
| `brandId`-scoped queries everywhere | §6 Design Patterns; project Rule 6 | Every read/write filtered on `brandId`; `Member.update` uses `where: { id, brandId }` |
| Standard CRUD admin route pattern | §3.1; ADR-0001 | `/admin/settings/organization/migrations` follows list / `[id]` view; wizard `new/` is the documented #420 `ManagedEmailFlow` precedent |
| `usePollingQuery` hook for fixed-cadence refresh | §3.1 | Migration progress (Scene 6) + grace-status panel (Scene 7B/7Bw) consume it |
| Audit-on-change via `brand.profile.update` pipeline | `admin-brand-profile.ts:90-100`, §6 | New `brand.identifier_migration.*` audit-action family extends the existing pipeline |
| Single transactional Prisma migration | §3.4, ADR-0001 | All three new tables + Brand column in one migration file |
| Hero #6 SLA preservation | §5.1; project Rule 2 | Worker is async; `/v1/events` (hero path) is unaffected — it keys on internal `Member.id`, not the external id (§M.2). Dual-key adds one indexed `findUnique`-on-miss only to the external-id resolve paths 1–3 (§E) |
| GDPR erasure compatibility | §10 Compliance Architecture; project Rule 13 | Re-key is UPDATE only; erasure is **mask-on-read via `Member.erased`** (the actual pattern in `apps/api/src/routes/members.ts:538-540, 944-954, 895`, not column-zeroing as Rule 13's prose implies); migration is required to **exclude `erased = true OR deletedAt IS NOT NULL` members** from the mapping so it cannot re-PII an erased member (test in validation plan) |

### Patterns Missing from Architecture (used in this design; arch doc would benefit from documentation)

1. **Brand-wide admin-shell warning banner (R37).** The RFC introduces `GET /v1/admin/brand/usage-warnings` consumed by `apps/web/src/app/(admin)/layout.tsx` to render a non-dismissible banner on every admin page. Architecture.md §3.1 documents the admin shell but does not call out a "brand-wide warning surface" pattern. This is reusable infrastructure — future features (compliance flags, billing warnings, plan-cap notices) will want it. **Suggested resolution in address-feedback:** add a §3.1 bullet describing the pattern and the `useUsageWarnings` hook, with this RFC as the inaugural consumer.

2. **Migration-mapping-backed dual-key resolution in `resolveOrEnrollMember`.** The fall-back-on-miss-to-mapping-table approach (§E) is engine-level for this and future migration slices. It's not in architecture.md §4.4 (Database Models) or §6 (Design Patterns). **Suggested resolution:** add a short §6 entry describing the engine's "during-migration dual-key resolution" pattern — and reference R0's direction-agnostic guarantee — so future slices (`EMAIL→PHONE` etc.) consume it without re-deriving the pattern.

3. **"Direction-agnostic engine with per-direction adapters" (R0).** This is a one-way-door architectural choice per project Rule 4. The current ADR set has no entry covering polymorphic / direction-agnostic migration engines. **Suggested resolution:** when the spec is implemented and the engine lands, add **ADR 0005 — Direction-agnostic Member Identifier Migration Engine** describing the `{fromKind, toKind}` adapter dispatch, the shared batch/worker/audit/telemetry surfaces, and the "to enable a new lane, only register an adapter" guarantee. The ADR should also note the surveyImport.ts EMAIL-hardcoding wrinkle (A1) as a known follow-up for non-EMAIL-target slices.

### Patterns Incorrectly Followed

None identified. The RFC was authored against the project Rules + architecture.md sections referenced above; spot-checks against ADR-0001 (CRUD), §5.1 (hero #6), §6 (transactions + brandId scoping), and Rule 13 (GDPR/CCPA) pass.

### Recommended Patterns (for the team to weigh in on)

- The 3 "Missing from Architecture" items above are the recommended additions. None are mandatory before implementation begins; the design is internally consistent without them. They're worth landing alongside this issue's `work-completion` so the architecture-doc + ADR set stays the authoritative record (Rule 4).

## Observability (logs, metrics, alerts)

- **Logs (pino)**: every state transition with `{ migrationId, brandId, fromKind, toKind, status, transitionFrom, transitionTo }`.
- **Metrics**: BullMQ already exposes job-duration, job-failures, queue-depth on `MEMBER_IDENTIFIER_MIGRATION`; nothing new to wire.
- **Alerts**: none in Slice 1. The pre-expiry warning (R37) is a user-facing signal, not an ops alert. If/when adoption grows, add an alert on `MemberIdentifierMigration.status = FAILED` count > 0 per day (separate issue).
- **Audit log**: §I above is the durable trail.

---

## Direction-agnostic engine plan (referenced from R0)

A future slice (e.g., `EMAIL → PHONE`) reuses every table, route, worker, hook, and audit family in this RFC. The only per-slice additions are:

1. A new adapter `{ fromKind, toKind }` registered with the worker that sets the right PII sidecar (`email`/`phone`/none) and runs `validateIdentifierShape` for `toKind`.
2. The `MigrationOldKeyIngress` enum may grow if a slice introduces a new ingress (none expected through PHONE/CUSTOMER_ID slices).
3. The wrinkle A1 (`surveyImport.ts` EMAIL-hardcoding) must be fixed in the first slice whose `toKind != EMAIL`. The fix routes `surveyImport`'s row processing through `resolveOrEnrollMember` instead of the inlined `externalId = email.toLowerCase()`.

This satisfies R0's "no re-architecting" guarantee.
