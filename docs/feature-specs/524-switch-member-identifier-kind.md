# Feature: Switch Member Identifier Kind — Slice 1 (Customer ID → Email)

Issue: #524
Owner: manohar.madhira@outlook.com (Claude)

> **Scope of this spec.** Issue #524 is the capability epic for switching a brand's member identifier kind after members exist, across all six directed pairs, behind a single direction-agnostic engine. **This spec covers Slice 1 only: `CUSTOMER_ID → EMAIL`.** The engine is specified to be direction-agnostic, but only this one lane is enabled and validated here. Remaining directions (and the bulk-import EMAIL-hardcoding fix they depend on) are deferred to later slices per the issue's phased-delivery plan.

## Customer

A brand admin (e.g., "Acme") who onboarded CustomerEQ keying members by their own **Customer ID** (their application's internal account key), has since enrolled members, and now needs members identified by **email** instead — because they're adding email surveys, want case-insensitive matching, or are consolidating on email as their cross-system key.

## Customer's Desired Outcome

The admin can switch their organization's member identifier method from Customer ID to Email themselves, with confidence that every existing member is carried over, that feedback arriving while the switch runs is not lost, and that nothing is silently corrupted — without filing a support ticket and waiting on a manual back-office migration.

## Customer Problem being solved

The identifier method is chosen at onboarding and **hard-locks the instant the first member is enrolled**. Today the only "escape hatch" is a `mailto:` "Contact support to request a managed migration" link in Organization Settings — and the managed-migration capability behind it **does not exist**. A brand that outgrows its initial Customer ID choice is stuck: it cannot re-key members, and naively changing the setting would orphan every existing member (their stored key no longer matches what inbound data supplies) and break member resolution. This blocks a real, recurring customer need with no self-serve path.

## User Experience that will solve the problem

UI mock (all scenes): [`docs/feature-specs/mocks/524-switch-member-identifier-kind.html`](mocks/524-switch-member-identifier-kind.html)

The flow lives in **Organization Settings → Member identification** (`/admin/settings/organization`), extending the existing locked-state panel. Steps:

1. **Entry (Scene 1).** When members exist, the locked panel replaces the dead support `mailto:` with a **"Switch identifier method"** button. The radios stay disabled — the kind is never changed by toggling a radio; the guided flow is the only path.
2. **Step 1 — Choose & prepare.** A 3-step wizard. The admin picks the new method (Slice 1: only **Email** is selectable; Phone is shown disabled, "available in a subsequent release"). Step 1 is **data-aware** and branches on what's already populated in `Member.email` (a nullable PII sidecar per #231: a `CUSTOMER_ID` brand may have email on file for some, all, or none of its members — e.g., a brand that uses managed email sends will have email captured at enrollment):
   - **All members have a valid, unique email on file (Scene 2A — fast path):** no CSV upload required; the existing emails are used directly. An "Upload override CSV" affordance is retained for the case where the admin wants to correct/update some emails before flipping.
   - **Some members have email (Scene 2B — partial coverage):** the mapping template is pre-filled with each member's existing email where present; the admin only fills in the missing rows (and may override existing values if desired).
   - **No members have email:** the template downloads with the `new_email` column blank; the admin fills every row.
3. **Step 2 — Upload & validate (Scenes 3 & 4).** The admin uploads the filled CSV. Validation runs **before any write** and reports counts. If clear, "Next" enables (Scene 3). If there are blocking issues — an unmapped member, a collision (two IDs → same email), or an invalid email — the flow lists the offending rows and blocks until fixed (Scene 4). Members are untouched during validation.
4. **Step 3 — Confirm (Scene 5).** Two things happen here: (a) the **impact preview** lists the brand-side integration surfaces that have used the current identifier in the last 30 days so the admin sees what they will need to update post-migration (R30); and (b) an **attestation gate** (reusing the consent-mode attestation pattern): a checkbox confirming the admin has permission to use the emails and understands the re-key is not auto-undoable. The migrate button is danger-styled and disabled until checked.
5. **Migrating (Scene 6).** Live progress (total / migrated / remaining / failed), refreshed on a fixed cadence via the shared `usePollingQuery` hook. A live note tells the admin that feedback arriving now is matched on the old Customer ID and reconciled automatically — so they need not pause their integration.
6. **Complete (Scene 7).** A summary reports members re-keyed, records reconciled during the window, and failures; the method now shows **Email — In use**; the change is in the audit log.
7. **Failed (Scene 8).** A failure during the re-key rolls back: the method stays `CUSTOMER_ID` (no partial flip), members are untouched, per-member errors are shown, and the admin can retry.

**Brand-side cutover lifecycle.** A migration is not just a database operation — the brand has integrations that emit the *old* identifier (host-application embedded survey URLs `?member_id=<customer_id>`, backend `/v1/events` POSTs, Custom List distribution CSVs, outbound webhook subscriptions). These must be cut over on the brand's side. The flow makes that work explicit and observable across three phases:

- **Before confirm — impact preview (extends Scene 5).** Driven by real usage signals from the last 30 days (which API keys, routes, channels, and audience modes have actually been used), the confirm step lists the integration surfaces the brand will need to update so the admin sees the work commitment *before* they commit.
- **After flip — grace window (Scene 7B).** Once `memberIdentifierKind` flips to `EMAIL`, dual-key resolution stays on for a configurable grace window (default **30 days**, range **7–90 days**). Inbound requests keyed by the old `customer_id` continue to resolve, and the system records per-ingress old-key usage. The Member identification section surfaces a grace-status panel showing the deadline + per-ingress old-key activity + an "extend grace" action.
- **Grace expiry (Scene 7C).** When the deadline passes, old-key inbound requests are rejected with a specific error code; the admin sees the cutover-complete state.

**Design Standards Applied.** Mock uses the Organization Settings design system (`docs/feature-specs/mocks/277-organization-settings.html`) — same `.section`/`.radio-card`/`.locked-notice`/attestation-modal components — because the entry point lives in that surface. The upload + batch-progress + error-row patterns mirror the historical-import flow (`docs/feature-specs/mocks/262-import-flow.html`). Progress polling reuses `apps/web/src/lib/hooks/usePollingQuery.ts` (architecture.md §3.1), the same hook used for managed-email send progress. No new UI primitives are introduced.

## Functional Requirements

Requirements are SHALL-style, one behavior per line, tagged for traceability. Acceptance criteria are in Given/When/Then form.

### Entry & gating
- **R1** — When `Member.count(brandId) > 0` and `memberIdentifierKind = CUSTOMER_ID`, the Member identification section SHALL present a "Switch identifier method" action in place of the support `mailto:` link.
- **R2** — The identifier radios SHALL remain non-editable while members exist; the guided migration flow SHALL be the only way to change the kind once members exist.
- **R3** — Slice 1 SHALL offer only `EMAIL` as a selectable target; other targets SHALL render as unavailable and SHALL NOT be selectable.

### Mapping intake
- **R4** — The flow SHALL provide a downloadable mapping template CSV with columns `customer_id` and `new_email`, with one row per existing member; the `customer_id` column SHALL be pre-filled with each member's current `customer_id`, and the `new_email` column SHALL be pre-filled with each member's existing `Member.email` where populated (blank otherwise).
- **R5** — The flow SHALL accept a CSV upload of `customer_id → new_email` rows scoped to the authenticated brand.
- **R28** — When every existing member has a populated `Member.email` and those values pass the same pre-flight checks the uploaded CSV would face (R9 collisions, R10 email shape), the flow SHALL offer a **fast path** that uses the existing emails as the mapping source without requiring a CSV upload, while still exposing an "Upload override CSV" affordance so the admin can correct or update emails before the flip.
- **R29** — When the fast-path source data (existing `Member.email`) fails any pre-flight check, the fast-path action SHALL be unavailable and the admin SHALL be shown per-row issues and offered the CSV-upload path (R5) to resolve them.

### Pre-flight validation (no writes)
- **R6** — Validation SHALL complete before any member row is written (pre-flight).
- **R7** — Validation SHALL report: total rows, members matched, unmapped members, and total blocking-issue count.
- **R8** — Validation SHALL flag as a blocking issue any existing member that has no row in the uploaded file (full-coverage requirement — no mixed-kind end state).
- **R9** — Validation SHALL flag as a blocking issue any two rows whose `new_email` normalizes to the same value (collision against `@@unique([brandId, externalId])`).
- **R10** — Validation SHALL flag as a blocking issue any `new_email` that is not a valid email shape.
- **R11** — The migration SHALL NOT be startable while any blocking issue exists.
- **R12** — When blocking issues exist, the flow SHALL display per-row detail (row number where applicable, `customer_id`, `new_email`, and a plain-language reason).

### Confirmation
- **R13** — Starting the migration SHALL require an explicit attestation (permission to use the emails + acknowledgement that the re-key cannot be automatically undone), recorded with the admin identity and timestamp.
- **R14** — The "migrate" action SHALL be disabled until the attestation is given.

### Execution & progress
- **R15** — The re-key SHALL run asynchronously off the request hot path so the hero event-ingestion SLA (Rule 2) is unaffected.
- **R16** — For each mapped member, the re-key SHALL set `externalId` to the normalized (lowercased, trimmed) `new_email` and populate the `email` PII sidecar, within a `brandId`-scoped database transaction (Rule 7).
- **R17** — `Brand.memberIdentifierKind` SHALL flip to `EMAIL` only after the migration reaches a terminal success state (all mapped members re-keyed with zero unresolved failures).
- **R18** — While a migration is active, the section SHALL display live progress — total, migrated, remaining, failed — refreshed on a fixed cadence.

### Catch-up & reconciliation (during re-key)
- **R19** — While the re-key worker is processing (before the kind flip), inbound member resolution SHALL resolve an existing member whether the caller supplies the old (`customer_id`) or the new (`email`) identifier.
- **R20** — Any member newly enrolled under the old `customer_id` between the start of the re-key and the end of the post-flip grace window (R31) SHALL be reconciled into the migrated member set, leaving no stranded or duplicate member.
- **R21** — Reconciliation SHALL apply last-write-wins on non-identifier profile fields (consistent with existing `resolveOrEnrollMember` semantics) and SHALL NOT hard-delete any member.

### Brand-side cutover
- **R30** — Before the admin confirms the migration, the flow SHALL present a **data-driven impact preview** listing the integration surfaces that have used the current identifier in the last 30 days (e.g., embedded-form survey responses, API keys posting `/v1/events`, manual API enrollments, Custom List distribution batches, active outbound webhook subscriptions), each with a last-seen-at timestamp, so the admin sees what brand-side work is required before they commit.
- **R31** — After `Brand.memberIdentifierKind` flips, the system SHALL enter a **grace window** during which dual-key member resolution stays on. The window SHALL default to **30 days** and SHALL be configurable per migration in the range **7–90 days**.
- **R32** — During the grace window, inbound member resolution SHALL accept the old (`customer_id`) or the new (`email`) identifier on every ingress path, extending R19's dual-key behavior past the kind flip until the grace deadline.
- **R33** — During the grace window, the system SHALL record old-key resolution events per ingress source (e.g., `/v1/events`, public survey respond, manual API enroll, distribution batch, outbound webhook echo) with brand-scoped counts.
- **R34** — While a grace window is active, the Organization Settings → Member identification section SHALL display a **grace-status panel** showing the grace deadline, per-ingress old-key usage counts, and an action to extend the deadline within the configured maximum (R31's 90-day cap).
- **R35** — After the grace deadline passes, inbound requests supplying the old `customer_id` SHALL be rejected with a specific error code (`IDENTIFIER_DEPRECATED_AFTER_MIGRATION`) and the rejection SHALL be observable in the brand's usage logs.

### Completion & failure
- **R22** — On success, the flow SHALL show a summary including members re-keyed, records reconciled during the window, and failure count.
- **R23** — On failure during the re-key, the batch SHALL roll back such that `memberIdentifierKind` remains `CUSTOMER_ID` (no partial flip) and members remain on their original key.
- **R24** — On failure, the flow SHALL show per-member errors and SHALL allow the admin to retry.

### Audit, compliance & isolation
- **R25** — The migration SHALL be recorded in the audit log capturing before/after kind, member counts, attesting admin, and timestamp.
- **R26** — The re-key SHALL preserve `consentGivenAt`, `consentVersion`, erasure flags (`erased`, `deletedAt`), point balances, and all member-linked history (which joins on the stable `Member.id`, not `externalId`).
- **R27** — All migration operations (template, upload, validation, re-key, reconciliation) SHALL be tenant-scoped by `brandId` and SHALL only affect the authenticated brand's members.

### Acceptance criteria (selected)
- **R28** — *Given* a `CUSTOMER_ID` brand where all 1,284 members have a populated, valid, unique `Member.email`, *when* the admin opens the migration wizard, *then* a "Use existing emails" fast path is offered and the admin can advance to the confirmation step without uploading a CSV; an "Upload override CSV" affordance is still present.
- **R4** — *Given* a `CUSTOMER_ID` brand where 845 of 1,284 members have a populated `Member.email`, *when* the admin downloads the mapping template, *then* 845 rows are pre-filled in the `new_email` column with each member's existing email and 439 rows are blank.
- **R29** — *Given* a `CUSTOMER_ID` brand where two members share the same `Member.email` (collision in the existing PII sidecar), *when* the wizard opens, *then* the fast-path CTA is disabled, the collisions are listed per row, and the admin is offered the upload-override path to resolve them.
- **R8/R11** — *Given* a brand with 1,284 members, *when* the admin uploads a CSV with 1,283 rows (one member missing), *then* validation reports 1 unmapped member and the migrate action is blocked.
- **R9** — *Given* an uploaded CSV where rows 88 and 312 both map to `jane@acme.com`, *when* validation runs, *then* both rows are flagged as a collision and migration is blocked.
- **R17/R23** — *Given* a migration that fails on member 512 of 1,284, *when* the batch aborts, *then* `memberIdentifierKind` is still `CUSTOMER_ID`, member 1 is still keyed by its `customer_id`, and the batch status is `failed`.
- **R19** — *Given* an active migration, *when* a survey response arrives keyed by a member's old `customer_id`, *then* the response resolves to that member (whether or not that member has already been re-keyed).
- **R20** — *Given* a brand-new responder enrolls under a `customer_id` during the window, *when* the migration completes, *then* that member is present exactly once and identifiable by the new scheme, with no duplicate.
- **R30** — *Given* an embedded-form survey response came through in the last 30 days, *when* the admin opens the confirm step, *then* the impact preview lists "Embedded survey forms — last response 3 days ago — your host application's `?member_id=` parameter needs to be updated to pass email."
- **R31/R32** — *Given* a migration whose kind flip completed 5 days ago, *when* a backend POSTs `/v1/events` with `memberId: cust_00012` (the old identifier), *then* the request resolves to the migrated member and is not rejected.
- **R33/R34** — *Given* a brand 10 days into the grace window, *when* the admin views the Member identification section, *then* it shows the grace deadline, the per-ingress old-key usage (e.g., "247 events via `/v1/events`, 0 via embedded forms"), and an "Extend grace window" action.
- **R35** — *Given* a grace window that expired yesterday, *when* a backend POSTs `/v1/events` with the old `cust_00012`, *then* the request is rejected with error code `IDENTIFIER_DEPRECATED_AFTER_MIGRATION` and the response includes the new identifier shape in guidance.

## Error States
- **Fast-path source data fails pre-flight** — one or more existing `Member.email` values fail shape validation or collide → fast-path CTA is unavailable; per-row issues are shown; the admin can either fix `Member.email` upstream (in their integration) or use the upload-override path (R29).
- **Empty / malformed CSV** — missing required columns, empty file, or non-CSV upload → rejected with a clear message; nothing written (R6).
- **Unmapped member (coverage drift)** — a member enrolled between template download and upload now has no row → blocking unmapped-member issue (R8); admin re-downloads/edits and re-uploads.
- **Collision** — two Customer IDs map to the same email (R9).
- **Invalid email** — `new_email` fails shape validation (R10).
- **Migration already in progress** — starting a second migration for the same brand SHALL be refused while one is active.
- **Worker failure mid-batch** — transaction rollback, no partial flip, retryable (R23/R24).
- **Integrations still on the old key after grace expiry** — inbound requests supplying the old `customer_id` after the grace deadline are rejected with `IDENTIFIER_DEPRECATED_AFTER_MIGRATION`; the grace-status panel surfaces post-expiry rejections so the admin can finish cutting over (R35).

## Compliance Requirements

No formal regulations are configured in `fraim/config.json`; the following are **inferred from project context** (project Rule 13 — GDPR/CCPA baked in) because the feature mutates PII (member identifiers).

- **Lawful basis for new PII.** Email becomes a stored identifier + PII for members who previously had only a Customer ID. R13's attestation captures the admin's confirmation that the brand has the right to use these emails. The migration does not solicit new consent from members; consent recorded at original enrollment is preserved (R26).
- **No erasure regression.** The re-key is an `UPDATE`, never a delete (R21). Soft-delete (`deletedAt`) and erasure (`erased`) flags are preserved (R26); the existing GDPR erasure job — which zeroes identifier PII — must continue to cover the now-populated `email` sidecar and `externalId` (verified in the validation plan).
- **Tenant isolation.** All operations are `brandId`-scoped (R27); one brand's mapping upload can never read or write another brand's members (Rule 6).
- **Auditability.** The change is recorded with before/after kind, counts, attesting admin, and timestamp (R25).

## Validation Plan
- **Unit** — CSV parsing/coverage check; collision detection; email-shape validation; full-coverage gate (R6–R12).
- **Integration (needs DB)** — re-key transaction re-keys `externalId` + sets `email` and preserves consent/erasure/balances/history (R16, R26); kind flips only on terminal success (R17); failure mid-batch rolls back with no partial flip (R23); dual-key resolution during an active migration (R19); reconciliation of a member enrolled on the old key during the window (R20); audit row written (R25); cross-tenant upload rejected (R27).
- **E2E (Playwright)** — full wizard: entry → choose → upload (clean and error variants) → attest → progress → complete; and the failed-rollback path.
- **Concurrency** — a scripted run that fires inbound enroll/survey-respond on the old key while the re-key worker is mid-batch, asserting no stranded/duplicate members afterward (R19/R20).
- **Compliance validation** — run the erasure job against a migrated member and assert the new `email` sidecar + `externalId` are zeroed; assert audit row contents (R25/R26).
- **Test coverage tier** — pending priority confirmation; treat as **P1** (unit + integration required) unless the team sets P0 (adds mandatory E2E). The concurrency test is required regardless because R19/R20 are the highest-risk behaviors.

## Alternatives

| Alternative | Why discard? |
|---|---|
| Keep the support `mailto:` and do migrations manually in the back office | The capability behind the link doesn't exist; manual SQL re-keys are unauditable, error-prone, and don't handle data arriving mid-migration — exactly the failure modes this feature prevents. |
| Let the admin just change the radio and re-key lazily on next contact | Leaves the brand in a mixed-kind state where existing members are stranded under the old key; inbound data shape-validation rejects or creates duplicates. Violates the single-canonical-key invariant. |
| Derive the new identifier automatically (no upload) | Impossible — email cannot be derived from an opaque Customer ID. A brand-supplied mapping is unavoidable for this direction. |
| Build a one-off `CUSTOMER_ID → EMAIL` migrator, not a general engine | ~90% of the work (batch model, worker, catch-up, reconciliation, UI, audit) is identical across all directed pairs; a one-off would be thrown away when later slices land. Spec mandates a direction-agnostic engine with one lane enabled. |

## Competitive Analysis

> `fraim/config.json` has no `competitors` configured. Competitors below were identified during research; see "Config note" at the end of this section.

The decisive structural difference: mainstream loyalty/CX platforms **do not let the brand choose the identifier *kind*** — they hard-wire **email** as the unique identifier and assume an external e-commerce platform (Shopify/BigCommerce) owns customer identity. Identity changes and merges are therefore done *in that source system* and synced down; there is no concept of "switch from Customer ID to Email" because Customer ID was never a first-class option. CustomerEQ is different: identifier kind (`EMAIL | PHONE | CUSTOMER_ID`) is a first-class brand decision, which both creates the need for a switch and makes a native one possible.

| Competitor | How they handle identity change | Strengths | Weaknesses vs. us |
|---|---|---|---|
| **Smile.io** | Email is the primary identifier. Name/email edits are made in Shopify/BigCommerce admin and applied on next sync. Account merges follow Shopify's merge — but Smile "doesn't currently integrate with Shopify's customer merge," so **loyalty points must be merged manually**. Imports key on `email`. [1][2] | Simple when an external source of truth exists | No brand-chosen identifier kind; no self-serve key switch; merges leak points unless hand-fixed; no mid-migration catch-up |
| **Yotpo Loyalty & Referrals** | Email is the unique identifier used to recognize returning customers and share balances across stores. Merges are done **on the e-commerce platform** and synced. Platform migration is a **Yotpo-team-led import**, not self-serve. [3][4][5] | Merge consolidates points/tier/history cleanly when done via Shopify | Identity owned by source platform; no customer-run identifier-kind switch; migration is vendor-assisted, not progress-tracked + catch-up-safe |
| **Annex Cloud** (enterprise) | Professional-services / support-led data migration | Handles complex enterprise data | Slow, billable, manual; no customer-visible progress or catch-up guarantees |

**Our differentiation (3 pillars):**
1. **Identifier kind is a first-class, switchable choice** — not hard-wired to email or to a source platform's record.
2. **Self-serve, validated, progress-tracked** — pre-flight collision/coverage/shape checks, a live progress view, and a per-row error report turn a support escalation into a customer-run, audited, idempotent operation.
3. **Catch-up window** — inbound feedback arriving on the old identifier *during* the migration is resolved and reconciled automatically (R19/R20), so brands don't have to freeze their integration. None of the above offer this.

**Config note:** per the competitor-analysis phase, these (Smile.io, Yotpo, Annex Cloud) should be added to `fraim/config.json` `competitors`. Deferred to user approval rather than committed unilaterally — flagged at hand-back.

**Research sources** (accessed 2026-05-27):
- [1] Smile.io — Manage Customers: https://help.smile.io/en/articles/11793874-manage-customers
- [2] Smile.io — Switching to Smile from another program: https://help.smile.io/en/articles/4036254-switching-to-smile-from-another-program
- [3] Yotpo — Customer Management Actions: https://support.yotpo.com/docs/customer-management-actions
- [4] Yotpo — Sharing Customer Points Across Multiple Stores: https://support.yotpo.com/docs/sharing-customer-points-across-multiple-stores-multi-store
- [5] Yotpo — Loyalty & Referrals: Migrating Platforms: https://support.yotpo.com/docs/loyalty-referrals-migrating-platforms

## Open Questions
- **Priority / test tier** — P1 (unit+integration) assumed; confirm whether P0 (adds mandatory E2E) given it's a customer-blocking gap.
- **Rollback after success** — out of scope for Slice 1 (the attestation states it's not auto-undoable). Confirm we don't need a post-success "undo" before GA.
- **Coverage policy** — spec requires 100% member coverage before flip (R8). Confirm we don't want a "quarantine unmapped members" alternative (rejected here because it leaves a mixed-kind state).
- **Grace window defaults** — proposed 30-day default, 7–90 day configurable range (R31). Confirm or set different bounds. Also: should new members enrolling under the *old* `customer_id` during grace be accepted (auto-mapped via the retained migration mapping where possible, otherwise quarantined and surfaced in the grace-status panel) or rejected outright? Spec assumes accepted (R20 extended through grace); confirm.
- **Grace extension policy** — R34 lets the admin extend within the configured max. Confirm whether extension should require attestation (consistent with R13) or be a simple action.
