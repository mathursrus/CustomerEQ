# Feature: Survey response data model rework — auto-enrollment, recurring responses, polymorphic identifier

Issue: #231
Owner: Claude (FRAIM feature-specification job)
Date: 2026-05-02
Priority: P0 — Blocks ArtistOS production embedding gate; informs #217 picker copy
Labels: `enhancement` `onboarding` `p0`
Parent: #225 · Hero protected: #6 · UI picker home: #241 · Informs: #217

---

## Customer

**Primary**: Brand admin / integrator embedding CustomerEQ surveys into their own products (web app, mobile app, post-purchase email link, embedded widget) where the responder population is *much larger* than the loyalty roster. Examples: ArtistOS post-onboarding NPS, a SaaS company's quarterly CSAT, a retailer's post-purchase product review, a B2B vendor running a one-off market-research survey.

**Secondary**: The survey *responder* — a customer of the brand who clicks a survey link or submits an embedded form. They may be a known logged-in user of the host app, a user identified only by email/phone/customerId on the form, or a new contact entirely. From their perspective the experience must be friction-free; they should never see the words "loyalty program" while answering "how was your experience?"

**Out of scope (deferred)**: Truly anonymous responders — no identifier at all. V0 requires an identifier on every response so the response can be attributed to a member (auto-enrolled if needed) and rule R5 (event-driven loyalty actions tied to a member) holds.

---

## Customer's Desired Outcome

The brand admin wants their **entire customer base** to be able to submit feedback — not just the subset who happen to already be enrolled in the loyalty program. They want to embed a CustomerEQ survey on their site and have it *just work* whether the responder is a known member, a known non-member, or a brand-new contact, without the admin pre-populating member rosters or building bespoke "create-then-respond" plumbing.

The responder wants to fill in the survey, identify themselves with whatever identifier their host app already uses (email today; phone or customer-id tomorrow), give one click of consent, hit submit, and be done. They do not want a multi-step "first sign up for the loyalty program, then come back to give us feedback" detour.

---

## Customer Problem Being Solved

Today the system architecturally requires that every survey responder be a pre-enrolled `Member`:

- `SurveyResponse.memberId` is `String NOT NULL` (`schema.prisma:695`)
- `SurveyResponse @@unique([surveyId, memberId])` enforces *one* response per member per survey (line 712) — breaks NPS-quarterly, CSAT-after-every-support-case, in-app feedback widgets
- `Member` lookup is keyed on `@@unique([brandId, email])` (line 315) which is **case-sensitive** — `Bob@example.com` and `bob@example.com` create duplicate members and silently break re-enrollment / re-identification
- Identifier is hard-coded to `email` — brands whose system of record uses `customer_id` or `phone` cannot embed CustomerEQ without first joining their data to email
- `EnrollMemberSchema` requires `consentGivenAt` from the client — re-prompting users for consent timestamps already captured during a prior signup, and breaking bulk-migration imports where the original consent timestamp is the legally important one to preserve

Real-world impact (concrete): the ArtistOS customer (the trigger for this issue) gated their production embedding behind a feature flag specifically because the member-must-exist precondition was incompatible with their post-onboarding survey use case. See [#225 comment](https://github.com/mathursrus/CustomerEQ/issues/225#issuecomment-4362090471).

Pain points addressed:
- Cannot embed surveys for any customer base larger than the loyalty roster (i.e., all of them)
- Cannot run any feedback pattern that produces > 1 response per member (NPS quarterly, post-every-support, post-every-purchase CSAT, in-app feedback)
- Email duplicates from case variation silently break re-identification
- Identifier rigidity — cannot service a brand that identifies by phone or customer-id
- Required client-supplied `consentGivenAt` adds friction for bulk migration and is redundant for first-time enrollment

---

## User Experience That Will Solve the Problem

This is largely a *data-model and API* change; most user-visible surface is invisible (auto-enrollment happens server-side). Two visible touchpoints:

### Touchpoint 1 — Brand admin configures their identifier kind

During brand onboarding (already in scope of #225 / #239), the admin picks a **Member Identifier Kind** for their brand:

```
Member Identifier:
  ( ) Email (recommended)
  ( ) Phone
  ( ) Customer ID (your system of record)
  ( ) Other
```

Default = `EMAIL` (matches every existing customer). Once set on a brand, all surveys, embedded forms, and API submissions interpret the identifier value in that shape. Identifier kind is V0-immutable per brand (no in-place migration mid-tenant in V0).

### Touchpoint 2 — Survey form (embedded or hosted)

When the host app embeds a CustomerEQ survey, the survey widget accepts a single URL parameter:

```
https://surveys.customereq.com/{surveyId}?member_id={whatever}
```

`member_id` is **type-agnostic** — the value is whatever string the brand's identifier kind expects (an email, a phone, a customerId, etc.). The server validates against the brand's `memberIdentifierKind`.

Three responder paths:

| Responder | Survey form behavior |
|---|---|
| Known existing member (passed via `member_id` URL param OR logged-in via host app SDK) | Form shows directly. Submit creates the `SurveyResponse` with the resolved member's id. |
| Known non-member with identifier value | Form shows directly. Submit auto-enrolls into the survey's `programId` (creates a `Member` row server-stamping `consentGivenAt = now()`), then creates `SurveyResponse`. |
| Unknown (no `member_id`, embedded form has no host SDK context) | Form shows an identifier field labeled per the brand's identifier kind ("Email", "Phone", "Customer ID"). Submit performs the same auto-enrollment path. |

Consent UX (full detail in §Compliance Requirements):
- When `Brand.consentMode = EXPLICIT` (default): the form shows a required consent checkbox with the brand's privacy-policy / terms link. Submit is disabled until checked.
- When `Brand.consentMode = IMPLIED_ON_SUBMIT`: the form shows the consent disclosure text inline ("By submitting, you agree to ..."), no checkbox. Submit captures `consentGivenAt = now()` server-side.

### UI mocks

The `responsePolicy` picker (Survey-create UX) and the embedded-form mocks land in **#241** (Unify survey lifecycle — verbs, drafts, builder/wizard convergence). #231 contributes the requirement; #241 owns the picker mock + the embedded-form layout. This is by design: #231 reshapes the *data plane*; #241 owns the *survey-creator UX surface*.

A small Brand-onboarding identifier-kind picker mock for Touchpoint 1 lives at `docs/feature-specs/mocks/231-brand-identifier-kind.html` (lightweight — adds one form section to the existing brand setup flow).

### Design Standards Applied

Used `docs/architecture/architecture.md` (the project-specific architecture document) — Next.js App Router for admin UI, Tailwind utility classes for the picker, brand setup is part of the existing onboarding flow under #225/#239. No new design tokens introduced.

---

## Functional Requirements

Each requirement has an `R{N}` traceability tag. SHALL-style.

### Schema and data model

- **R1**: `SurveyResponse.memberId` SHALL remain `String NOT NULL` — every response is bound to a member.
  - GIVEN a survey response submission, WHEN the responder cannot be resolved to an existing member, THEN the system SHALL auto-enroll first and then create the response (see R6).
- **R2**: `@@unique([surveyId, memberId])` on `SurveyResponse` SHALL be **dropped**. Multiple responses per member per survey SHALL be the default.
- **R3**: `Survey.responsePolicy` SHALL be added as an enum (`ONCE | MULTIPLE | LATEST_OVERWRITES`), default `MULTIPLE`. The submit endpoint SHALL enforce the policy at write time:
  - `ONCE` → reject second submission with HTTP 409 referencing the prior response id
  - `MULTIPLE` → accept; insert new row
  - `LATEST_OVERWRITES` → upsert by `(surveyId, memberId)` tuple; new answers overwrite prior; `completedAt` updated
- **R4**: `Member` SHALL gain `externalId String NOT NULL` and `Brand` SHALL gain `memberIdentifierKind` enum (`EMAIL | PHONE | CUSTOMER_ID | OTHER`, default `EMAIL`). New unique constraint `@@unique([brandId, externalId])` (case-insensitive — see R5).
- **R5**: `externalId` SHALL be stored normalized: lowercased and whitespace-trimmed at insert and lookup. (Postgres expression-index `LOWER(externalId)` enforced via migration.)
- **R6**: A new **late-arriving update path** SHALL exist: re-submitting the enrollment endpoint with the same `(brandId, externalId)` SHALL be idempotent — it MUST NOT create a duplicate, and SHALL last-write-wins on non-identifier fields (`firstName`, `lastName`, `phone`, opt-in flags). Identifier change is NOT supported via this path; changing `externalId` requires a separate ops process (out-of-scope V0).
- **R7**: All non-identifier `Member` fields SHALL be optional (`firstName`, `lastName`, `phone`, opt-in flags) so a freshly auto-enrolled member can exist with only `(brandId, externalId, consentGivenAt)`.

### API surface

- **R8**: `EnrollMemberSchema` `consentGivenAt` SHALL become **optional**. If absent, server stamps `now()`. If present, the integrator-supplied value SHALL be preserved (bulk-migration use case).
- **R9**: A new `POST /surveys/:surveyId/respond` public endpoint SHALL accept `{ memberId: string (the identifier value), consent?: boolean, answers: {...} }` and SHALL:
  1. Resolve the member via `(brandId, lower(memberId))`. If found → use; if not found → auto-enroll (see R10).
  2. Enforce `Survey.responsePolicy` (R3).
  3. Validate consent per brand `consentMode` (see Compliance §).
  4. Persist `SurveyResponse`. Fire the existing event-pipeline hooks (BullMQ job for survey-rule evaluation, hero #6 path).
- **R10**: Auto-enrollment via survey response SHALL set `Member.consentGivenAt = now()`, `status = ACTIVE`, `programId = survey.programId`. The auto-enrolled member SHALL be eligible for any incentive points configured on the survey.

### Integrator-facing

- **R11**: The brand admin SHALL pick `memberIdentifierKind` exactly once during brand setup (V0). UI: radio group with `EMAIL` default. Surface: brand setup flow (existing under #225/#239), not part of #231 implementation.
- **R12**: The `responsePolicy` picker SHALL surface in the survey creation/edit flow, owned by **#241**. Default `MULTIPLE`. Inline help text describes each option.

### Compatibility

- **R13**: Acme demo flow (Maya enrolls, then submits survey) SHALL continue to work unchanged — it is the `EMAIL` identifier kind + `responsePolicy = MULTIPLE` path with consent gathered at enrollment.
- **R14**: Existing surveys SHALL be migrated with `responsePolicy = ONCE` (preserves current behavior literally), so no observable change for already-deployed brands. Brand admins opt in to `MULTIPLE` per survey.

---

## Data Model — proposed migration

```prisma
model Brand {
  // ... existing fields
  memberIdentifierKind MemberIdentifierKind @default(EMAIL)  // R4
  consentMode          ConsentMode          @default(EXPLICIT) // see Compliance §
  // ...
}

enum MemberIdentifierKind {
  EMAIL
  PHONE
  CUSTOMER_ID
  OTHER
}

enum ConsentMode {
  EXPLICIT
  IMPLIED_ON_SUBMIT
}

model Member {
  id              String   @id @default(cuid())
  brandId         String
  externalId      String   // R4 — normalized lowercased value
  email           String?  // optional now; only populated when identifierKind = EMAIL or as PII sidecar
  // ... other fields, all optional per R7
  consentGivenAt  DateTime?  // already nullable
  // ...
  @@unique([brandId, externalId])  // replaces @@unique([brandId, email])
  @@index([brandId, externalId])
}

model Survey {
  // ... existing fields
  responsePolicy  ResponsePolicy @default(MULTIPLE)  // R3
}

enum ResponsePolicy {
  ONCE
  MULTIPLE
  LATEST_OVERWRITES
}

model SurveyResponse {
  // ... existing fields, memberId stays NOT NULL
  // DROP @@unique([surveyId, memberId])  // R2
  @@index([surveyId, memberId])  // for ONCE / LATEST_OVERWRITES enforcement
}
```

**Backfill plan** (one migration, transactional):
1. Add `Brand.memberIdentifierKind` (default `EMAIL`), `Brand.consentMode` (default `EXPLICIT`).
2. Add `Member.externalId` nullable temporarily.
3. `UPDATE members SET externalId = LOWER(TRIM(email))` — verify no `(brandId, lower(email))` collisions first; if any, fail the migration with a report and stop.
4. Set `Member.externalId NOT NULL`, add `@@unique([brandId, externalId])`.
5. Drop `@@unique([brandId, email])`. Keep `email` column (now optional) for PII / send-mail purposes.
6. Add `Survey.responsePolicy` (default `MULTIPLE`); `UPDATE surveys SET responsePolicy = 'ONCE'` for all existing rows (R14 — preserve current behavior for deployed brands).
7. Drop `@@unique([surveyId, memberId])` on `SurveyResponse`; add `@@index([surveyId, memberId])`.

**Pre-migration guard** (added to `packages/database/scripts/`): a script that detects `(brandId, lower(email))` collisions before migration runs and prints a remediation report. Fails CI if collisions exist on production data.

---

## Compliance Requirements

`fraim/config.json` does not declare regulations explicitly. Inferred from `docs/architecture/architecture.md §10`: **GDPR + CCPA/CPRA required from MVP**. SOC2 Type 2 is on the Month-12 roadmap.

### GDPR / CCPA implications of auto-enrollment

| Requirement | How spec addresses it |
|---|---|
| Consent must be freely given, specific, informed, unambiguous (GDPR Art. 7) | `Brand.consentMode = EXPLICIT` (default) requires the survey form to show a checkbox with brand's privacy-policy + terms link. Submit blocked until checked. `IMPLIED_ON_SUBMIT` is opt-in for brands willing to attest the disclosure-text-on-form mode satisfies their legal review. |
| Right to be forgotten (GDPR Art. 17 / CCPA §1798.105) | Existing erasure job in `apps/worker` already zeros PII fields on `Member`. New fields (`externalId`) MUST be added to the erasure field list. Survey responses retain `memberId` reference but the member's PII is wiped. |
| Data export (GDPR Art. 15 / CCPA §1798.110) | Existing data-export endpoint includes `Member` PII. Add `externalId` to export. Survey responses already exported. |
| Auto-enrollment lawful basis | Auto-enrollment under `EXPLICIT` mode = consent (Art. 6(1)(a)). Under `IMPLIED_ON_SUBMIT` = legitimate interest (Art. 6(1)(f)) with disclosure on form. **Spec position**: default `EXPLICIT`; `IMPLIED_ON_SUBMIT` requires brand-level legal attestation captured during brand setup (mark as "I confirm my legal review has approved implied-consent disclosure"). |
| Bulk-migration consent preservation | R8 — integrator-supplied `consentGivenAt` is preserved verbatim. The original consent (e.g., from a prior loyalty platform) remains the legal-basis timestamp. |

### Data minimization

Auto-enrollment creates `Member` rows with the minimum required fields: `brandId`, `externalId`, `consentGivenAt`, `programId`. No demographic, no behavioral, no preferences. R7 makes this enforceable — non-identifier fields are optional.

---

## Open Questions — proposed positions (please review and iterate)

These are my proposed answers for Q1-Q5. Each has a stated tradeoff. Push back where you disagree and we'll iterate before this spec leaves draft.

### Q1 — Polymorphic identifier schema shape

**Proposal**: Add `Member.externalId` as the canonical lookup column (normalized, lowercased) with `@@unique([brandId, externalId])`. Keep `email` as an optional PII field for send-mail purposes only — *not* the join key. Add `Brand.memberIdentifierKind` enum to declare what semantic shape `externalId` holds for that brand.

**Why this over alternatives**:
- (vs. overloading `email` to hold any identifier) — keeps `email` semantically email; erasure / mail-send logic doesn't have to ask "is this actually an email or is it a phone number?"
- (vs. polymorphic `identifierType` + `identifierValue` per-row) — unnecessary; identifier kind is per-brand, so storing it once on `Brand` is normalized
- Mirrors Clerk's existing two-key model (`clerkUserId` is a separate column from `email`)

**Tradeoff**: One extra column on `Member`, one enum on `Brand`. Brand-setup gains one more required decision (with a sensible default). Acceptable cost.

### Q2 — Where is identifier kind configured: brand-level or per-program?

**Proposal**: **Brand-level for V0**. One identifier kind per tenant. A brand running both a loyalty program and a feedback program shares the identifier kind across both.

**Why**: The user's pattern from #231 itself ("per-survey responsePolicy override is a future need, not V0 default") applies here too — keep V0 small, defer per-program-multi-identifier until a real customer asks. Most ICP brands have one system-of-record identifier; a SaaS company is `customer_id`, a retailer is `email`, a B2C app is `phone`. Mixed-kind tenants are rare.

**Tradeoff**: A brand that wants different identifier kinds for loyalty vs. feedback hits a wall in V0. Mitigation: when this comes up, add `Program.memberIdentifierKind` (nullable, falls back to brand's). Migration is forward-compatible.

### Q3 — Embedded-survey URL param name

**Proposal**: **`member_id`** (type-agnostic). The brand's `memberIdentifierKind` config tells the server how to interpret/validate the value.

**Why**:
- Integrators get one consistent param name across all surveys, all brands
- Future SDKs / widget code don't have to switch on identifier kind to construct URLs
- A user reading their integration doc sees `member_id` and the doc clarifies "for your brand, pass the customer's email here"

**Tradeoff**: Mild dissonance for `customer_id`-kind brands ("but my app uses customer IDs, why does the param say `member_id`?"). Solvable in docs/copy.

### Q4 — Auto-enrollment + GDPR/CCPA consent

**Proposal**: Add `Brand.consentMode` enum (`EXPLICIT | IMPLIED_ON_SUBMIT`), default `EXPLICIT`. EXPLICIT requires a consent checkbox on the embedded form; IMPLIED_ON_SUBMIT shows the disclosure text inline and accepts submit as the consent action.

**Why**:
- Default-safe (EXPLICIT covers all GDPR jurisdictions)
- Brands operating in lighter-regulation regions can opt down to IMPLIED_ON_SUBMIT, gated by a "my legal review has approved this" attestation in brand setup
- The bulk-migration path doesn't go through the survey form, so the consent-checkbox UX doesn't gate it; the integrator-supplied `consentGivenAt` is the legal-basis timestamp (R8)

**Tradeoff**: Brands who don't read the brand-setup screen carefully may stay on EXPLICIT and wonder why their conversion drops vs. competitors who just ship implied-consent. Mitigation: clear brand-setup copy explaining the tradeoff.

### Q5 — Late-arriving profile updates: separate endpoint or upsert?

**Proposal**: **Upsert on the existing enroll endpoint** (`POST /members/enroll`). Idempotent on `(brandId, externalId)` — re-sending refreshes non-identifier fields with last-write-wins. Identifier change is NOT supported via this path (returns 409 if a different `externalId` is submitted with otherwise-matching member context — though "same member" without identifier match is not a thing in V0).

Add a `member_profile_audit` table that records each non-identifier field write with `(memberId, fieldName, oldValue, newValue, source, at)` for compliance/debugging.

**Why**:
- Single endpoint surface = simpler integrator mental model
- Bulk-migration imports run idempotently — rerunning the import is safe
- Last-write-wins is the usual integrator expectation for upserts; integrators are the source of truth on profile data
- Audit log gives us a paper trail without changing API semantics

**Tradeoff**: A brand admin who misconfigures their import script and overwrites good data with stale data has no UNDO from the API. Mitigation: audit log + a future ops endpoint to roll back (out of V0).

---

## Cross-issue dependencies and impacts

| Issue | Relationship | What this spec asks of it |
|---|---|---|
| **#241** (Unify survey lifecycle) | Owns UI for `responsePolicy` picker | Add the picker (3 radio options) to the survey-create / survey-edit flow. Inline help copy describes each. Default `MULTIPLE`. |
| **#225** (Onboarding walkthrough — parent epic) | Owns brand-setup flow | Add `memberIdentifierKind` picker + `consentMode` picker (with attestation when `IMPLIED_ON_SUBMIT`) to brand setup. |
| **#239** (Auto-provision Brand from Clerk webhook) | Owns brand creation event | Default new brands to `memberIdentifierKind = EMAIL`, `consentMode = EXPLICIT`. |
| **#217** (JTBD picker re-segmentation) | Picker copy can't ship while member-must-exist constraint exists | This spec unblocks #217 — once shipped, the picker's "hear what my customers think" track becomes ethically shippable. |
| **#6** (Hero — <15-min CX-to-loyalty SLA) | Must remain protected | The auto-enrollment path runs synchronously in the submit handler before the BullMQ event fires; net latency added is one DB insert. Validation Plan §perf checks <15-min SLA on auto-enrolled responder path. |
| **#117** (Survey creation UX — already in needs-review) | Adjacent; touches survey-create flow | If #117 lands first, #241 picks up the picker addition on top of #117's work. No conflict expected. |

---

## Validation Plan

P0 issue → unit + integration + E2E tests required (project rule R9).

### Functional validation

- **Unit**: requirement-by-requirement test cases for R1-R14 (Vitest, `apps/api/src/**/*.test.ts`).
- **Integration**: against real Postgres+Redis services (already in CI). Cover:
  - `POST /surveys/:id/respond` with known member → resolves correctly
  - With non-member identifier → auto-enrolls + responds
  - With missing identifier when brand requires explicit form-field → 400 with helpful message
  - `responsePolicy = ONCE` rejecting second submission → 409 with prior id
  - `responsePolicy = LATEST_OVERWRITES` upsert behavior
  - Case-variant identifier (`Bob@Example.com` vs `bob@example.com`) resolves to the same member
  - Bulk-import re-run idempotency for late-arriving fields
- **E2E** (Playwright): Maya demo flow; ArtistOS-style embedded survey flow with non-member responder; explicit-consent checkbox flow; identifier-kind=`CUSTOMER_ID` brand flow.

### Performance / hero protection

- Synthetic load test: 100 concurrent auto-enroll-and-respond submissions; assert p99 < 1s for the synchronous path (auto-enroll + persist response). The downstream BullMQ event (rule eval, points award, action firing) measured separately must still hit <15min p99 (rule R5 / hero #6).

### Compliance validation

- GDPR erasure job test: auto-enrolled member in dataset, run erasure → all PII fields zeroed including `externalId`, `email`, `firstName`, `lastName`, `phone`. Survey responses retain `memberId` foreign key but no PII recoverable.
- Data export test: exported bundle includes `externalId` field.
- Consent test: `EXPLICIT` brand rejects submit without `consent: true`; `IMPLIED_ON_SUBMIT` brand accepts.

### Migration validation

- Migration dry-run on demo dataset detects `(brandId, lower(email))` collisions and produces report.
- Forward migration: `externalId` populated, indices intact, existing surveys default to `responsePolicy = ONCE`.
- Backward compatibility: any existing API call to `EnrollMemberSchema` *without* `consentGivenAt` succeeds (was previously rejected); with `consentGivenAt` succeeds verbatim.

---

## Alternatives — rejected design calls (framing B: comment-as-canonical)

The original issue body proposed several design directions that the user's [canonical comment](https://github.com/mathursrus/CustomerEQ/issues/231#issuecomment-4365469095) reversed. Documented here so future readers see the choice and the rationale.

| Original body proposal | Rejected because | Replacement (this spec) |
|---|---|---|
| Make `SurveyResponse.memberId` nullable to support anonymous responses | Anonymous responses violate hero #6 (no member ⇒ no event ⇒ no rule fires); breaks the loyalty event model (R5 of project rules); creates orphan PII without a clear erasure path | `memberId` stays NOT NULL; auto-enroll is the path (R1, R6, R10) |
| Drop `consentGivenAt` from `EnrollMemberSchema` entirely | Bulk-migration imports lose the legally significant original consent timestamp | Make it **optional** with server-stamp fallback (R8) |
| Make `Member.email` citext / lowercase | Locks the system to email-as-identifier; can't service customers like ArtistOS who key on customer-id | Generalize: `Member.externalId` + `Brand.memberIdentifierKind` (R4, R5) |
| Either auto-enroll OR persist anonymous (design call) | Same root cause — anonymous breaks the loyalty event model | Auto-enroll is the V0 design (R10) |

---

## Competitive Analysis

### Configured Competitors

`fraim/config.json` does not declare competitors explicitly. Pulled from `docs/replicate/reports/REPLICATION_ANALYSIS.md` and `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`:

| Competitor | Survey response model | Strengths | Weaknesses | Position |
|---|---|---|---|---|
| **Annex Cloud** | Surveys are a side-feature; uses external survey tools (SurveyMonkey, Qualtrics) wired into loyalty via API. Member must exist before survey response is recorded. Same constraint we're fixing. | Polished loyalty engine; broad campaign system | Survey ↔ loyalty loop requires manual workflow tooling; <15-min real-time signal-to-action is not a primitive | Mid-market loyalty leader; weak on real-time CX |
| **Yotpo** | Reviews + UGC primary; surveys via integrations. Email-as-key; case sensitivity issues reported in their forums. Limited per-survey policy controls. | Strong UGC playbook | Survey is bolt-on, not native; loyalty is acquired (Swell) | UGC + light loyalty |
| **Qualtrics XM** | Surveys-first; auto-creates contacts on submission with full identifier flexibility (email, phone, custom IDs). NO loyalty integration. | Best-in-class survey logic + identifier flexibility | Not a loyalty platform; expensive | Enterprise CX |
| **Typeform / SurveyMonkey** | Anonymous responses by default; identifier optional. No loyalty linkage. | Lowest friction submission | Cannot loop response → loyalty action | SMB self-serve |

### Differentiation

- **Key Advantage 1**: We're the only loyalty platform whose survey is a *first-class data primitive* — not a bolt-on, not "wire SurveyMonkey to our webhook." The identifier-flexibility we're adding here closes the last gap that forced ArtistOS-style customers to gate behind a feature flag.
- **Key Advantage 2**: Hero #6's <15-min CX-to-loyalty loop is preserved through the auto-enrollment path; competitors require the customer to glue their CRM, survey tool, and loyalty platform together to attempt the same thing.
- **Key Advantage 3**: `responsePolicy` per-survey (`MULTIPLE` default) makes recurring CX patterns (NPS quarterly, post-every-support CSAT, in-app feedback) native — Annex Cloud / Yotpo require workarounds.

### Competitive Response Strategy

- **If Annex Cloud ships native polymorphic identifier**: maintain advantage via the *embedded-form auto-enroll into program* path — they will not match this without breaking their loyalty data model.
- **If Qualtrics adds loyalty primitives**: unlikely (price-point + market segment mismatch); position on price + integrated UI.

### Market Positioning

- **Target Segment**: Mid-market SaaS, retail, and B2C brands ($10M-$500M revenue) who run both a loyalty program AND a CX-feedback program and currently glue them together with workflow tooling.
- **Value Proposition**: One platform; embed surveys for your *whole* customer base, not just enrolled members; <15-min real-time loop preserved.
- **Pricing**: Out of scope for this spec.

### Research Sources

- `docs/replicate/reports/REPLICATION_ANALYSIS.md`
- `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`
- ArtistOS conversation in [#225 comment thread](https://github.com/mathursrus/CustomerEQ/issues/225)
- Date of research: 2026-05-02
