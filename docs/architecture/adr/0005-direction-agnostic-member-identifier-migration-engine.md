# ADR 0005 — Direction-Agnostic Member Identifier Migration Engine

**Status**: Accepted
**Date**: 2026-05-31
**Deciders**: CustomerEQ engineering (Issue #524, Slice 1)
**Establishing context**: Issue #524 — Switch a brand's member identifier kind after members exist
**Related RFC**: `docs/rfcs/524-switch-member-identifier-kind.md`

---

## Context

A brand's `Brand.memberIdentifierKind` (`EMAIL | PHONE | CUSTOMER_ID`) hard-locks the instant the first member is enrolled. Brands that outgrow their initial choice need a safe, self-serve, auditable way to re-key every existing member to a new identifier — without losing feedback that arrives mid-migration and without leaving the brand in a mixed-kind state.

Issue #524 is the capability epic across **all six directed pairs** of identifier kinds, delivered in slices. Slice 1 enables exactly one lane, `CUSTOMER_ID → EMAIL`. The one-way-door decision is **how the engine is shaped**: if Slice 1 ships a one-off `CUSTOMER_ID → EMAIL` migrator, every later lane re-implements ~90% identical machinery (batch model, re-key worker, mid-migration catch-up, reconciliation, grace window, telemetry, audit, UI) and the one-off is thrown away. If instead the engine is built direction-agnostic from the start, later lanes add only per-direction wiring.

## Decision

Build the migration engine **direction-agnostic**. Every persistent and runtime structure carries `fromKind` + `toKind`; the re-key worker dispatches the target PII sidecar by `toKind`; shape validation reuses the existing `validateIdentifierShape(memberId, email, kind)`. Enabling a new lane requires only a per-direction adapter (which PII sidecar to set + which `toKind` to validate) plus UI wiring — **no** change to the batch schema, re-key worker, catch-up/reconciliation, grace machinery, telemetry, or audit.

**Shared surfaces (lane-independent):**
- **Schema**: `MemberIdentifierMigration` (batch row, `fromKind`/`toKind` + counters + attestation + grace), `MemberIdentifierMigrationMapping` (per-member `oldExternalId`/`newExternalId`/`oldEmail`, opaque), `MemberIdentifierMigrationOldKeyUsage` (per-ingress telemetry), `Brand.activeMigrationId`. Migration `20260531000000_add_member_identifier_migration`.
- **Re-key worker**: `apps/worker/src/processors/memberIdentifierMigration.ts` — chunked committed transactions (live progress), terminal kind-flip only on zero failures, **compensating rollback** on failure (see Consequences), grace-expiry sweep.
- **Dual-key resolution**: `resolveOrEnrollMember` mapping-fallback (see §6 "During-migration dual-key member resolution").
- **Reconciliation**: `migrationReconciliation.ts` (records late old-key enrollments; no hard-delete).
- **Audit**: `brand.identifier_migration.*` action family.
- **UI**: `apps/web/src/app/(admin)/admin/settings/organization/migrations/**` (wizard + status/grace panels) + the brand-wide pre-expiry banner.

**Per-lane additions only:** an adapter `{ fromKind, toKind }` registered with the worker that sets the right sidecar and validates `toKind`; rarely, a new `MigrationOldKeyIngress` value.

## Consequences

- **Positive**: future lanes (`EMAIL → PHONE`, etc.) are bounded to per-direction shape validation + UI wiring (R0). The catch-up window (inbound feedback on the old identifier resolved + reconciled automatically) is a structural property of the engine, not per-lane code.
- **Failure semantics deviation from the RFC**: the RFC's §D specified per-member committed transactions with no whole-batch rollback. That would strand successfully-re-keyed members on a mid-batch failure (their `externalId` already changed while the brand kind stayed put, and `FAILED` is not a dual-key status), violating spec R17/R23. The engine therefore adds a **compensating rollback** that reverts applied members to their original `externalId`/`email` on terminal failure — which required capturing each member's pre-migration email (`MemberIdentifierMigrationMapping.oldEmail`). This is the one structural divergence from the approved RFC and is covered by the failure-rollback integration test.
- **Known follow-up (non-EMAIL-target lanes)**: `apps/api/src/routes/surveyImport.ts` hardcodes `externalId = email.toLowerCase()` and bypasses `resolveOrEnrollMember`. It is correct for a steady-state EMAIL brand (Slice 1) but must be routed through `resolveOrEnrollMember` in the first slice whose `toKind != EMAIL`. The email-keyed match-only paths (external-signal ingestion, CRM webhooks) similarly hardcode email and should revisit honoring `memberIdentifierKind` for non-EMAIL targets.
- **Migration mappings are retained post-grace** (not GC'd in Slice 1) to power the actionable `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION` error.
