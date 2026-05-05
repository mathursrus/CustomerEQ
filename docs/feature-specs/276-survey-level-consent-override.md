# Feature: Survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT

Issue: [#276](https://github.com/mathursrus/CustomerEQ/issues/276)
Owner: manohar.madhira@outlook.com
Priority: **P0 — production blocked**

## Customer

A brand admin or CX operator at a brand on CustomerEQ. Today the operator owns one or more `Survey` rows under a `Brand` whose `consentMode` was set to `EXPLICIT` by #231 PR1 (the brand-wide default). Their existing surveys cannot accept new responses because the `/v1/public/surveys/:id/respond` endpoint now rejects requests that don't include explicit consent in the body, and no client they distribute (embedded form widget, email-link landing page) sends that field yet.

A second persona this spec touches is the platform itself, acting as the "system" admin that runs the one-shot data migration unblocking pre-#231 surveys.

## Customer's Desired Outcome

1. **Existing test surveys accept responses again** without the operator touching code, configuration, or each survey's settings.
2. **Per-survey consent mode override.** When the operator has a justified reason to deviate from the brand default — e.g., a low-friction NPS micro-survey on a marketing landing page where an opt-in checkbox would tank response rate — they can set that single survey to `IMPLIED_ON_SUBMIT` (or to `EXPLICIT` if the brand default is `IMPLIED_ON_SUBMIT`) without flipping the entire brand.
3. **The override is honored end-to-end**: the consent resolver, the survey-response endpoint, and the embedded form all read the resolved consent mode (survey-level if set, brand-level otherwise), not just the brand-level value.
4. **Choosing a more permissive mode than the brand default is gated.** Operators get an attestation step naming who authorized the deviation and when, so the audit trail can answer "who decided this survey doesn't require explicit consent" months later.

## Customer Problem being solved

**Direct cause (production blocker)**: #231 PR1 set `Brand.consentMode` default to `EXPLICIT` and the survey-response endpoint at `apps/api/src/routes/public.ts:276` rejects requests with `requiresExplicitConsent && data.consent !== true`. All `Survey` rows created before #231 were test fixtures created under the legacy implied-consent flow; their existing distribution channels do not send the new `consent` field. Result: every pre-#231 survey returns 400 on every response attempt. Production is blocked.

**Root design gap**: #231's consent model gave brands a single `consentMode` knob and gave each survey a `consentTextOverride` (the disclosure text) plus `consentSuppressedAttestedBy/At` (the attestation hooks for suppressing the disclosure UI), but it did **not** give each survey a way to override the consent **mode** itself. So a brand running mostly opt-in workflows but with one low-friction micro-survey has no expressive way to say so at the survey level.

**Why fix it now (not later as part of a brand-settings rework)**:
- Production is blocked today. The one-shot data migration unblocks it without operator action.
- Adding the per-survey override is the smallest cleanly-shipped change that unblocks the test surveys AND gives operators the right shape to opt other surveys out going forward.
- A brand-wide flip from `EXPLICIT` → `IMPLIED_ON_SUBMIT` would unblock production but is the wrong long-term default; per-survey is the durable control.

## User Experience that will solve the problem

### Persona A — brand admin sets a survey-level override (the durable UX)

1. Operator navigates to **Surveys → [survey name] → Settings** in the admin app.
2. New **"Consent collection"** panel inside the Settings tab shows three radio options:
   - **Inherit from brand (current: Explicit)** — preselected for new surveys; the bracketed value reflects the brand's current `consentMode` so the operator sees what "inherit" actually means.
   - **Require explicit consent** — opt-in checkbox shown to the respondent before submit.
   - **Implied on submit** — the disclosure is shown but no checkbox; submitting the survey is the consent act.
3. Choosing **the same mode as the brand** is a simple save, no extra step.
4. Choosing a **more permissive mode than the brand** (e.g., picking *Implied on submit* on a brand defaulted to *Explicit*) opens an attestation modal:
   - Title: "Confirm: more permissive than your brand default"
   - Body: explains that this survey will collect responses under implied consent while the brand default requires explicit consent, names a few legitimate reasons (low-friction micro-surveys, internal employee NPS), and warns that the operator's identity + a timestamp will be recorded.
   - Required: a "Yes, I am authorizing this deviation" checkbox + a Save action.
5. On save: the API records `Survey.consentMode = IMPLIED_ON_SUBMIT`, `Survey.consentSuppressedAttestedBy = <Clerk user id>`, `Survey.consentSuppressedAttestedAt = NOW()`.
6. The Settings tab subsequently displays a small badge next to the survey title — "Custom consent (Implied) — set by [user] on [date]" — so the deviation is visible at a glance without opening the modal again.
7. Switching back to "Inherit from brand" or to a stricter mode does **not** require attestation; only loosening the policy does.

### Persona B — system admin runs the one-shot data migration (no UX, runs in CI/CD)

A repeatable, idempotent SQL migration sets every `Survey` row that:
- Has `consentMode IS NULL` (i.e., currently inheriting), and
- Was created before the #231 PR1 deploy timestamp (so we never clobber a deliberate post-#231 inherit choice)

…to `consentMode = 'IMPLIED_ON_SUBMIT'`, with `consentSuppressedAttestedBy = '__migration_276__'` and `consentSuppressedAttestedAt = NOW()` so the audit trail clearly attributes the change to the migration rather than to a human operator. The `WHERE consentMode IS NULL` clause makes the migration safe to re-run (lessons from #270).

### Mocks

- [`docs/feature-specs/mocks/276-view.html`](mocks/276-view.html) — survey editor Settings tab with the new Consent collection panel and the attestation modal. Standalone HTML; open in any browser.

### Design Standards Applied

- Source: `docs/architecture/architecture.md` (CustomerEQ admin design system — shadcn/Tailwind v4 stack per `fraim/config.json customizations.stack.ui`).
- Mock follows the existing admin-shell layout used in `docs/feature-specs/mocks/231-brand-identifier-kind.html`: same sidebar pattern, same card / panel chrome, same primary-button / radio styling. Differences are limited to the new panel content; no novel components or tokens introduced.

## Functional Requirements

| ID | Requirement | Acceptance Criterion (Given/When/Then) |
|----|---|---|
| R1 | A `Survey` row SHALL carry an optional `consentMode` that, when non-null, overrides `Brand.consentMode` for that survey. When null, the survey inherits the brand's `consentMode`. | Given `Brand.consentMode = EXPLICIT` and `Survey.consentMode = IMPLIED_ON_SUBMIT`, when the consent resolver runs for a response on that survey, then the resolved mode is `IMPLIED_ON_SUBMIT`. |
| R2 | The consent resolver (`apps/api/src/services/consentResolver.ts`) SHALL resolve the effective mode as `survey.consentMode ?? brand.consentMode` and base its `requiresExplicitConsent` decision on that resolved value. | Existing unit tests for the resolver pass unchanged when survey.consentMode is null; new tests cover the override case for both directions (explicit-over-implied and implied-over-explicit). |
| R3 | The survey-response endpoint (`POST /v1/public/surveys/:id/respond`) SHALL honor the resolved mode end-to-end — no separate read of `brand.consentMode`. | Given a survey with `consentMode = IMPLIED_ON_SUBMIT` under a brand with `consentMode = EXPLICIT`, when the endpoint receives a response **without** the `consent` field, then the response is accepted (HTTP 200) and persisted. |
| R4 | The embedded form widget (`generateWidgetJs()` in `apps/api/src/routes/public.ts`) SHALL continue to function unchanged — the resolver-side change makes the widget transparently work for any consent mode without code change. | Smoke: widget served from a test brand-survey pair under each consent mode renders + submits successfully without modification. |
| R5 | Setting a survey to a consent mode strictly more permissive than its brand SHALL require attestation: the API stores `consentSuppressedAttestedBy = <authenticated user id>` and `consentSuppressedAttestedAt = NOW()` atomically with the consent-mode update, and refuses the update if no authenticated user is present. | Given `Brand.consentMode = EXPLICIT`, when an admin PATCHes `Survey.consentMode` to `IMPLIED_ON_SUBMIT` without the attestation flag in the request body, the API returns 422 with a structured error explaining the attestation requirement. |
| R6 | Setting a survey to the brand's mode (or to a stricter one) SHALL NOT require attestation. | Given `Brand.consentMode = IMPLIED_ON_SUBMIT`, when an admin PATCHes `Survey.consentMode` to `EXPLICIT`, the API accepts the change with no attestation payload required and clears `consentSuppressedAttestedBy/At` to NULL. |
| R7 | A one-shot, idempotent data migration SHALL set every `Survey` row created before the #231 PR1 deploy timestamp to `consentMode = 'IMPLIED_ON_SUBMIT'`, attributing the change to a fixed system identifier `__migration_276__`. The migration MUST be safe to re-run (no row state changes on second run). | Run the migration twice in succession; row counts in `_prisma_migrations` increment by 1 on the first run and 0 on the second, and no `Survey.updatedAt` advances on the second run. |
| R8 | The admin UI SHALL surface the override visibly when set: a badge on the survey row in the surveys list and a panel header in the survey settings, both naming the attesting user + timestamp. | Given a survey with attestation set, when the operator opens the survey list, then the survey row shows a "Custom consent" badge with hover tooltip displaying attester + timestamp. |
| R9 | The Prisma model + migration SHALL be authored idempotently — `CREATE TYPE` reuse is unnecessary because no new enum is introduced (the existing `ConsentMode` enum is reused), and the new column add is a single `ALTER TABLE … ADD COLUMN "consentMode" "ConsentMode"` (nullable). The migration MUST follow the project's #270 idempotency norms (no unguarded DDL that breaks on `db push`-then-`migrate deploy`). | The new schema migration applies cleanly on a fresh DB and a `db push`'d DB. Verified via the new CI gate from #270 + a local `db push` → `migrate deploy` repro. |

### Open Decisions Resolved in this Spec

These are the three open questions from the issue body. **Recommended** answer is the one carried forward in R1-R9 above; alternatives + tradeoffs are listed for the reviewer.

| # | Question | Recommended | Alternative | Why recommended over alternative |
|---|---|---|---|---|
| Q1 | **Override semantics** — enum with explicit `INHERIT_FROM_BRAND` value, OR nullable column where null = inherit? | **Nullable column.** `Survey.consentMode: ConsentMode?`. Null = inherit. | Add `INHERIT_FROM_BRAND` to `ConsentMode` enum. | Nullable-as-inherit is a Postgres / Prisma idiom that doesn't pollute the `ConsentMode` enum (which is also used by `Brand.consentMode`, where `INHERIT` would be nonsensical). Adding the enum value forces every `ConsentMode` consumer to handle a value that's only meaningful in a child context. Migration cost is identical. |
| Q2 | **Authorization shape** — reuse `Survey.consentSuppressedAttestedBy/At` (added in #231 PR1 as placeholders) or introduce a new pair of columns? | **Reuse `consentSuppressedAttestedBy/At`.** | Add `Survey.consentModeOverrideBy/At`. | The #231 PR1 fields were explicitly designed as attestation hooks for survey-level consent deviation (see comment in `consentResolver.ts:14`). Reusing them keeps the audit shape unified and avoids two parallel "who attested what" columns. The semantics generalize cleanly: the attestation now records "who authorized any consent deviation on this survey" — both `consentTextOverride = ''` (suppress UI, R17 from #231) and `consentMode != null` deviating from brand. |
| Q3 | **Migration scope** — set ALL existing `Survey` rows to `IMPLIED_ON_SUBMIT`, or only those with no responses yet? | **All existing surveys created BEFORE the #231 PR1 deploy timestamp.** Surveys created after that timestamp are left at `consentMode = NULL` (inherit) on the assumption they were created with the new brand-default behavior intentionally. | (a) All rows unconditionally; or (b) only rows with `responsesCount = 0`. | (a) risks clobbering deliberate post-#231 inherit choices. (b) is too narrow — a pre-#231 survey that managed to collect a few responses under the legacy flow would be left in a half-state where new responses still hit the EXPLICIT requirement. The "created before #231 PR1" boundary is a clean, single-pass criterion that matches the issue body's framing ("All surveys created before #231 were test fixtures"). |

If the reviewer prefers a different answer on any of these, the spec can be re-cut without rework on R3-R9 — only the migration shape (Q3) and the schema column type (Q1) would change.

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
| **Migration** | The data migration is idempotent and bounds to pre-#231-PR1 rows. | Direct psql replay of the migration SQL twice with `ON_ERROR_STOP=1`; assert `_prisma_migrations` increments once and `Survey.updatedAt` does not advance on the second run. CI gate from #270 catches non-idempotency on fresh DB. |
| **Migration** | The migration does not touch surveys created after the #231 PR1 deploy timestamp. | Seed two surveys (one pre-cutover, one post-cutover); run migration; assert pre-cutover survey gets `consentMode = IMPLIED_ON_SUBMIT`, post-cutover survey stays `consentMode = NULL`. |
| **E2E** | Operator flow: open the new survey settings panel, switch to a more permissive mode, attest, save, see the badge. | Playwright spec under `apps/web/playwright/` — adds a `276-survey-consent-override.spec.ts`. Uses an existing seeded brand + survey (no new fixture infra needed). |
| **Compliance verification** | Audit log captures the attesting user + timestamp. | Integration test asserts the audit-log row exists with `action = 'survey.update'`, `metadata.consentMode = 'IMPLIED_ON_SUBMIT'`, and `actorUserId = <test admin>`. |
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

- **Brand-level Organization Settings page** that lets operators toggle the brand-wide `consentMode`. Filed as a sibling issue per #276 cross-refs; this spec assumes the brand default is set via Clerk-webhook auto-provision (#239) or ad-hoc admin SQL until that lands.
- **Backfill of `consentTextOverride` text or `consentTextDefault` brand text** for pre-existing surveys. The migration sets the *mode* only; the disclosure text continues to fall back to the brand default (which may be empty for legacy brands — a separate operator-facing nudge is filed if needed).
- **Cross-survey bulk operations** ("set all surveys in this program to Implied") — explicitly out of scope; surveys are configured one at a time.
- **Audit-log dashboard** for viewing all consent-mode deviations across surveys — the audit plugin already captures the events; surfacing them in a UI is a separate observability ask.
