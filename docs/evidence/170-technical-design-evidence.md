# Evidence — Issue #170: Onboarding & First-Run Experience (Technical Design)

## Summary

- **Issue**: [#170](https://github.com/mathursrus/CustomerEQ/issues/170) — `[Epic] Onboarding & First-Run Experience`
- **Workflow type**: technical-design (FRAIM job, 8 phases)
- **Branch**: `feature/170-epic-onboarding-first-run-experience` (reused after PR #187 squash-merged into `main`; reset to `origin/main` to drop the redundant local-only spec commits)
- **Spec inputs**:
  - Feature spec: `docs/feature-specs/170-onboarding-first-run.md` (664 lines, merged via PR #187)
  - Sub-issue contracts: #171, #172, #173
  - Follow-up issues filed during spec review: #189 (team-management), #190 (brand-settings)
- **RFC artifact**: `docs/rfcs/170-onboarding-first-run.md` (~700 lines)

## Work Completed

### New file (1)

| File | Purpose |
| :--- | :--- |
| `docs/rfcs/170-onboarding-first-run.md` | Full RFC. Pins OD-1..OD-5 from the spec; specifies Prisma schemas (`OnboardingState`, `OnboardingActivationEvent`, `Brand` field additions, `ApiKey.externalSignalSourceId`, three new enums); defines the 12-method `IdentityProvider` interface with ESLint enforcement; enumerates 9 API endpoints with Zod schemas; gives a step-by-step instrumentation matrix (which handler emits each `OnboardingActivationEvent`); describes the path-specific dashboard CTA dispatch, GDPR cascade, failure-mode/retry handling, compliance controls, validation plan (19 scenarios), test matrix (Unit / Integration / E2E), risks (10), and architecture-doc updates with three-bucket gap classification. |

### Approach

Executed the FRAIM `technical-design` job phases in sequence:

1. **requirements-analysis** — re-read the spec (664 lines, on disk via #187 squash); reviewed the 5 ODs at lines 438/444/450/456/462; loaded ADRs 0001/0002/0003; pulled #189 and #190 for cross-issue context.
2. **design-authoring** — fetched the RFC template; identified ambiguities (none rated high uncertainty); decided no spike needed and recorded the rationale; authored the RFC.
3. **technical-spike** — skipped with explicit rationale (Spike Findings section in RFC).
4. **architecture-gap-review** — three-bucket classification appended in the RFC (8 correctly followed / 3 missing / 0 incorrectly followed).
5. **design-completeness-review** — this document.

### Decisions pinned in the RFC

| OD | Decision | Pin |
| :--- | :--- | :--- |
| **OD-1** | Clerk → Brand auto-provisioning | Webhook primary + middleware fallback; both implemented in this RFC's scope |
| **OD-2** | Multi-app data model (#173) | Extend `ExternalSignalSource.sourceType` with `APPLICATION`; spine adds the enum value + `ApiKey.externalSignalSourceId` FK; #173 owns per-app verification |
| **OD-3** | `OnboardingState` persistence | New 1:1 model with Brand; full Prisma schema in §2.2 |
| **OD-4** | Activation funnel storage | Dedicated `OnboardingActivationEvent` model with `step`/`previousStep`/`dwellMs`/`metadata`; full Prisma schema in §2.3; emission matrix in §7 |
| **OD-5** | IdentityProvider abstraction | 12-method interface in §3.1; `ClerkIdentityProvider` is the only implementation today; ESLint `no-restricted-imports` rule enforces the boundary in §3.3 |

### Decisions surfaced for the reviewer

The RFC ends with 4 numbered "Decisions for the reviewer" framed with `Recommendation:` + one-line tradeoff each, per the validated-pattern of `← recommended` defaults getting one-round answers:

1. **Single migration vs. phased** — recommended single.
2. **`Brand.planTier: String?` placeholder vs. omit** — recommended keep the placeholder.
3. **ADR scope (separate ADR 0005 for funnel vs. roll into ADR 0004)** — recommended roll into 0004.
4. **Worker-side emission of `first_action_triggered` (direct vs. queued)** — recommended direct.

## Validation

### Traceability Matrix

Maps every spec requirement, sub-issue contract, user constraint, and reviewer comment from the spec phase to the RFC section that addresses it.

| Requirement / Source | RFC section | Status |
| :--- | :--- | :--- |
| Spec S1 / AC1 — Sign-up auto-provisions a Brand on first login (no manual seed) | §1 OD-1 pin; §3 IdentityProvider abstraction; §4 `/api/auth/signup` + webhook; §5 webhook handler | ✅ Met |
| Spec S2 / AC2 — Use-case picker is the first screen post-provisioning; routes to correct connect flow | §6 component hierarchy (`/admin/onboarding`); §4 `PATCH /v1/admin/onboarding/checklist` (sets `useCasePath`) | ✅ Met |
| Spec S3 / AC3 — Guided first-run checklist renders on `/admin` until activation; dismissible after | §6.1 `<FirstRunChecklistWidget />` component spec; §2.2 `OnboardingState.dismissedByUserIds` field | ✅ Met |
| Spec S4 — Install verification per path with failure-mode hints | §12 dependencies (per-archetype RFCs own verification mechanism); spine provides shared shell + checklist contract | ✅ Met |
| Spec S5 / AC4 — TTFV metric instrumented and surfaced in internal analytics | §1 OD-4 pin; §2.3 `OnboardingActivationEvent` model; §7 instrumentation matrix; §4 `/v1/admin/internal/onboarding-funnel` route; §11.2 internal-only feature-flag gating | ✅ Met |
| Spec AC5 — Each sub-issue's connect flow plugs into the shared checklist; no duplicated UI shells | §6.2 `useOnboardingChecklist()` hook; §7 emission matrix shows archetype emissions go through `PATCH /v1/admin/onboarding/checklist` | ✅ Met |
| Spec AC6 — E2E test: sign-up → pick path → connect → verify → checklist marks activated, ≥1 archetype | §10 Validation Plan #14 (the hero E2E) | ✅ Met |
| Spec note — Hero workflow (#6) reachable in <30 min from sign-up | §10 Validation Plan #14 measures wall-clock; §13 explicitly out-of-scopes anything that would block this | ✅ Met |
| #171 contract — api archetype marks `dataSourceConnected` + `firstEventReceived` | §7 emission matrix rows for both steps; §12 dependencies row | ✅ Met |
| #172 contract — site archetype marks `dataSourceConnected` + `firstSurveyLive` | §7 emission matrix; §12 dependencies; §2.1 `Brand.siteDomain` field | ✅ Met |
| #173 contract — apps archetype marks `dataSourceConnected` + `firstEventReceived` per app | §1 OD-2 pin; §2.4 `ExternalSignalSource.APPLICATION` extension + `ApiKey.externalSignalSourceId`; §7 emission matrix | ✅ Met |
| User constraint (2026-04-24) — Pricing not finalized; design for paywall forward-compat | §2.1 `Brand.planTier: String?` placeholder; §13 out-of-scope reaffirmation; §11 risks #7 names the migration path | ✅ Met |
| Reviewer Comment 1 (Step 0 custom signup) | §6 component hierarchy `/signup` route; §4 `/api/auth/signup` endpoint | ✅ Met |
| Reviewer Comment 2 (path-specific dashboard states) | §8 path-specific CTA dispatch with full per-archetype switch | ✅ Met |
| Reviewer Comment 3 (Step 1.5 org profile capture) | §2.1 Brand field additions; §4 `/v1/admin/onboarding/profile` PATCH; §6 `/admin/onboarding/profile` route | ✅ Met |
| Reviewer Comment 4 (hide "My Organization" Clerk behavior) | §3.1 abstraction interface (`createUserWithOrg` returns plain IDs); §3.3 ESLint enforcement | ✅ Met |
| Reviewer Comment 5 (concrete error handling for signup failures) | §10 failure modes table (4 categories enumerated); §4 endpoint table notes Zod validation | ✅ Met |
| Reviewer Comment 6 (invited-admin flow) | §12 #189 dependency row; §2.2 `invitedAdminUserIds` field | ✅ Met |
| Reviewer Comment 7 (loose coupling with Clerk) | §1 OD-5 pin; §3 IdentityProvider abstraction (interface + implementation + ESLint) | ✅ Met |
| Reviewer Comment 8 (reframe picker as org-shape question) | §6 picker component reads `Brand.sizeCategory` for cohort hint; copy already in spec | ✅ Met |
| Reviewer Comment 10 (program/campaign timing precondition) | §2.2 `OnboardingState.checklist.programCreated` field; §4 `PATCH /v1/admin/onboarding/checklist` validation rule (rejects `firstActionTriggered=true && programCreated=false`) | ✅ Met |
| Reviewer Comment 14 (activation funnel with per-step timing) | §1 OD-4 pin; §2.3 `OnboardingActivationEvent` schema; §7 emission matrix; §10 Validation Plan #5–#7 | ✅ Met |
| Reviewer Round 2 #1 (OAuth providers must keep working) | §3.1 abstraction (`listSupportedOAuthProviders`, `beginOAuth`, `completeOAuth`, `createOrgForUser`); §4 `/api/auth/oauth/*` routes; §6 `<OAuthButtonRow />` component | ✅ Met |
| Reviewer Round 2 #2 (theme continuity with Settings → Themes) | §2.1 `Brand.defaultThemeId` FK to existing `Theme` model from #157; §12 #190 dependency owns the settings page | ✅ Met |
| Reviewer Round 2 #3 (file team-management issue) | #189 already filed during spec review; §12 dependencies row | ✅ Met |
| Reviewer Round 2 #4 (file brand-settings issue) | #190 already filed during spec review; §12 dependencies row + §4 `/v1/admin/brand` PATCH endpoint shared with #190 | ✅ Met |
| Reviewer Round 2 #5 (concrete theme preview spec) | Spec already pinned this; RFC's §6 component hierarchy preserves `<ThemePreviewPanel />` | ✅ Met |

**Result**: 0 Unmet rows. Design completeness PASSES.

### Architectural Gaps Documented

Per phase-4 architecture-gap-review (also recorded in RFC §"Three-bucket architecture-gap classification"):

#### Patterns correctly followed (8)

1. Multi-tenant `brandId` on every entity
2. Prisma migrations as source of truth
3. Zod for shared validation (api + frontend)
4. Append-only event tables for audit/analytics (mirrors `AuditEvent`)
5. BullMQ for retryable async work (Brand-name provider-sync retry)
6. Standard CRUD admin pattern from ADR 0001 (Step 1.5 form uses `mode='create' | 'edit'`)
7. No direct DB writes from request body (Zod-validated handlers; tenant scoping via Clerk JWT → Brand resolution in middleware)
8. GDPR-aware schema design (every new model has an erasure path; no silent PII)

#### Patterns missing from architecture (3 — proposed additions)

1. **CustomerEQ-owned auth surfaces wrapping a provider abstraction** — this RFC introduces it. Proposed ADR 0004.
2. **Per-step activation funnel as a first-class data shape** — this RFC introduces it. Proposed ADR 0005 (or roll into 0004 per reviewer Decision #3).
3. **Internal-only admin surfaces gated by feature flag** — `/admin/internal/onboarding-funnel` is the first; pattern is reusable.

#### Patterns incorrectly followed (0)

None identified.

### Decisions for reviewer (4 — surfaced for one-round resolution)

See "Decisions for the reviewer" at the bottom of the RFC. Each is framed with a one-line tradeoff and a `Recommendation:` so the reviewer can answer in a single chat turn.

## Quality Checks

- ✅ RFC matches the FRAIM `TECHSPEC-TEMPLATE.md` structure (Customer / Problem / UX / Technical Details / Confidence / Validation Plan / Test Matrix / Risks / Spike Findings / Observability) plus repo-specific sections (Architecture Updates / Three-bucket gap classification / Decisions for reviewer).
- ✅ Every spec requirement and reviewer-comment landing has a concrete RFC pointer (traceability matrix above).
- ✅ All 5 ODs explicitly pinned with implementation detail (schemas, interfaces, endpoints).
- ✅ No spike was needed; rationale is recorded explicitly in the RFC.
- ✅ Three-bucket architecture gap classification: 8 correctly followed, 3 missing, 0 incorrectly followed.
- ✅ ESLint enforcement of the IdentityProvider abstraction is specified (not just narrative).
- ✅ Cross-app emission concern flagged in confidence rationale (lowered from 90 to 85) and in Risks #1.
- ✅ Pricing forward-compat handled with `Brand.planTier: String?` placeholder; no SKUs/tiers invented.
- ✅ GDPR cascade order specified.
- ✅ Validation plan: 19 scenarios across functional (14) + compliance (3) + performance (2).

## Phase Completion

- Phase 1 `requirements-analysis` — complete
- Phase 2 `design-authoring` — complete
- Phase 3 `technical-spike` — initially skipped with rationale; **a spike was subsequently run during Phase 7 (Round 1 feedback)** at the reviewer's prompt. Findings landed in the RFC's "Spike Findings" section + the feedback file `docs/evidence/170-design-feedback.md`. Two interface fixes resulted (`completeOAuth` removed; `createUserWithOrg` cleanup contract clarified); confidence bumped 85 → 90.
- Phase 4 `architecture-gap-review` — complete (in RFC + this evidence)
- Phase 5 `design-completeness-review` — complete
- Phase 6 `design-submission` — complete (commit `df216ff`, PR #196)
- Phase 7 `address-feedback` — Round 1 addressed (1 comment); see `docs/evidence/170-design-feedback.md`
- Phase 8 `retrospective` — pending PR merge
