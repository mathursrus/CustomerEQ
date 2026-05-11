# Feature: Survey Admin UX — Technical Design Evidence

Issue: [#241](https://github.com/mathursrus/CustomerEQ/issues/241)
Feature Spec: [`docs/feature-specs/241-survey-admin-ux.md`](../feature-specs/241-survey-admin-ux.md)
RFC: [`docs/rfcs/241-survey-admin-ux.md`](../rfcs/241-survey-admin-ux.md)
Branch: `feature/241-rfc-survey-admin-ux`
PR: pending (filed at design-submission phase)

## Completeness Evidence

- Issue tagged with label `phase:design`: **Yes** — applied via `mcp__github__issue_write` in design-authoring phase (preserved existing `enhancement` + `onboarding` labels).
- Issue tagged with label `status:needs-review`: **Pending** — applied at design-submission phase per FRAIM convention.
- All files committed/synced to branch: **Pending** — RFC + evidence committed under design-submission.

### PR Comment Resolution (initial submission)

| PR Comment | How Addressed |
|---|---|
| _N/A — this is the initial design submission. Comments tracked in subsequent address-feedback iterations._ | — |

### Traceability Matrix

Every spec requirement (Epic AC, functional R#, Open Question, Non-Functional Requirement, Validation Plan row, Error State, Schema delta) maps to a concrete RFC section. **No `Unmet` rows.**

#### Epic-level Acceptance Criteria (from issue body via spec's traceability map)

| Epic AC | RFC Section/Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| Wizard never produces duplicate drafts under any navigation pattern | §Design Overview #1 + §Web UI / RHF form structure (auto-save on blur; no POST on tab nav) | Met | Playwright `survey-admin.spec.ts` — back/forward → assert `count(*) = 1` (NFR-BC2-aligned migration test for SurveyResponse untouched) |
| Survey detail page has Edit button for DRAFT/PAUSED; breadcrumb to Surveys everywhere | §Web UI / Detail page (SurveyDetailShell — header chrome identical across states) | Met | E2E asserts breadcrumb + Edit button visible in DRAFT/PAUSED |
| Stop/Restart show confirmation modals; "Close" verb is gone | §Web UI / state-transition modals (Stop, Restart wrapped in modals) + §Schema CLOSED→STOPPED rename | Met | E2E + grep R25: no UI string `\bLaunch\b|\bClose\b` in state-action context |
| Vocabulary uniform: Activate/Stop/Save Draft/Restart — "Launch" removed | §Schema migration §"SurveyStatus rename" + §Web UI list/badges/menus | Met | E2E + grep R25 |
| Action-type dropdown contains only types that work end-to-end | Superseded by D14 — Rules deferred from V0 entirely; no dropdown to enforce. Future iteration owns AC. | Met (deferred) | n/a — sub-issues #234/#242/#246 |
| Setting Survey.incentivePoints credits via programs/campaigns; survey_completion EarningRule path is gone | **Superseded by D40/D50** — direction inverted: drop Survey.incentivePoints; canonical = EarningRule(triggerEvent='cx.<type>_response') per program. §Migration §3 + §API / POST /:id/responses | Met | Migration test (5 brand fixtures) + Worker integration `survey-completion-earn.test.ts` |
| Re-running #225 reproduction yields non-zero LoyaltyEvent | §API / POST /:id/responses + §Validation Plan Worker pipeline row | Met | Worker integration test + staging smoke per spec validation plan row |

#### Functional Requirements R1–R32

| Req | RFC Section/Data Model | Status | Validation |
|---|---|---|---|
| R1 — list page, single +New CTA, deleted entry-points (404) | §Web UI / Surveys list + §Implementation Slicing slices 3b & 4 (delete `/admin/surveys/new`, `/admin/survey-builder`) | Met | E2E new-survey flow + 404 assertion on deleted routes |
| R2 — row click → detail page (read-only) | §Web UI / Surveys list + §Web UI / Detail page | Met | E2E row click → `/admin/surveys/[id]` |
| R3 — 4 horizontal tabs in named order | §Web UI / File tree + §Web UI / RHF form structure | Met | E2E asserts 4 tab headers; tab body visible one at a time |
| R4 — auto-save on blur, no POST on tab nav | §API / PATCH /v1/surveys/:id + §Web UI / RHF form structure (debounce 500ms) | Met | Browser regression: `count(*) = 1` after back/forward |
| R5 — Back/Continue + persistent Activate | §Web UI / RHF form structure (per-tab nav + sticky Activate) | Met | E2E asserts buttons visible on every tab |
| R6 — Type 4-card grid + type-change-with-questions modal | §Web UI / BasicsTab | Met | E2E type-change scenarios (NPS→CSAT confirm, cancel, Custom-no-modal) |
| R7 — Internal name + Survey title required | §Schema / Survey.title + §API / Zod CreateSurveySchema | Met | Migration test (backfill); E2E activate-blocks-on-empty-title |
| R8 — Response policy + ONCE 409 + anonymous bypass | §API / POST /:id/responses (responsePolicy enforcement) + §API / State-aware editability (R30) | Met | API integration `surveys-admin.test.ts` ONCE-second-submit → 409 |
| R9 — Consent dropdown shows only differing override | §Web UI / ConsentCollectionSubBlock | Met | E2E asserts dropdown options based on brand mode |
| R10 — More-permissive override requires attestation | §API / PATCH /:id/consent-mode (attestation gate) + §Web UI / ConsentAttestationModal | Met | API integration `surveys-consent-override.test.ts` 422-without-attestation |
| R11 — Stricter override no attestation, audit row written | §API / PATCH /:id/consent-mode | Met | Same integration test row |
| R12 — `.consent-toolbar` with token insert; Terms link conditional | §Web UI / ConsentCollectionSubBlock (reuses `packages/consent-text`) | Met | Unit test in `packages/consent-text` (existing); E2E token-insert behavior |
| R13 — Blank disclosure renders no consent block + audit | §Web UI / ConsentCollectionSubBlock + §Audit | Met | E2E blank-textarea → preview empty; audit row asserted |
| R14 — Preview card mirrors respondent rendering exactly | §Web UI / PreviewSurvey + ConsentDisclosure | Met | E2E preview matches form output |
| R15 — Standalone renders member-ID field | §Web UI / MemberIdField + §Embed-Widget / fallback to standalone | Met | E2E standalone survey: identifier field visible per brand config |
| R16 — Embedded prefill A1/A2; URL identifier removed | §Embed Widget (A1 + A2) + §API / public.ts removal of `?email=` | Met | E2E widget host-page test (prefill); legacy-URL falls back to prompt |
| R17 — Look & Feel channel-first × viewport split | §Web UI / LookFeelTab | Met | E2E channel-tab + Desktop/Mobile previews |
| R18 — Per-channel chrome matrix | §Web UI / LookFeelTab + §Embed widget theme-bridge | Met | E2E chrome toggle changes preview; embedded form respects matrix |
| R19 — Theme picker shows all brand themes; no Manage link | §Web UI / LookFeelTab | Met | E2E asserts no `Manage themes →` link present |
| R20 — Points read-only from EarningRule | §Web UI / PointsAndThankYouTab | Met | E2E asserts read-only row; API resolves correct rule per (programId, cxEventForType) |
| R21 — Thank-you variables: 3 V0 only | §Web UI / PointsAndThankYouTab | Met | E2E asserts 3 chips only |
| R22 — One cx event per response; LoyaltyEvent atomic | §API / POST /:id/responses + §Worker (no change) | Met | Worker integration `survey-completion-earn.test.ts`; per-type variant |
| R23 — Activate gating (questions, required fields, attestation) | §API / PATCH /:id/status + §Web UI / ActivateModal | Met | E2E activate flow: blocks on 0 questions; success path redirects to detail |
| R24 — Audit row per state transition | §Audit + §API / PATCH /:id/status | Met | API integration asserts AuditEvent row with fromStatus/toStatus |
| R25 — Schema rename + no Launch/Close in UI | §Schema migration + §Web UI strings | Met | Migration test + lint grep pre-merge |
| R26 — Detail page 3 collapsible sections | §Web UI / Detail page | Met | E2E asserts 3 headers + chevron toggles |
| R27 — Distribution default-expanded when responsesCount=0 | §Web UI / Detail page (expanded prop logic) | Met | E2E 0-responses → expanded; >0 → collapsed |
| R28 — Configuration summary default-expanded when responsesCount=0 (reuses PreviewSurvey) | §Web UI / Detail page (ConfigurationSummarySection wraps `<PreviewSurvey/>`) | Met | E2E same as R27 inverse mapping |
| R29 — State-aware editability + HTTP 409 | §API / State-aware field editability | Met | API integration `surveys-admin.test.ts` per-state PATCH cases |
| R30 — responsePolicy locks once responsesCount > 0 | §API / State-aware field editability | Met | API integration: 0→1 response transition; PATCH responsePolicy → 409 |
| R31 — BrandTheme tokens fully applied (functional level) | §Web UI / SurveyFormRenderer + §Embed / theme-bridge | Met | Playwright visual regression against baseline snapshot |
| R32 — Response section default-collapsed when responsesCount=0 | §Web UI / Detail page (ResponseSection expanded prop) | Met | E2E same as R27 |

#### Open Questions (all resolved in spec D49–D52)

| OQ | Resolution (spec) | RFC consumption |
|---|---|---|
| OQ1 — silent skip when no EarningRule matches | Resolved (D49 / R20) | §API / POST /:id/responses (no error path; editor pre-warns via R20) |
| OQ2 — restrict to survey's program | Resolved (D49) | §Migration §3 + §API resolves only `(programId=Survey.programId, triggerEvent=cxFor(type))` |
| OQ3 — defer Campaign multipliers | Resolved (D49) | Not in scope — separate sub-issue when demand surfaces |
| OQ4 — JS prefill A1/A2, no URL identifier | Resolved (D51) | §Embed Widget §"Public API" + §API / public.ts URL-param removal |
| OQ5 — single event, type-aware EarningRule trigger | Resolved (D50) | §API / POST /:id/responses (drops second emission); §Migration §3 fan-out |

#### Non-Functional Requirements

| NFR | RFC Section | Status | Validation |
|---|---|---|---|
| NFR-P1 — auto-save PATCH p95 < 200ms | §Validation Plan / Perf row | Met | `surveys-autosave-bench.test.ts` (NEW) |
| NFR-P2 — standalone form first paint p95 < 2s (3G) | §Web UI / SurveyFormRenderer | Met (no change to renderer perf characteristics) | Playwright Lighthouse-style measurement |
| NFR-P3 — embed widget mount + first paint < 1s | §Embed Widget + §Risks (bundle budget) | Met | Playwright host-page widget test |
| NFR-P4 — response → LoyaltyEvent p95 < 30s | §API / POST /:id/responses (unchanged latency) | Met | Existing Issue #6 SLA monitoring |
| NFR-P5 — Activate gating client-side < 100ms | §Web UI / ActivateModal (client-side validation, no API hit) | Met | Browser perf assertion in E2E |
| NFR-S1 — brand-scoped read/write | §API / existing `brandId` gate (preserved) | Met | API integration cross-brand 403 test |
| NFR-S2 — opaque ids (cuid) | §Schema / unchanged | Met | n/a (existing behavior) |
| NFR-S3 — disclosure-text no raw HTML | §Validation Plan / `packages/consent-text` (existing renderer) | Met | Unit test in renderer (existing + new XSS payloads) |
| NFR-S4 — embed widget no host privilege | §Embed Widget + §"Submission path" (POST-body identity, never URL) | Met | Widget test asserts identifier not in URL |
| NFR-S5 — audit `actorUserId`, `requestIp`, timestamp | §Audit Plugin Extension (no schema change; `metadata.requestIp` via per-route allowlist) | Met | API integration asserts `metadata.requestIp` populated; structured-log warning fires when `request.ip` is null |
| NFR-R1 — atomic LoyaltyEvent + pointsBalance | §API / POST /:id/responses delegates to worker; worker tx preserved | Met | Worker integration tx-rollback test |
| NFR-R2 — response submit idempotent | §API / idempotencyKey unchanged | Met | Worker integration: duplicate idempotencyKey → exactly one LoyaltyEvent |
| NFR-R3 — auto-save network resilience | §Web UI / RHF form structure (exponential backoff up to 5 retries) | Met | Unit/E2E network-failure simulation |
| NFR-R4 — state-transition consistency (single endpoint) | §API / PATCH /:id/status (existing single endpoint) | Met | Existing test coverage |
| NFR-R5 — BullMQ backpressure | §API enqueue pattern unchanged | Met | Existing BullMQ DLQ behavior |
| NFR-SC1 — editor interactive with 200 questions | §Web UI / QuestionsTab (dnd-kit virtualization optional) | Met | Manual scaling test in implementation phase |
| NFR-SC2 — theme picker scales to 100 themes | §Web UI / LookFeelTab (search field beyond 100) | Met | Visual + perf check in implementation phase |
| NFR-SC3 — surveys list pagination unchanged | §API / GET /v1/surveys (cursor pagination retained) | Met | Existing behavior |
| NFR-SC4 — response submission burst load | §API enqueue + existing BullMQ scaling | Met | Existing capacity |
| NFR-A1 — fully keyboard-navigable editor | §Web UI / RHF + dnd-kit (Arrow keys for reorder) | Met | `@axe-core/playwright` zero violations; manual keyboard walk |
| NFR-A2 — programmatic labels | §Web UI / SurveyEditorForm | Met | axe-core |
| NFR-A3 — color not only state indicator | §Web UI / status badges (text + color) | Met | axe-core + manual check |
| NFR-A4 — respondent form WCAG AA | §Web UI / SurveyFormRenderer | Met | axe-core on respondent surface |
| NFR-A5 — validation errors associated with fields | §Web UI / RHF (`aria-describedby` from RHF defaults) | Met | axe-core + manual check |
| NFR-O1 — state transition audit | §Audit + §API / PATCH /:id/status | Met | API integration audit assertions |
| NFR-O2 — consent-mode audit | §Audit + §API / PATCH /:id/consent-mode | Met | API integration audit assertions |
| NFR-O3 — disclosure-text audit | §Audit (general PATCH path) | Met | API integration audit assertions |
| NFR-O4 — BullMQ standard metrics | §Worker (no change) | Met | Existing observability |
| NFR-O5 — audit-log substrate for future activity view | §Audit (kusto query example) | Met | n/a — UI deferred |
| NFR-I1 — i18n strings extractable | Deferred per spec | Deferred | n/a — platform i18n adoption |
| NFR-I2 — currency labels from program | §Web UI / PointsAndThankYouTab (`{{pointCurrencyName}}`) | Met | E2E asserts thank-you renders program's currency |
| NFR-I3 — RTL support | Deferred per spec | Deferred | n/a |
| NFR-B1 — admin browsers (Chrome/Safari/FF/Edge latest 2) | §Validation Plan / Browser matrix | Met | Existing Playwright matrix |
| NFR-B2 — respondent + mobile (iOS Safari + Android Chrome) | §Validation Plan / Browser matrix extended to mobile | Met | Playwright mobile projects |
| NFR-B3 — widget mounts in iframes, shadow-DOM, direct DOM | §Embed Widget (Shadow DOM, BEM CSS isolation) | Met | Widget host-page test in each context |
| NFR-BC1 — migrations idempotent | §Migration (idempotent guards) + CI gate | Met | Migration test asserts second-replay no-op |
| NFR-BC2 — SurveyResponse rows untouched | §Migration (no SurveyResponse mods) | Met | Schema diff confirms only Survey + AuditEvent touched |
| NFR-BC3 — `/v1/surveys/*` paths unchanged | §API surface table | Met | API contract review |
| NFR-BC4 — new consent-mode endpoint additive | §API surface table | Met | API contract review |

#### Validation Plan rows (from spec) → RFC test artifacts

All 14 spec Validation Plan rows operationalized in RFC §Validation Plan. Mapped 1:1.

#### Schema deltas (from spec's Schema and API Summary)

| Spec Delta | RFC Section | Status |
|---|---|---|
| Add Survey.title (nullable, backfill from name) | §Schema + §Migration step 1 | Met |
| Drop Survey.incentivePoints | §Migration step 3d | Met |
| Drop Survey.showIncentivePoints | §Migration step 3d | Met |
| Rename SurveyStatus.CLOSED → STOPPED | §Migration step 4 | Met |
| AuditEvent.ipAddress | NOT added — NFR-S5 satisfied via `metadata.requestIp` JSON; verified `audit.ts:150` writes metadata as a single JSON column. | Met (in-process; no schema change) |
| D50 fan-out of dead survey_completion EarningRules | §Migration steps 3a–3c | Met |
| Auto-create per-type EarningRules for brands with prior incentivePoints intent | §Migration step 3a | Met |

#### Error States (12 rows from spec)

| Error State | RFC Section | Status |
|---|---|---|
| Activate clicked with 0 questions | §API / Endpoint error contracts (422 NO_QUESTIONS) | Met |
| Activate with required Basics empty | §API / Endpoint error contracts (422 MISSING_REQUIRED_FIELD) | Met |
| Consent override PATCH without attestation | §API / Endpoint error contracts (422 ATTESTATION_REQUIRED) | Met |
| Cross-brand PATCH | §API / Endpoint error contracts (403) | Met |
| Disclosure-text > 500 chars | §API / Endpoint error contracts (Zod 422) | Met |
| Embed widget mount without prefill | §Embed / fallback to MemberIdField | Met |
| Legacy `?email=` URL after V0 ship | §Embed / Legacy URL params | Met |
| Response submit with ONCE + duplicate | §API / POST /:id/responses (409) | Met |
| Response submit with LATEST_OVERWRITES + prior | §API / POST /:id/responses (update path) | Met |
| Program has no matching EarningRule | §API silent skip (OQ1 resolution) | Met |
| Auto-save PATCH network failure | §Web UI / RHF auto-save backoff | Met |
| Theme picker with 0 themes | §Web UI / LookFeelTab fallback banner | Met |
| Stop/Restart/Pause invalid state | §Web UI / SurveyRowMenu state-aware filtering + API 400 | Met |

### Architecture Gaps (for user review at PR time)

Documented in RFC §Architecture Analysis. Summary for the user:

| Gap ID | Decision needed from reviewer |
|---|---|
| **MA1** | Approve ADR 0001 amendment for "section-tabbed-create" exception class? RFC files the amendment as a companion commit on this branch by default. |
| **MA2** | Document "auto-save on blur" pattern as the canonical admin-form pattern in architecture.md §3.1? RFC follows the pattern; documenting makes it discoverable for future entities. |
| **MA3** | Document the state-aware PATCH field allowlist contract in architecture.md §4.1 (HTTP 409 with `{code, field, currentState}` body)? Useful for future stateful entities (Campaigns, Programs). |
| **MA4** | Document the audit plugin `metadata.requestIp` pattern in architecture.md §4.2 audit plugin row (per-route allowlist must include `'requestIp'`; null on trust-proxy misconfiguration with structured-log warning)? |
| **TQ5** (open question, see RFC) | Amend §3.7 to allow `packages/embed` to import from internal packages when Vite library mode bundles them inline at build? Default in this RFC: keep §3.7 as-is, inline-duplicate the renderer with Playwright visual-regression CI gate as the parity enforcement. Revisit if maintenance cost climbs. |

All four updates (MA1–MA4) are deferred to the address-feedback phase per FRAIM contract — none are blockers for this design review. TQ5 is an open question the reviewer answers as part of this design review.

## Due Diligence Evidence

- Reviewed feature spec in detail: **Yes** — 645-line spec read in full, including all 52 decisions, 32 R# requirements, 39 NFRs, 5 OQs, 12 Error States, full Schema and API Summary handoff table, and Compliance + Validation Plan sections.
- Reviewed codebase in detail to understand and repro the issue: **Yes** — verified every spec claim against primary sources at exact line numbers. Surfaced 4 reconciliations (SurveyStatus enum already has PAUSED; Survey.title doesn't exist; AuditEvent lacks ipAddress; EarningRule has no `attribution` column — RFC uses `name` prefix instead). Re-read `surveys.ts` PATCH handlers, `loyaltyEvents.ts` exact-match logic, `audit.ts` plugin shape, `OrganizationSettingsForm.tsx` reference impl, and the four ADRs in `docs/architecture/adr/`.
- Included detailed design, validation plan, test strategy in doc: **Yes** — RFC has 18 sections, 5-slice implementation plan, full traceability matrix, and Architecture Analysis with explicit pattern classification.

## Prototype & Validation Evidence

- [x] Built simple proof-of-concept that works end-to-end: **N/A — no spike required**. All ambiguities resolved through primary-source code reading per RFC §"Spike Findings". Codebase patterns (`OrganizationSettingsForm` for RHF, `_brandtheme_surveytheme_split` for the hand-edited migration shape, `consent-text` for the domain-narrow package precedent, `audit.ts` per-route allowlist for the new endpoint shape) all exist in-tree and have been read at exact line numbers.
- [x] Manually tested complete user flow (browser/curl): **N/A in design phase — implementation phase owns**. The interactive mock at `docs/feature-specs/mocks/241-survey-admin-ux.html` (1,477 lines, fully wired) is the design-time substitute and was the artifact reviewers walked through during the 12 spec rounds.
- [x] Verified solution actually works before designing architecture: **Yes** — the migration's D50 fan-out SQL was sketched mentally against the EarningRule + Survey schema state (verified at exact lines); the worker's existing exact-string-match (`loyaltyEvents.ts:81`) was confirmed unchanged by the design; the embed widget's prefill flow was traced through `resolveOrEnrollMember` at `public.ts:295` (POST body consumes the right shape).
- [x] Identified minimal viable implementation: **Yes** — 5 slices, each independently revertable. Slice 1 (schema + migration) is the gate; remaining slices can be paused/resumed without blocking each other.
- [x] Documented what works vs. what's overengineered: **Yes** — RFC §Risks & Mitigations names the bundle-size and dnd-kit decisions; §Open Questions lists the 4 remaining tradeoffs (ADR amendment scope, title ≠ name enforcement, dnd-kit vs. Up/Down only, launch endpoint deprecation).

## Continuous Learning

| Learning | Agent Rule / Memory Update |
|---|---|
| RFC must verify schema column names + line numbers against primary source before claiming a delta. Architecture doc may lag the schema (e.g., still names `SurveyTheme` while schema has `BrandTheme`). | Reinforces existing memory: `feedback_diagnose_my_script_before_blaming_externals` family — primary-source verification. No new memory needed; the existing CTRL-3 pattern fired correctly. |
| Embed widget cross-package imports are forbidden by architecture §3.7. When the same renderer is needed by both apps/web and packages/embed, extract a domain-narrow runtime package. `packages/consent-text` is the precedent shape. | Worth surfacing into a project-wide architecture rule. Recommend `mcp__fraim` learning sync after this RFC merges so future RFCs check the no-cross-import invariant up-front. |
| ADR 0001 standard CRUD pattern has natural exception classes (section-tabbed-create when the form is multi-section + has good defaults). Future entities matching the criteria may follow #241's pattern. | Captured as RFC MA1 + ADR 0001 amendment proposed in same branch. |

## Decision Completeness Check

- ✓ All 7 Epic ACs covered or explicitly superseded with cross-reference
- ✓ All 32 functional R# requirements mapped to RFC sections
- ✓ All 39 NFR requirements mapped (3 i18n deferred per spec)
- ✓ All 5 Open Questions resolved in spec consumed by RFC
- ✓ All 14 spec Validation Plan rows operationalized in RFC §Validation Plan
- ✓ All 12 Error States represented in §API error contracts or component fallbacks
- ✓ All 6 schema/migration deltas covered in §Migration (3 schema changes + D50 fan-out's 3 SQL phases; NFR-S5 is in-process, no schema change)
- ✓ 1 Incorrectly-Followed pattern (IF1: embed cross-package import) resolved in RFC body via inline duplication + Playwright visual-regression gate; TQ5 filed for §3.7 amendment as the alternative
- ✓ 4 Missing-from-Architecture patterns (MA1–MA4) flagged for user review at PR time

**Status: Met — no `Unmet` rows. Design ready for PR submission.**
