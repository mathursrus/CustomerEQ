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

**Matrix verdict:** all 38 R-statements (R0 + R1–R35 + R37) are `Met`. Spec Validation Plan items map one-to-one to the RFC Test Matrix. **Phase passes.**

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
