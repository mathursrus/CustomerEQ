# Feature: Switch Member Identifier Kind — Slice 1 (Customer ID → Email)
Issue: #524
Feature Spec: [`docs/feature-specs/524-switch-member-identifier-kind.md`](../feature-specs/524-switch-member-identifier-kind.md)
PR: this PR (`feature/524-switch-a-brand-s-member-identifier-kind-...`)

## Completeness Evidence
- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All files committed/synced to branch: Yes
  - `docs/rfcs/524-switch-member-identifier-kind.md` (RFC)
  - `docs/evidence/524-technical-design-evidence.md` (this file)

### PR Feedback
| PR Comment | How Addressed |
|---|---|
| _(none yet — awaiting human review of the RFC)_ | — |

### Traceability Matrix
Every R-statement in the spec maps to one or more RFC sections. No R is `Unmet`. Validation Plan in the spec maps directly to the RFC's Test Matrix.

| Requirement (Spec) | RFC Section / Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| **R0** — Engine direction-agnostic | §A Design philosophy; §B `fromKind`+`toKind` columns; §D worker dispatch; §K Direction-agnostic engine plan | Met | "AC R0" in spec: enabling a future lane (e.g., `EMAIL→PHONE`) requires only adapter wiring — verified in §K + the §"Patterns Missing from Architecture" recommendation (ADR 0005) |
| **R1** — "Switch identifier method" action replaces dead `mailto:` | §C `PATCH /v1/admin/brand/profile` (replace 409); §J `MemberIdentificationSection.tsx` update | Met | E2E happy-path navigates this entry |
| **R2** — Radios non-editable; guided flow only path | §C `PATCH` rejects radio toggle; §J UI keeps disabled state | Met | Integration test on `admin-brand-profile.ts` |
| **R3** — Slice 1 enables only `EMAIL` target | §C `POST /v1/admin/brand/migrations` enforces toKind; §J wizard target chooser | Met | Unit + integration on route handler |
| **R4** — Mapping template pre-filled (`customer_id` + `new_email` where populated) | §C `POST /migrations/:id/mapping` mode=`csv` flow; §C.2 detection signal | Met | Integration test reads downloaded CSV body for the 845/1284 fixture |
| **R5** — Accept CSV upload, brand-scoped | §C `POST /migrations/:id/mapping` mode=`csv` | Met | Integration test |
| **R6** — Validation runs pre-flight (no writes) | §C.1 contract; §D worker not invoked until VALIDATED | Met | Integration test: assert zero member rows touched during preflight |
| **R7** — Report counts (totals/matched/unmapped/blocking) | §C.1 `MigrationPreflightResult.counts` | Met | Unit on preflight service + integration on API response shape |
| **R8** — Unmapped members are blocking | §C.1 `unmappedMembers`; §D state machine | Met | Integration: 1283/1284 fixture asserts block |
| **R9** — Collisions are blocking | §C.1 `collisions`; §C.2 detection SQL | Met | Integration with two-row-same-email CSV |
| **R10** — Invalid email shape blocking | §C.1 `invalidShape`; reuses existing `validateIdentifierShape` | Met | Unit on validator + integration |
| **R11** — Not startable while blocking exists | §C `/start` requires `status=VALIDATED` | Met | Integration: pre-flight FAIL → `/start` returns 409 |
| **R12** — Per-row issue detail display | §C.1 `rowIssues[]` schema | Met | Integration on API; E2E renders rows in Scene 4 |
| **R13** — Attestation recorded with admin+timestamp+text | §C `POST /start`; §B.1 attestation columns; §I audit `brand.identifier_migration.started` | Met | Integration: assert audit row contains verbatim attestation text |
| **R14** — Migrate disabled until attested | §C `/start` 422 without attestation block | Met | Unit on route handler |
| **R15** — Async re-key off hero #6 hot path | §D BullMQ worker; §K SLA preservation | Met | Load test in validation plan; concurrency integration test |
| **R16** — Per-member externalId + sidecar in `brandId`-scoped txn | §D worker algorithm (per-member `$transaction`) | Met | Integration |
| **R17** — Kind flips only on terminal success | §D worker end-state branch | Met | Integration: terminal-failure variant asserts unchanged kind |
| **R18** — Live progress (total/migrated/remaining/failed) refresh | §C `GET /migrations/:id`; §J `usePollingQuery` | Met | E2E + integration |
| **R19** — Dual-key during re-key (resolve old or new) | §E algorithm | Met | Concurrency integration test |
| **R20** — Reconcile members enrolled on old key during window | §F reconciliation algorithm (3 triggers) | Met | Concurrency integration test |
| **R21** — LWW on non-identifier fields; no hard-delete | §F + reuse of `memberResolution.ts:167-222` | Met | Integration |
| **R22** — Completion summary (re-keyed + reconciled + failures) | §C `GET /migrations/:id` + §B.1 counters; §J `MigrationCompletionSummary` | Met | E2E |
| **R23** — Failure rollback (no partial flip; stay at `CUSTOMER_ID`) | §D worker terminal-failure path | Met | Integration with injected failure |
| **R24** — Per-member errors + admin retry | §B.1 `mappings.errorReason`; §C `/start` idempotent on already-`PROCESSING` | Met | Integration |
| **R25** — Audit captures before/after/kind/counts/admin/timestamp/attestation/extensions | §I audit table (8 actions) | Met | Integration on audit pipeline; assertion against `AuditEvent` rows |
| **R26** — Preserve consent/erasure/balances/history | §D worker UPDATEs only externalId+email; events FK on `Member.id` (stable cuid) | Met | Integration extending existing erasure suite |
| **R27** — All ops tenant-scoped by `brandId` | §D worker `where: { id, brandId }`; §C routes Clerk-org-scoped | Met | Cross-tenant integration test |
| **R28** — Fast path when all members have valid unique emails on file | §C.2 detection SQL; §C `POST /mapping mode=from_existing_emails` | Met | Integration with all-emails-on-file fixture |
| **R29** — Fast-path fail-over (R12 display + R5 upload) | §C `POST /mapping` returns `ok=false`; uses R12 contract; routes to R5 | Met | Integration with collision-in-existing-emails fixture |
| **R30** — Data-driven impact preview (used surfaces only, most-recent-first) | §H data sources table | Met | Integration: seed activity, assert ordering + omission of zero-activity |
| **R31** — 30-day fixed grace; extend via R34 | §D worker sets `graceExpiresAt = +30d`; §G state machine | Met | Integration: terminal-success → `graceExpiresAt` set; extend changes it |
| **R32** — Dual-key during grace (extends R19) | §E algorithm (covers `PROCESSING + REKEY_COMPLETE_IN_GRACE`) | Met | Concurrency integration test (post-flip) |
| **R33** — Per-ingress old-key telemetry | §B.3 `MemberIdentifierMigrationOldKeyUsage`; §E `recordOldKeyUsage` | Met | Integration: hit `/v1/events` w/ old key, assert table row |
| **R34** — Grace-status panel + simple-action extend (audit-logged) | §C `POST /extend-grace`; §G; §J `GraceStatusPanel` | Met | Integration + E2E |
| **R35** — Reject after expiry with `IDENTIFIER_DEPRECATED_AFTER_MIGRATION` | §G request-time gate on `status`; §C error response | Met | Integration: fast-forward expiry, assert 410 |
| **R37** — Pre-expiry warning (brand-wide banner + section panel) when ≤7d + old-key active | §G trigger; §C `GET /usage-warnings`; §J `UsageWarningBanner` | Met | Integration: seed 5d-remaining + activity, assert banner payload |
| Spec Validation Plan — Unit | RFC Test Matrix → Unit section | Met | Per-row mapping above |
| Spec Validation Plan — Integration | RFC Test Matrix → Integration section | Met | Per-row mapping above |
| Spec Validation Plan — E2E (Playwright) | RFC Test Matrix → E2E section (1, happy path) | Met | Per-row mapping above |
| Spec Validation Plan — Concurrency | RFC Test Matrix → Integration "Concurrency" item | Met | Inbound `/v1/events` + `/respond` during PROCESSING; old→new reconciliation post-window |
| Spec Validation Plan — Compliance (GDPR erasure) | RFC Test Matrix → Integration "Erasure compatibility" | Met | Per-row mapping above |

| **R36** (added in design-review Round 1) — migration scoped to loyalty members; admin/portal Clerk users excluded; loyalty `clerkUserId` preserved | RFC §M.1; §D worker (sets only externalId+email); spec R26 preserve set | Met | Integration test seeding admin users + a `clerkUserId`-bearing loyalty member |

**Matrix verdict:** all 39 R-statements (R0 + R1–R36 + R37) are `Met`. Spec Validation Plan items map one-to-one to the RFC Test Matrix. **Phase passes.**

**Design-review Round 1 update (2026-05-28):** Reviewer asked for breakage coverage ("which paths break? new member with old id after grace? which paths don't honor the kind?"). Added RFC **§M** (ingress × lifecycle matrix, member scope, post-grace analysis), verified against code. The audit corrected 2 further claims — `/v1/events` is internal-id (migration-stable, removed from cutover surfaces + several ACs) and `CLERK_OAUTH` enroll is unwired — and clarified member scope (loyalty vs admin) per R36. See `docs/evidence/524-design-feedback.md`.

### Architectural Gaps (for user decision via PR review)

Documented in detail in the RFC's "Architecture Analysis" section. Summary:

| Gap | Pattern | Why it matters | Suggested resolution (address-feedback phase) |
|---|---|---|---|
| Missing #1 | Brand-wide admin-shell warning banner | Reusable infra (R37 is the inaugural consumer); future compliance / billing / plan-cap surfaces will want it | Add a §3.1 bullet to `architecture.md` describing the pattern + the `useUsageWarnings` hook |
| Missing #2 | Migration-mapping-backed dual-key resolution in `resolveOrEnrollMember` | Engine-level pattern for this + future migration slices | Add a short §6 entry to `architecture.md` referencing R0's direction-agnostic guarantee |
| Missing #3 | Direction-agnostic migration engine (R0) | One-way-door architectural choice per project Rule 4 | Add **ADR 0005 — Direction-agnostic Member Identifier Migration Engine** when this issue's `work-completion` lands |

These do not block this phase. Address-feedback will resolve via user decisions on the PR.

## Due Diligence Evidence
- Reviewed feature spec in detail: Yes (the spec was authored by me in the prior phase and approved by the user after 4 review rounds)
- Reviewed code base in detail to understand and repro the issue: Yes — re-used the same evidence trail from the spec phase: `schema.prisma`, `memberResolution.ts`, `admin-brand-profile.ts`, `MemberIdentificationSection.tsx`, `surveyImport.ts`, `bullmq.ts`, RFC #231, architecture.md sections 3.1/3.2/3.3/3.4/4.4/5.1/6/10/11
- Included detailed design, validation plan, test strategy in doc: Yes (RFC §A–§L + Test Matrix)

## Prototype & Validation Evidence
- [x] Built simple proof-of-concept that works end-to-end — **N/A for design phase.** Ambiguity assessment in phase report-out rated all six identified items Low–Medium uncertainty; no spike was warranted (no High items per the spike-first rule). Patterns reused: BullMQ workers, Prisma transactions, second-`findUnique` dual-key, idempotent LWW upsert, brandId-scoped audit — all proven in the existing codebase.
- [x] Manually tested complete user flow (browser/curl) — **Mock end-to-end render verified** during the spec phase (Playwright screenshots of all 9 scenes). Code-level POC is the implement phase's job.
- [x] Verified solution actually works before designing architecture — Confirmed by the spec-phase mock review (4 rounds, user-approved) and by anchoring every RFC section to an existing, working repo pattern.
- [x] Identified minimal viable implementation — Slice 1 = direction-agnostic engine + the one `CUSTOMER_ID → EMAIL` adapter lane. Future lanes are adapter-only (R0).
- [x] Documented what works vs. what's overengineered — Spec Resolved Decisions section already trimmed earlier proposals (no post-success rollback, no quarantine, no configurable grace range). RFC Risks section quantifies the remaining 15% uncertainty.

## Continuous Learning
| Learning | Agent Rule Updates |
|---|---|
| For data-migration RFCs, the design-vs-spec traceability matrix lands cleanly when the spec is already in R-statement form (every R → one or more RFC §-anchors). The spec-phase user feedback ("R-style made review easy") pays off again here. | No new rule needed; reinforces the existing "Spec prose is not a deliverable" memory + project convention. |
| The "architecture-gap-review" phase is a useful seam to surface patterns the design needs that don't exist in `architecture.md` yet (e.g., the brand-wide warning banner pattern). Cleaner than discovering the gap in the impl phase. | None — the phase itself is the rule. |
| RFC's concrete-detail claims (channel enum values, column existence, soft-delete patterns) need to be verified against code *before* claiming them. The user-demanded post-RFC audit caught 3 real bugs + 1 missed edge case (see Code-Base Audit below). Existing raw learning `2026-05-04-rfc-claimed-files-not-verified-against-codebase.md` plus the dedicated retro `issue-301-rfc-existing-claims-unverified-postmortem.md` already cover this pattern; the new audit reinforces it. | The pre-existing learnings cover the pattern. Reinforcing by referencing them in this evidence file. |

## Code-Base Audit (post-RFC drift check, requested by user)

Audited every concrete codebase claim in the RFC against the actual source. Methodology: read each cited file at the cited line range; grep for each cited symbol; verify each cited column / enum value / regex / API path / hook signature exists as described.

### Claims verified ✓

| # | Claim in RFC | Evidence |
|---|---|---|
| 1 | `apps/api/src/services/memberResolution.ts:53-92` is `validateIdentifierShape(memberId, email, kind)` returning `IdentifierShapeError \| null` | Verified verbatim (lines 53-92) |
| 2 | `EMAIL_RE` regex is `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `memberResolution.ts:51` exact match |
| 3 | Primary member lookup is `findUnique({ where: { brandId_externalId: { brandId, externalId } } })` at line 143-145 | Verified verbatim |
| 4 | R6 last-write-wins update path lives at `memberResolution.ts:167-222` | Verified — section starts with `// R6: existing member — last-write-wins on non-identifier fields only.` |
| 5 | `admin-brand-profile.ts:322-335` rejects identifier-kind change with `code: 'MEMBER_IDENTIFIER_KIND_LOCKED'` when `memberCount > 0` | Verified verbatim |
| 6 | `ROUTE_AUDIT_CONFIG` at `admin-brand-profile.ts:90-100` uses `auditAction: 'brand.profile.update'` | Verified verbatim |
| 7 | `usePollingQuery({ fetchFn, intervalMs, enabled })` returns `{ data, loading, error, refetch }` | `apps/web/src/lib/hooks/usePollingQuery.ts:10-21,23-75` exact match |
| 8 | `<ModeRouter>` exists at `apps/web/src/components/mode-router/` | `mode-router/{index.ts, ModeRouter.tsx, ModeRouter.test.tsx}` all present |
| 9 | `ManagedEmailFlow` is at `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` | Confirmed via grep (earlier glob with literal path failed; parenthesized `(admin)` segment is a glob quirk, file exists) |
| 10 | ADR file `docs/architecture/adr/0001-admin-crud-route-pattern.md` exists | Confirmed |
| 11 | `surveyImport.ts:23-31` inlines `const externalId = email.toLowerCase().trim()` and `enrolledVia: 'BULK_IMPORT'` (the wrinkle A1 from the spec) | Verified verbatim |
| 12 | `Brand.memberIdentifierKind: MemberIdentifierKind @default(EMAIL)` at `schema.prisma:203` | Verified |
| 13 | `Member.externalId String` at `schema.prisma:330` with `@@unique([brandId, externalId])` at `:374` | Verified |
| 14 | `MemberIdentifierKind` enum is `EMAIL \| PHONE \| CUSTOMER_ID` (`schema.prisma:167-171`) | Verified |
| 15 | `MemberEnrolledVia` enum includes `MANUAL_API`, `BULK_IMPORT`, `SURVEY_RESPONSE`, `EMBEDDED_FORM`, `CLERK_OAUTH`, `BULK_DISTRIBUTION` (`schema.prisma:178-185`) | Verified |
| 16 | `SurveyImportBatch` (lines 910-931) shape: `status, totalRows, processedRows, failedRows, errors Json` | Verified |
| 17 | `Member.id` is `cuid()`-defaulted (stable across re-key) | `schema.prisma:322` — `id String @id @default(cuid())` |
| 18 | `LoyaltyEvent.memberId` FKs `Member.id` (not `externalId`); has `(brandId, createdAt)` index | `schema.prisma:472-473, 483` verified |
| 19 | `AuditEvent` model has `brandId, actorId, action, resourceType, resourceId, metadata Json?` (`schema.prisma:1070-1082`) | Verified |
| 20 | Audit pipeline uses `request.audit = { metadata }` filtered by per-route `auditAllowlist` | `apps/api/src/plugins/audit.ts:5-15` verified |
| 21 | BullMQ queue infra at `apps/api/src/queues/bullmq.ts:56-74` with `inline`/`redis` modes | Verified earlier; matches |
| 22 | `DistributionBatch.audienceSpec` is `Json`; the JSON has a `mode` field with value `'custom_list'` | `distributionBatches.ts:937, 944` — `mode = audienceSpec.mode ?? 'custom_list'` and `mode === 'custom_list'` |
| 23 | `Member.erased`, `Member.deletedAt`, `Member.consentGivenAt`, `Member.consentVersion`, `Member.pointsBalance`, `Member.email` (nullable) all exist | All verified in earlier full Member read |

### Claims that needed correction (with fixes applied)

| # | Original claim | Reality | Fix applied |
|---|---|---|---|
| **B1** | RFC §H: "Embedded survey forms — channel IN `('embed', 'in_app')`" | `'embed'` is not a valid value. `apps/api/src/routes/public.ts:53` restricts to `z.enum(['email', 'in_app', 'link', 'sms'])`. Widget hardcodes `'in_app'` at `public.ts:992`. | RFC §H updated to `channel = 'in_app'` with code citations inline. |
| **B2** | RFC §H: "Outbound webhooks — `WebhookEndpoint` where `brandId AND active = true AND deletedAt IS NULL`" | `WebhookEndpoint` (`schema.prisma:1206-1223`) has no `deletedAt` column. Disable is `active = false` only. | RFC §H updated to drop the `deletedAt` filter, with the schema-line citation inline. |
| **B3** | RFC §K Risks + Test Matrix: "existing GDPR erasure job zeroes `email` + `externalId`" | The actual pattern in `apps/api/src/routes/members.ts:538-540, 944-954, 895` is **`Member.erased = true` flag + mask-on-read** (reads return `'[ERASED]'`). There is no dedicated PII-zeroing worker job. Project Rule 13's "zeroed out" prose is aspirational vs the codebase. | RFC §K Risks + Test Matrix updated to reflect mask-on-read semantics. Spec Compliance Requirements + Validation Plan also corrected (same drift). |
| **B4 (missed edge case)** | RFC §C.2 fast-path detection SQL excluded `deletedAt IS NULL` but **did not exclude `erased = true`**. The worker algorithm in §D had no guard against re-PII-ing an erased member. | Writing a new email to an `erased = true` member would violate the existing erasure contract (the read-masking can't know the email was overwritten by a migration, so the masked PII state would be undermined for any code that doesn't go through the masking read path). | RFC §C.2 SQL adds `erased = false`. §D pre-flight + worker explicitly exclude `erased = true OR deletedAt IS NOT NULL` from coverage and re-key. New Test Matrix row asserts this exclusion. Spec Compliance section updated to call this out. |

### Claims I deliberately did not "fix"

| # | Claim | Why kept |
|---|---|---|
| K1 | RFC §K SLA budget "<1s p99 for the synchronous path" | Sourced from RFC #231:237 ("Always within the <1s p99 budget"); not in `architecture.md` §5.1 prose but anchored in a prior approved RFC. Citation could be tightened but the number is real. |
| K2 | The "wizard inside Standard CRUD" precedent (#420 `ManagedEmailFlow`) | Verified the file exists (claim 9 above). The architecture-doc characterization of it as a "precedent" is the agent's framing; not a wrong claim about code, just stylistic. |
| K3 | Direction-agnostic engine carries `fromKind` + `toKind` etc. | This is the new design (engine doesn't exist yet); not a codebase claim to verify. |
| K4 | New tables, routes, worker, audit actions in §B–§I | All design proposals (new code); not verifiable against current codebase. They are internally consistent and self-documented. |

### Audit verdict

**3 real bugs + 1 missed edge case found and fixed.** The remaining 23 concrete codebase claims verified clean. Confidence in the RFC's grounding rises from "85% (with hand-waved details)" to **"95% (concrete details verified)."** The remaining 5% is dominated by the design-only items in K3/K4 plus the unquantified performance behavior of the impact-preview aggregations on very large brands (§K Risks #8).

### What this audit reinforces

The user's request demonstrates exactly the pattern surfaced in:
- `fraim/personalized-employee/learnings/archive/manohar.madhira@outlook.com-2026-05-04T00-00-00-rfc-claimed-files-not-verified-against-codebase.md`
- `docs/retrospectives/manohar.madhira@outlook.com-issue-301-rfc-existing-claims-unverified-postmortem.md`
- `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T18-14-24-trusted-spec-prose-without-grepping-route.md`

Future RFCs in this codebase should run this audit pass **before** submission, not after. Capturing as a coaching moment.
