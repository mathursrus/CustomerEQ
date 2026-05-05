# Feature: Survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT

Issue: [#276](https://github.com/mathursrus/CustomerEQ/issues/276)
Owner: manohar.madhira@outlook.com
Priority: **P0 — production blocked**

## Customer

The primary owner is a **marketing manager** (or another manager who owns a specific Survey) at a brand on CustomerEQ. Their `Survey` rows live under a `Brand` whose `consentMode` was set to `EXPLICIT` by #231 PR1 (the brand-wide default), and their existing surveys cannot accept new responses because the `/v1/public/surveys/:id/respond` endpoint now rejects requests that don't include explicit consent in the body, and no client they distribute (embedded form widget, email-link landing page) sends that field yet.

The brand-level / program-level consent default is owned by an **admin** (a different role, though the people may overlap in small orgs). Admin work — managing the brand's `consentMode` default itself — is **not** in scope here; that lives in the Organization Settings sibling under #277.

A second persona this spec touches is the platform itself, acting as the "system" admin that runs the one-shot data migration unblocking pre-#231 surveys.

## Customer's Desired Outcome

1. **Existing surveys accept responses again** without the survey owner touching code, configuration, or each survey's settings.
2. **Per-survey consent mode override.** When the survey owner has a justified reason to deviate from the brand default — e.g., a low-friction NPS micro-survey on a marketing landing page where an opt-in checkbox would tank response rate — they can set that single survey to `IMPLIED_ON_SUBMIT` (or to `EXPLICIT` if the brand default is `IMPLIED_ON_SUBMIT`) without flipping the entire brand.
3. **The override is honored end-to-end**: the consent resolver, the survey-response endpoint, and the embedded form all read the resolved consent mode (survey-level if set, brand-level otherwise), not just the brand-level value.
4. **Choosing a more permissive mode than the brand default is gated.** Survey owners get an attestation step naming who authorized the deviation, when, **and why** — the audit trail must answer "who decided this survey doesn't require explicit consent, and what was their reason" months later.

## Customer Problem being solved

**Direct cause (production blocker)**: #231 PR1 set `Brand.consentMode` default to `EXPLICIT` and the survey-response endpoint at `apps/api/src/routes/public.ts:276` rejects requests with `requiresExplicitConsent && data.consent !== true`. All `Survey` rows created before #231 were test fixtures created under the legacy implied-consent flow; their existing distribution channels do not send the new `consent` field. Result: every pre-#231 survey returns 400 on every response attempt. Production is blocked.

**Root design gap**: #231's consent model gave brands a single `consentMode` knob and gave each survey a `consentTextOverride` (the disclosure text) plus `consentSuppressedAttestedBy/At` (the attestation hooks for suppressing the disclosure UI), but it did **not** give each survey a way to override the consent **mode** itself. So a brand running mostly opt-in workflows but with one low-friction micro-survey has no expressive way to say so at the survey level.

**Why fix it now (not later as part of a brand-settings rework)**:
- Production is blocked today. The one-shot data migration unblocks it without operator action.
- Adding the per-survey override is the smallest cleanly-shipped change that unblocks the test surveys AND gives operators the right shape to opt other surveys out going forward.
- A brand-wide flip from `EXPLICIT` → `IMPLIED_ON_SUBMIT` would unblock production but is the wrong long-term default; per-survey is the durable control.

## User Experience that will solve the problem

### Scope split: data + backend here; survey-editor UX in #241

This spec ships **the data model, backend resolver behavior, PATCH endpoint contract, and one-shot data migration** that make the override work end-to-end at the wire and DB level. The **survey-editor UX itself** — the consent panel inside the survey settings tab, the attestation modal, the audit-trail badge — belongs to **#241 (Survey Admin UX epic)**, which prioritizes the new survey experience as a coherent UX overhaul rather than letting it accrete one ad-hoc field at a time. Per the reviewer on round 1: it is acceptable for the new-survey UX to remain incomplete until #241 ships its UX surface.

What that means in practice:
- The data migration in this spec unblocks production by setting every existing Survey to `IMPLIED_ON_SUBMIT` — survey owners get unblocked immediately with **no UI work required from them** (R7 below).
- Once the override is needed via UI (post-#241), the API contract this spec defines (R5) is what #241 binds to. No backend rework required for #241 to ship the panel + modal.

### Survey-editor UX deferred to #241

The mock at [`docs/feature-specs/mocks/276-view.html`](mocks/276-view.html) is **informational input to #241** — it sketches the panel + attestation modal + audit badge so the #241 spec author has a starting point. It is **not** a #276 deliverable and the actual UX decisions (where the panel sits, which radio options are visible, badge styling, copy) are #241's call. Notes from the round-1 review that #241 should pick up:

- The panel may show only the override option that **differs** from the brand default — not the option that's the same as the brand. (Round-1 reviewer feedback; cleaner UX than showing all three.)
- The attestation modal must capture a **reason** text input alongside the "I'm authorizing" checkbox (R5 below requires the API field; the UI surface is #241's).
- The audit-trail badge should display the reason text alongside the attester + timestamp.

### Persona — system admin runs the one-shot data migration (no UX, runs in CI/CD)

A repeatable, idempotent SQL migration sets every `Survey` row across all brands and all organizations that has `consentMode IS NULL` (i.e., currently inheriting) to `consentMode = 'IMPLIED_ON_SUBMIT'`, with:
- `consentSuppressedAttestedBy = '__migration_276__'`
- `consentSuppressedAttestedAt = NOW()`
- `consentReason = 'Production hotfix #276 — pre-existing survey defaulting to IMPLIED_ON_SUBMIT to restore response collection. Override may be tightened by survey owner via #241 UX once shipped.'`

The audit trail clearly attributes the change to the migration rather than to a human operator. The `WHERE consentMode IS NULL` clause makes the migration safe to re-run (lessons from #270).

### Design Standards Applied (mock)

- Source: `docs/architecture/architecture.md` (CustomerEQ admin design system — shadcn/Tailwind v4 stack per `fraim/config.json customizations.stack.ui`).
- Mock follows the existing admin-shell layout used in `docs/feature-specs/mocks/231-brand-identifier-kind.html`: same sidebar pattern, same card / panel chrome, same primary-button / radio styling. No novel components or tokens introduced.
- The mock is informational input to #241; final design decisions (which options to show, modal copy, badge styling) belong to #241.

## Functional Requirements

| ID | Requirement | Acceptance Criterion (Given/When/Then) |
|----|---|---|
| R1 | A `Survey` row SHALL carry: (a) an optional `consentMode: ConsentMode?` that, when non-null, overrides `Brand.consentMode` for that survey (null = inherit); and (b) an optional `consentReason: String?` that captures the operator-supplied justification when the survey deviates from the brand default. | Given `Brand.consentMode = EXPLICIT`, `Survey.consentMode = IMPLIED_ON_SUBMIT`, `Survey.consentReason = 'Marketing landing page micro-survey, response rate sensitivity'`, when the consent resolver runs, the resolved mode is `IMPLIED_ON_SUBMIT` and the reason is queryable for audit. |
| R2 | The consent resolver (`apps/api/src/services/consentResolver.ts`) SHALL resolve the effective mode as `survey.consentMode ?? brand.consentMode` and base its `requiresExplicitConsent` decision on that resolved value. | Existing unit tests for the resolver pass unchanged when survey.consentMode is null; new tests cover the override case for both directions (explicit-over-implied and implied-over-explicit). |
| R3 | The survey-response endpoint (`POST /v1/public/surveys/:id/respond`) SHALL honor the resolved mode end-to-end — no separate read of `brand.consentMode`. | Given a survey with `consentMode = IMPLIED_ON_SUBMIT` under a brand with `consentMode = EXPLICIT`, when the endpoint receives a response **without** the `consent` field, then the response is accepted (HTTP 200) and persisted. |
| R4 | The embedded form widget (`generateWidgetJs()` in `apps/api/src/routes/public.ts`) SHALL continue to function unchanged — the resolver-side change makes the widget transparently work for any consent mode without code change. | Smoke: widget served from a test brand-survey pair under each consent mode renders + submits successfully without modification. |
| R5 | Setting a survey to a consent mode strictly more permissive than its brand SHALL require BOTH attestation AND a non-empty reason: the API stores `consentSuppressedAttestedBy = <authenticated user id>`, `consentSuppressedAttestedAt = NOW()`, and `consentReason = <request body reason>` atomically with the consent-mode update. The endpoint refuses the update if no authenticated user is present, OR if the reason is missing/empty/whitespace-only. | Given `Brand.consentMode = EXPLICIT`, when a survey owner PATCHes `Survey.consentMode` to `IMPLIED_ON_SUBMIT` without the attestation flag OR without a `consentReason` field in the request body, the API returns 422 with a structured error naming the missing field(s). |
| R6 | Setting a survey to the brand's mode (or to a stricter one) SHALL NOT require attestation or reason. The API SHALL clear `consentSuppressedAttestedBy/At` and `consentReason` to NULL on this transition. | Given `Brand.consentMode = IMPLIED_ON_SUBMIT`, when a survey owner PATCHes `Survey.consentMode` to `EXPLICIT`, the API accepts the change with no attestation payload required and the three audit columns are cleared. |
| R7 | A one-shot, idempotent data migration SHALL set **every** `Survey` row across all brands and all organizations where `consentMode IS NULL` to `consentMode = 'IMPLIED_ON_SUBMIT'`, attributing the change to system identifier `__migration_276__` with a descriptive `consentReason` text naming the migration. The migration MUST be safe to re-run (no row state changes on second run). | Run the migration twice in succession; first run sets `consentMode = IMPLIED_ON_SUBMIT` on every `consentMode IS NULL` row across the DB and writes attestation + reason; second run is a no-op (no `Survey.updatedAt` advances; row count of touched rows is 0). |
| R8 | The audit log SHALL capture the attesting user, timestamp, AND reason on every consent-mode override write. The audit-feed surface (existing audit plugin) SHALL include `consentReason` in its event payload so the override rationale is queryable months later. UI presentation of the badge / audit row is handled in #241. | Given a survey with attestation set, the audit-log row exists with `action = 'survey.update'`, `metadata.consentMode = 'IMPLIED_ON_SUBMIT'`, `metadata.consentReason` containing the operator's reason text, and `actorUserId = <test user>`. |
| R9 | The Prisma model + migration SHALL be authored idempotently. The schema delta is two nullable column adds (`consentMode "ConsentMode"`, `consentReason TEXT`); no new enum is introduced. The migration MUST follow the project's #270 idempotency norms (no unguarded DDL that breaks on `db push`-then-`migrate deploy`). | The new schema migration applies cleanly on a fresh DB AND a `db push`'d DB. Verified via the new CI gate from #270 + a local `db push` → `migrate deploy` repro. |

### Open Decisions Resolved in this Spec

These are the three open questions from the issue body. **Recommended** answer is the one carried forward in R1-R9 above; alternatives + tradeoffs are listed for the reviewer.

| # | Question | Recommended | Alternative | Why recommended over alternative |
|---|---|---|---|---|
| Q1 | **Override semantics** — enum with explicit `INHERIT_FROM_BRAND` value, OR nullable column where null = inherit? | **Nullable column.** `Survey.consentMode: ConsentMode?`. Null = inherit. | Add `INHERIT_FROM_BRAND` to `ConsentMode` enum. | Nullable-as-inherit is a Postgres / Prisma idiom that doesn't pollute the `ConsentMode` enum (which is also used by `Brand.consentMode`, where `INHERIT` would be nonsensical). Adding the enum value forces every `ConsentMode` consumer to handle a value that's only meaningful in a child context. Migration cost is identical. |
| Q2 | **Authorization shape** — reuse `Survey.consentSuppressedAttestedBy/At` (added in #231 PR1 as placeholders) or introduce a new pair of columns? | **Reuse `consentSuppressedAttestedBy/At`.** | Add `Survey.consentModeOverrideBy/At`. | The #231 PR1 fields were explicitly designed as attestation hooks for survey-level consent deviation (see comment in `consentResolver.ts:14`). Reusing them keeps the audit shape unified and avoids two parallel "who attested what" columns. The semantics generalize cleanly: the attestation now records "who authorized any consent deviation on this survey" — both `consentTextOverride = ''` (suppress UI, R17 from #231) and `consentMode != null` deviating from brand. |
| Q3 | **Migration scope** — set ALL existing `Survey` rows to `IMPLIED_ON_SUBMIT`, or only those with no responses yet? | **All `Survey` rows across all organizations with `consentMode IS NULL`** (round-1 reviewer answer). Migration scope is unconditional — no timestamp boundary, no `responsesCount` filter. | (a) only rows created before #231 PR1; (b) only rows with `responsesCount = 0`. | The reviewer's framing: production is the immediate concern, every existing survey was effectively created under the legacy implied-consent assumption regardless of when, and survey owners can post-hoc tighten any specific survey to `EXPLICIT` via the override UI (when #241 ships) if their compliance posture demands it. The simplicity of the unconditional sweep is worth more than the marginal safety of the timestamp boundary. The `WHERE consentMode IS NULL` clause still preserves any deliberate operator-set value (no clobbering). |

(Q3 was originally recommended as the timestamp-bounded form; flipped to unconditional sweep on round-1 review.)

## Compliance Requirements

Per `fraim/config.json customizations.compliance.regulations`: `GDPR`, `CCPA`, `SOC2`, `PCI-DSS`. PCI-DSS is `minimal-scope` (no card data here); SOC2 is `target: month-12`. GDPR + CCPA are in-scope today and bind this feature.

| Regulation | Clause | Mapped Control |
|---|---|---|
| **GDPR** | [Art. 7 §1 — controller must be able to demonstrate consent](https://gdpr-info.eu/art-7-gdpr/) | The `consentSuppressedAttestedBy/At` audit trail (reused from #231 PR1 per Q2) demonstrates *who* attested to a deviation from the brand's stated consent mode and *when* — required if the regulator asks why a specific survey collected responses under implied consent while the brand default required explicit consent. |
| **GDPR** | [Recital 32 — consent must be unambiguous and informed](https://gdpr-info.eu/recitals/no-32/) | The `IMPLIED_ON_SUBMIT` mode does **not** suppress the consent disclosure text — it only removes the opt-in checkbox. The respondent still sees `Brand.consentTextDefault` (or `Survey.consentTextOverride` when set) before submit. The act of submitting the form is the unambiguous consent. The spec MUST NOT propose a mode that hides both the checkbox AND the disclosure — that would be opt-out, not implied consent, and would fail GDPR. |
| **GDPR** | [Art. 5 §1(b) — purpose limitation](https://gdpr-info.eu/art-5-gdpr/) | The disclosure text shown under either mode names the purpose (CX feedback / NPS), enforced at the brand level via `consentTextDefault` and at the survey level via `consentTextOverride`. No change required for #276; just non-regression. |
| **CCPA** | [§1798.135 — right to opt out of sale + "Do Not Sell"](https://oag.ca.gov/privacy/ccpa) | CustomerEQ does not sell PII; CX feedback collection is service-purpose. The audit trail produced by R5 supports the `right to know` request shape (CCPA §1798.110) by attributing every consent-mode deviation to a named admin. |
| **CCPA** | §1798.105 — right to deletion | Out of scope for #276 — covered by the existing erasure job pattern. The new `consentMode` column is operational metadata, not PII. |
| **SOC2** | CC6.1 — logical access controls | The PATCH endpoint that updates `Survey.consentMode` MUST be gated by the existing brandId-scoped authorization check (project rule R6). The new field does not change the auth boundary. |
| **SOC2** | CC7.2 — change monitoring | The audit-log entry produced by R5 is queryable via the existing audit plugin (`apps/api/src/plugins/audit.ts`). The PATCH route must hit `inferAction` → `survey.update` so the change appears in the audit feed alongside other survey edits. |

**Compliance non-goals for this spec**:
- No new PII collection. The new `consentMode` column is operational metadata.
- No new data export surface.
- No new third-party data flow.

## Validation Plan

| Layer | What | How |
|---|---|---|
| **Unit (resolver)** | The resolver returns the survey-level mode when set and falls back to brand when null. | Vitest in `apps/api/src/services/consentResolver.test.ts`: 4 cases (brand=EXPLICIT/survey=null, brand=EXPLICIT/survey=IMPLIED, brand=IMPLIED/survey=null, brand=IMPLIED/survey=EXPLICIT). |
| **API integration** | The survey-response endpoint accepts / rejects based on the resolved mode. | Vitest integration in `apps/api/test/integration/public-survey-response.test.ts` against a real DB; covers all four resolver cases against the endpoint's 200/400 contract. |
| **API integration** | The PATCH survey endpoint enforces the attestation gate (R5/R6). | Same file: PATCHing to a more permissive mode without attestation returns 422; PATCHing to the same-or-stricter mode returns 200; clearing the override clears the attestation columns. |
| **Migration** | The data migration is idempotent across the unconditional `consentMode IS NULL` sweep. | Direct psql replay of the migration SQL twice with `ON_ERROR_STOP=1`; assert `Survey.updatedAt` advances on the first run for affected rows and does NOT advance on the second run. CI gate from #270 catches non-idempotency on fresh DB. |
| **Migration** | The migration preserves any pre-existing operator-set `consentMode`. | Seed three surveys: one with `consentMode = NULL`, one with `consentMode = EXPLICIT`, one with `consentMode = IMPLIED_ON_SUBMIT`; run migration; assert only the NULL row is touched and the other two are unchanged. |
| **E2E (deferred to #241)** | Operator flow through the survey-editor UX (open settings panel, switch mode, attest with reason, save, see badge). | Out of scope for #276 — the survey-editor UX itself ships in #241; the API contract that #241 binds to is verified in the API integration tests above. |
| **Compliance verification** | Audit log captures the attesting user, timestamp, AND reason. | Integration test asserts the audit-log row exists with `action = 'survey.update'`, `metadata.consentMode = 'IMPLIED_ON_SUBMIT'`, `metadata.consentReason` containing the supplied reason text, and `actorUserId = <test user>`. |
| **Smoke (post-deploy)** | Pre-existing surveys accept responses again without manual intervention. | Curl the public endpoint against a known pre-#231 survey ID + manual confirmation in the admin UI that the badge shows the migration attribution. |

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Flip the brand default for affected brands from `EXPLICIT` to `IMPLIED_ON_SUBMIT`.** | Unblocks production but is the wrong long-term default — `EXPLICIT` was the intentional #231 default for a reason (most brands' compliance posture). Loses per-survey expressiveness forever. |
| **Bypass the consent check in the survey-response endpoint when `data.consent` is absent (treat absence as implied).** | Silent regression of #231's design intent. Removes the operator's ability to require explicit consent at all. Compliance-hostile. |
| **Defer #276 entirely; tell operators to flip their brand mode via Organization Settings (sibling issue).** | Production is blocked today; the sibling Organization Settings issue isn't shipping today. Even when it does, it doesn't give per-survey expressiveness. |
| **Add `consentMode` to `Survey.settings` JSON blob instead of a typed column.** | Loses Prisma type safety, loses the ability to index, complicates the migration's WHERE clause, doesn't reuse the existing `ConsentMode` enum. JSON blob is the right place for dispositional/UX settings, not for schema-shaped policy state. |
| **Make `Survey.consentMode` non-nullable and require an explicit `INHERIT_FROM_BRAND` enum value.** | See Q1 above — pollutes the shared `ConsentMode` enum with a value that's only meaningful in a child context, forces every consumer to handle the inherit case explicitly. |

## Competitive Analysis

This feature is **compliance and policy plumbing**, not a customer-visible differentiator — operators don't choose CustomerEQ for the shape of its consent settings UI. Per project rule R3 (Feature Parity Trap), the analysis below stays brief and avoids fabricating competitor specifics that would only exist to fill a checklist.

### Industry posture (surveyed via product docs / public help centers)

| Tool | Consent surface | Per-survey override of brand/account default? | Source |
|---|---|---|---|
| Typeform | Form-builder GDPR consent question type; opt-in checkbox at form level. | Effectively yes, but framed as a per-form question rather than a per-form mode override of an account-wide policy. | [Typeform GDPR consent docs](https://help.typeform.com/hc/en-us/articles/360029259452-Comply-with-the-GDPR-using-Typeform) (current as of 2026-04, our last verification) |
| SurveyMonkey | Per-survey consent / disclaimer setting in the survey settings panel. | Yes, but no concept of "brand default" — every survey is configured individually. | [SurveyMonkey help: Consent collection](https://help.surveymonkey.com/) (general help; per-survey settings live under "Consent") |
| Qualtrics XM | Library-level "Informed Consent" element added to surveys; account/brand defaults via library reuse. | Yes via library inheritance — the library element acts as the default; per-survey edits override. Closer in shape to what #276 ships. | Qualtrics XM Library docs (public help center; subject to change) |
| Medallia | Heavily consent-gated by design; account-level policy with per-survey exception flow gated by an internal review queue. | Yes, but heavy-process — "per-survey exceptions" require workflow approval, not just admin attestation. | Medallia public collateral (compliance posture; per-survey exception flow detail not publicly documented) |
| Annex Cloud | Loyalty-program platform with embedded surveys; consent is account-wide. | No clear per-survey override surface in public docs. | Annex Cloud public marketing pages (consent capture not detailed) |

### Differentiation strategy

CustomerEQ does not compete on consent-form richness. The relevant CustomerEQ differentiation that this feature **preserves** (does not erode):

- **Operator agility over policy bureaucracy.** Per-survey override with single-step admin attestation matches the CustomerEQ posture (operators move fast; the audit trail catches the receipt later) rather than Medallia's review-queue model. The attestation modal is the lightweight middle ground.
- **Single consistent consent abstraction across the funnel.** The consent resolver already abstracts brand-level + survey-level + suppression text in one place (`apps/api/src/services/consentResolver.ts`); #276 extends that abstraction without adding a new system. Most competitors above have parallel mechanisms (per-survey consent question + account-wide policy + integration consent) that don't share a resolver.

### Why no `fraim/config.json` `competitors` update for this issue

The FRAIM phase warns that the `competitors` config is not set. Adding a `competitors` list at this point would either (a) anchor on the narrow lens of "consent plumbing" and produce a list useless for other features, or (b) anchor on the broader CX-loyalty market and not be specific to #276. The right place to set `competitors` is the brand-creation / business-validation job, not a P0 hotfix spec. Recommend deferring to a dedicated `project-onboarding` pass.

### Research sources

- Typeform GDPR consent docs (last verified during this spec drafting: 2026-05-04).
- SurveyMonkey general help center, "Consent collection" search.
- Qualtrics XM Library help (public).
- Medallia public marketing collateral.
- Annex Cloud public marketing site.
- CustomerEQ codebase: `apps/api/src/services/consentResolver.ts`, `packages/database/prisma/schema.prisma` Survey + Brand models.

> Caveat: competitor product docs are subject to change without notice. The shapes named above are current to the best of my knowledge as of the date in the source line; if the implementation review surfaces a contradiction with current docs, prefer the contradiction.

## Out of Scope

- **Survey-editor UI for the consent panel** (radio options, attestation modal with reason input, audit-trail badge with reason) — belongs to **#241 (Survey Admin UX epic)**. The mock at `docs/feature-specs/mocks/276-view.html` is informational input to #241, not a #276 deliverable.
- **Brand-level Organization Settings page** that lets admins toggle the brand-wide `consentMode`. Belongs to **#277 (Organization Settings umbrella)**; this spec assumes the brand default is set via Clerk-webhook auto-provision (#239) or ad-hoc admin SQL until that lands.
- **Backfill of `consentTextOverride` text or `consentTextDefault` brand text** for pre-existing surveys. The migration sets the *mode* only; the disclosure text continues to fall back to the brand default (which may be empty for legacy brands — a separate operator-facing nudge is filed if needed).
- **Cross-survey bulk operations** ("set all surveys in this program to Implied") — explicitly out of scope; surveys are configured one at a time via #241's editor.
- **Audit-log dashboard** for viewing all consent-mode deviations across surveys — the audit plugin already captures the events (R8); surfacing them in a UI is a separate observability ask.
