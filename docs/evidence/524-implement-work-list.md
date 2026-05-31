# Implementation Work List — Issue #524 (Switch Member Identifier Kind, Slice 1: CUSTOMER_ID → EMAIL)

Phase: `feature-implementation` (FRAIM). Source of truth: spec `docs/feature-specs/524-switch-member-identifier-kind.md` (R0–R37), RFC `docs/rfcs/524-switch-member-identifier-kind.md`, mock `docs/feature-specs/mocks/524-switch-member-identifier-kind.html`.

**Issue type:** feature (no `implement-repro`; that phase is N/A — see Phase notes).
**Test tier:** **P1** (unit + integration required; E2E not mandatory per Resolved Decisions). The concurrency integration test (R19/R20) is required regardless.
**Validation modes:** `uiValidationRequired: true` (admin wizard + grace panels + brand-wide banner). `mobileValidationRequired: false`. UI evidence → `docs/evidence/524-ui-polish-validation.md`. Target journeys: entry → wizard (fast-path + upload) → confirm/attest → progress → complete → grace panel → pre-expiry banner. Breakpoint baseline: desktop admin (the settings surface is desktop-first). Browser baseline: Chromium via Playwright.

**Scope flag:** >15 file modifications → phase-splitting candidate. NOT split — this is one approved RFC slice shipping as one PR per Rule 26. Walking-skeleton-first ordering used to de-risk (Prototype-First principle).

---

## Design-vs-codebase reconciliations (from pattern discovery, 2026-05-31)

- **No central `emitAudit` helper.** API routes set `request.audit = { metadata }` (onResponse hook persists via `AuditEvent.create`, allowlist-filtered — `admin-brand-profile.ts:90-100,413-427`). Worker writes `prisma.auditEvent.create({ brandId, actorId, action, resourceType, resourceId, metadata })` directly (`managedEmailSend.ts:88-110`). `AuditEvent` requires non-null `actorId`/`resourceType`/`resourceId`; use `actorId:'system'` for worker-emitted rows, `request.clerkUserId` for admin-action rows. RFC §I "emitAudit(...)" is pseudocode → realize via these two mechanisms.
- **`validateIdentifierShape(memberId, email, kind)`** (`memberResolution.ts:53-92`) already OK for EMAIL; `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` (line 51). No new validator. Reuse `EMAIL_RE` in preflight + the §C.2 SQL.
- **CSV upload** = `addContentTypeParser('text/csv', { parseAs: 'string' }, ...)` + `bodyLimit: 11*1024*1024` (`surveys.ts:1167`, `distributionBatches.ts:406`). Mapping upload = `text/csv` body (mode=csv) OR JSON `{ mode: 'from_existing_emails' }`. Not multipart.
- **Queues** in `apps/api/src/queues/bullmq.ts` (`QUEUES` consts, `initQueues`, `enqueueX` with `QUEUE_MODE==='inline'` support). Worker wiring in `apps/worker/src/index.ts` (`new Worker(QUEUES.X, processor, { connection, concurrency, drainDelay })`). Processor exports a `Job`-handler wrapping core logic (`managedEmailSend.ts:258-274`).
- **Prisma singleton** `import { prisma } from '@customerEQ/database'`. **Date util** `addDays` from `date-fns` (also `addDaysInBrandTz` in `packages/shared/src/datetime.ts`). Grace = `addDays(now, 30)` per RFC (coarse window; brand-tz not required).
- **Test factories** `@customerEQ/config/test-utils` (`createBrand`, `createMember`, `createErasedMember`, …). Rule 8: add any new factory here, NOT inline. Need `createMemberIdentifierMigration` + `createMigrationMapping` factories.
- **UI is Tailwind-utility-driven** — no `.section`/`.radio-card`/`.locked-notice` CSS classes. Mirror existing component classes (`MemberIdentificationSection.tsx`, `OrganizationSettingsForm` section card `rounded-xl border border-gray-200 bg-white shadow-sm`). Wizard precedent: `ManagedEmailFlow.tsx` (`FlowState` useState; visibility-toggle to preserve state). Attestation precedent: `ImpliedAttestationModal.tsx` (checkbox+text gate, `canConfirm` disabled). Polling: `usePollingQuery({ fetchFn, intervalMs, enabled })`. API base `API_URL` + `getAuthToken(getToken)` → `Authorization: Bearer`.
- **#262 import upload UI absent** in this worktree → build upload UI fresh on the wizard pattern.
- **Latest migration prefix** locally = `20260523050000`. Use **`20260531000000_add_member_identifier_migration`** (later; re-check `git log origin/main -- packages/database/prisma/migrations/` before push per Rule 22c).

---

## Work items (grouped; check off during implement-code)

### Group 1 — Schema + migration (RFC §B) — walking-skeleton foundation
- [ ] `packages/database/prisma/schema.prisma` — add enums `MemberIdentifierMigrationStatus`, `MigrationOldKeyIngress`; models `MemberIdentifierMigration`, `MemberIdentifierMigrationMapping`, `MemberIdentifierMigrationOldKeyUsage`; `Brand.activeMigrationId` + relation; back-relations on `Brand`, `Member`. (§B.1–B.5)
- [ ] `packages/database/prisma/migrations/20260531000000_add_member_identifier_migration/migration.sql` — hand-written DDL, camelCase quoted identifiers, single transactional file. Verify casing per Rule 22a.
- [ ] `pnpm db:generate` after schema edit (regenerates client; required for typecheck/build).

### Group 2 — Engine services (RFC §A, §C.1, §E, §F)
- [ ] `apps/api/src/services/migrationPreflight.ts` (new) — CSV parse; coverage (R8); collision (R9); email-shape (R10) reusing `EMAIL_RE`; fast-path source build from `Member.email`; returns `MigrationPreflightResult` (§C.1). Pure, DB-read-only (R6).
- [ ] `apps/api/src/services/memberResolution.ts` — dual-key fallback on primary miss (§E): look up active migration (`PROCESSING|REKEY_COMPLETE_IN_GRACE`), reverse-lookup mapping by `oldExternalId`, resolve to mapped member, record old-key usage (R19/R32/R33); skip shape validation when caller id matches an `oldExternalId`; post-grace helpful-error hook (§M.4 — `410 IDENTIFIER_DEPRECATED_AFTER_MIGRATION` on matched retained mapping). Must thread an `ingress` source from each caller.
- [ ] `apps/api/src/services/migrationReconciliation.ts` (new) — LWW merge, no hard-delete (R20/R21), re-parent late old-key enrollments into mapping with `appliedAt=now`, idempotent. Used by worker end-sweep + grace-expiry sweep.
- [ ] Old-key usage recorder (`recordOldKeyUsage(migrationId, brandId, ingress)`) — upsert day-bucket counter (B.3). Co-locate with memberResolution or a small `migrationOldKeyUsage.ts`.

### Group 3 — Re-key worker + queue + grace sweep (RFC §D, §G)
- [ ] `apps/worker/src/processors/memberIdentifierMigration.ts` (new) — chunked (200) per-member `$transaction` re-key (R16), brandId-scoped; per-member failure isolates (no batch abort); terminal flip-kind only on zero failures (R17/R23); resumable cursor on `appliedAt IS NULL`; emit audit on transitions (§I); enqueue reconciliation on success.
- [ ] `apps/worker/src/processors/graceExpirySweep.ts` (new) — repeatable job: `REKEY_COMPLETE_IN_GRACE → GRACE_EXPIRED` when `now > graceExpiresAt`; final reconciliation sweep.
- [ ] `apps/api/src/queues/bullmq.ts` — add `QUEUES.MEMBER_IDENTIFIER_MIGRATION`; `enqueueMemberIdentifierMigration`; `enqueueReconciliation`; register `grace-expiry-sweep` repeatable (15-min). Inline-mode support.
- [ ] `apps/worker/src/index.ts` — wire new Worker(s).

### Group 4 — API routes (RFC §C, §H)
- [ ] `apps/api/src/routes/adminBrandMigrations.ts` (new module) — `GET /preflight-context` (R28/R29/R30, §C.2 + §H impact preview), `POST /migrations` (R1–R3; 409 if active), `POST /:id/mapping` (R4–R12, fast-path|csv), `GET /:id` (R7/R18/R22/R34 poll), `POST /:id/start` (R13/R14/R15 attestation + enqueue), `POST /:id/extend-grace` (R34, no attestation), `POST /:id/cancel` (R23 pre-write only), `GET /v1/admin/brand/usage-warnings` (R37). All admin-only, brandId-scoped (R27), audited.
- [ ] `apps/api/src/app.ts` — register the new route module under `/v1`.
- [ ] `apps/api/src/routes/admin-brand-profile.ts` — replace blanket `409 MEMBER_IDENTIFIER_KIND_LOCKED` (322-335) with active-migration-aware `redirectTo` (R1/R2); radio-toggle still rejected.
- [ ] Thread `ingress` into the 3 honor-kind callers: `public.ts:457` (PUBLIC_SURVEY_RESPOND), `members.ts:106` (API_MEMBERS_ENROLL), `distributionBatches.ts:320` (DISTRIBUTION_BATCH) so dual-key telemetry attributes correctly.

### Group 5 — Web UI (RFC §J; mock scenes 1–8 + 2A/2B/7B/7Bw/7C)
- [ ] `…/organization/components/sections/MemberIdentificationSection.tsx` — replace dead `mailto:` with "Switch identifier method" link (R1); render grace panels inline when active migration in grace/expired (R34).
- [ ] `…/organization/migrations/page.tsx` — list past + current migrations.
- [ ] `…/organization/migrations/new/page.tsx` + `_components/WizardChooseAndPrepare.tsx` (2A/2B/none), `WizardUploadValidate.tsx` (3/4), `WizardConfirm.tsx` (5: impact preview + attestation).
- [ ] `…/organization/migrations/[id]/page.tsx` (status switch) + `_components/`: `MigrationProgressPanel.tsx` (6), `MigrationCompletionSummary.tsx` (7), `GraceStatusPanel.tsx` (7B/7Bw), `GraceExpiredPanel.tsx` (7C), `MigrationFailedPanel.tsx` (8). Polling via `usePollingQuery`.
- [ ] `apps/web/src/app/(admin)/layout.tsx` + `UsageWarningBanner` — brand-wide pre-expiry banner driven by `/usage-warnings` (R37).
- [ ] CSV template download (R4) — client trigger hitting a template endpoint or building CSV from preflight-context rows.

### Group 6 — Tests (P1: unit + integration; + required concurrency)
- [ ] `packages/config/src/test-utils/factories/` — `createMemberIdentifierMigration`, `createMigrationMapping` (Rule 8); export from index.
- [ ] Unit: `migrationPreflight.test.ts`, `migrationReconciliation.test.ts`, `memberResolution.dual-key.test.ts` (extends, doesn't mutate existing), worker `memberIdentifierMigration.test.ts`, route-handler unit tests (happy/409/403/422).
- [ ] Integration (DB): e2e migration happy path; failure-rollback (R17/R23); dual-key during PROCESSING (R19); reconciliation of old-key enroll in window (R20); audit row (R25); cross-tenant reject (R27); erased+soft-deleted excluded (R26); grace expiry reject (R35 a/b); `/v1/events` unaffected (§M.2); R36 admin-excluded + clerkUserId preserved.
- [ ] **Concurrency integration** (required): inbound enroll/respond on old+new key while worker mid-batch → no stranded/duplicate (R19/R20).
- [ ] (Stretch, not mandatory P1) E2E Playwright wizard happy path.

---

## Decisions / deferrals (durable)
- Out of scope (RFC §A): `surveyImport.ts` EMAIL-hardcoding fix (A1) — safe for →EMAIL slice; PHONE adapter + E.164. Do NOT touch.
- Paths 5–6 (external-signal, CRM webhooks) match-only, no action this slice (§M.5).
- Architecture-doc additions (3 items) deferred to `implement-architecture-update` / `work-completion` per RFC Architecture Analysis.
- Competitor config (Smile.io/Yotpo/Annex) — deferred to user approval; not committed here.
- Phantom-member open question (RFC Confidence Level) — keep member (no data loss), remains old-shape until brand supplies email; not auto-resolved in Slice 1.

## Phase N/A markers (Rule 24 — record, don't silently drop)
- `implement-repro` — N/A: this is a feature, not a bug. No failing-repro-first required; tests written alongside code (`implement-tests`).
