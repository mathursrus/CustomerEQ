# Feedback for Issue #231 — feature-specification Workflow

## Round 1 Feedback
*Received: 2026-05-03 (PR #259 inline review comments by rmadhira86)*

### Summary

18 inline review comments on `docs/feature-specs/231-survey-response-data-model-rework.md`. Four broad themes:

- **Cross-issue propagation (6 comments)** — requirements stated in this spec must also be linked / logged on the brand-onboarding (#225 / #239) and survey-design (#241) issues so they don't stay isolated here.
- **Migration default reversal (2 comments)** — existing surveys should migrate to `MULTIPLE`, not `ONCE`; testing the new default matters more than preserving the (incorrect) historical behavior since only test customers are in the system.
- **Schema additions (2 comments)** — add `Member.phone` symmetric to `Member.email` for PHONE identifier kind; add a "how member was enrolled" field for traceability.
- **Decisions to weigh in on (3 comments)** — case-sensitivity policy per identifier kind, purpose of `OTHER` identifier kind, scenario where consent text need not be shown.

Plus one **corrective** finding (Comment #11) — false claim that `fraim/config.json` does not declare regulations (it does). Captured as L0 coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-03T07-30-00-read-config-before-asserting-its-contents.md`.

### Comment 1 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 57 (Touchpoint 1 — Brand admin configures their identifier kind)
- **Comment**: "Make sure to add reference to the Member Identifier Kind mock into the issues covering brand onboarding."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Add a comment on issues #225 and #239 with the path to the mock and the spec section it lives under.

### Comment 2 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 85 (Survey form embedded URL: `?member_id=`)
- **Comment**: "I assume this is the path for surveys sent via link. If correct log this as a requirement for the Survey design and integration issue so this requirement does not stay isolated in this spec."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Add a comment on issue #241 with the URL-param requirement (`?member_id` type-agnostic param). Confirm in spec that the same path covers both link-distributed and embedded surveys.

### Comment 3 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 95 (mock path reference)
- **Comment**: "Where is the existing Brand Setup flow? During our walkthru, we had to insert the brand using adhoc SQL."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Acknowledge the gap — there is no existing Brand Setup UI flow in V0; #239 (auto-provision Brand from Clerk webhook) is the issue that creates Brand rows automatically. Update spec to clarify: the picker described here goes into the *to-be-built* brand-setup screen owned by #225/#239, not an existing one.

### Comment 4 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 87 (Consent UX in Touchpoint 2)
- **Comment**: "These consent UX should be integrated into the Survey design. Link to the appropriate issue. Are these properties existing today?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Link consent UX requirement to #241. Verify properties don't exist today (`Brand.consentMode`, consent-text storage) — confirmed: not in current schema. Document this in spec.

### Comment 5 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 117 (R5 — case-insensitive identifier)
- **Comment**: "In the future there could be scenarios where a brand may need customer ID to be case sensitive. 2 options - implement now case insensitive for email and phone and case sensitive for customer_id or other, or defer case sensitivity to later feature. Weigh in on the options and recommend one."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Recommend a position. Proposed: **Defer entirely for V0**. All identifier kinds are case-insensitive. When a real customer needs case-sensitive customer_id (likely for GUID-based identifiers per Comment #14), add `Brand.identifierCaseSensitive: boolean` (default `false`) gated on `memberIdentifierKind in (CUSTOMER_ID, OTHER)`. Rationale: V0 simplicity wins; one of the open-questions tradeoffs already established in the spec is "defer per-brand customizations until a real customer asks." Will add explicit recommendation + rationale in spec § Open Questions and update R5.

### Comment 6 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 129 (Member schema — auto-enrolled member fields)
- **Comment**: "We should also have a flag / field about how the member was enrolled. This could be required for traceability and allow for future features like welcoming them to a program etc."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Add `Member.enrolledVia` enum to schema. Proposed values: `MANUAL_API` (integrator POST to enroll endpoint), `BULK_IMPORT` (bulk migration import), `SURVEY_RESPONSE` (auto-enrolled via survey submission), `EMBEDDED_FORM` (auto-enrolled via embedded widget without prior identifier param), `CLERK_OAUTH` (signup via Clerk). Add a new R15 covering capture + querability for traceability.

### Comment 7 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 139 (R14 — existing surveys migrated as ONCE)
- **Comment**: "Migrate with responsePolicy = MULTIPLE. Currently we only have test customers in the system, so testing by latest feature is more important than preserving incorrect policy."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Reverse R14. Existing surveys migrate to `MULTIPLE` (the new default), not `ONCE`. Update both R14 and migration step 6 (line 201). Note in spec that this is justified by "test customers only — no production preservation concern."

### Comment 8 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 157 (`MemberIdentifierKind` enum — `OTHER` value)
- **Comment**: "What would the OTHER mean? What is the purpose?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Recommend removing `OTHER` from V0. Rationale: cannot enumerate concrete use cases beyond email/phone/customer_id. Adding `OTHER` is YAGNI — when a real need surfaces, it can be added in a forward-compatible migration. Will remove from enum + update spec text + update mock to drop the OTHER option.

### Comment 9 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 169 (Member.email comment "only populated when identifierKind = EMAIL or as PII sidecar")
- **Comment**: "Just like email, shouldn't we have Phone Number that is populated with identifierKind = PHONE?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Yes — symmetric. Add explicit `Member.phone String?` column (already exists in current schema! line 290), but tie its semantics to `identifierKind = PHONE`. When `identifierKind = PHONE`, populate `phone` with the normalized E.164 form alongside `externalId`. Clarify in spec that `email` and `phone` are PII sidecar columns; `externalId` is the canonical lookup. Future: `Member.customerId` for `CUSTOMER_ID` kind (or just leave it in `externalId` only).

### Comment 10 — UNADDRESSED (duplicate of Comment 7)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 201 (Migration step 6: `UPDATE surveys SET responsePolicy = 'ONCE'`)
- **Comment**: "As mentioned above set the default during migration to MULTIPLE for existing survey."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Same as Comment 7 — reverse to `MULTIPLE`. Single fix covers both.

### Comment 11 — UNADDRESSED (CORRECTIVE — coaching moment captured)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 210 (`fraim/config.json does not declare regulations explicitly`)
- **Comment**: "This statement is incorrect. This is the second occurrence of not reading config file. Previously you mentioned you missed because fraim mentor guided you incorrectly."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Replace line with the truth from `fraim/config.json` `customizations.compliance`: `regulations: [GDPR, CCPA, SOC2, PCI-DSS]` with statuses (GDPR/CCPA in-scope, SOC2 target Month-12, PCI-DSS minimal-scope). Add competitive-analysis section line check (separate claim about competitors-not-in-config — verify by reading; correct as needed). Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-03T07-30-00-read-config-before-asserting-its-contents.md`. Pattern: read primary source before asserting contents; do not propagate mentor warnings as facts.

### Comment 12 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 216 (Compliance table row — Privacy Policy + Terms link)
- **Comment**: "Ensure that Brand Onboarding captures Privacy Policy and Terms link. Document it with the corresponding issue. Link this requirement with the Survey creation requirement to include the text and allow Brands to edit it if needed."
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Add requirement to spec: `Brand.privacyPolicyUrl` and `Brand.termsUrl` fields captured during brand onboarding. Survey form (and member-enroll consent screens) reference these URLs. Brand admin can edit. Link to #225/#239 and #241.

### Comment 13 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 219 (Auto-enrollment lawful basis — EXPLICIT vs IMPLIED_ON_SUBMIT)
- **Comment**: "Again - ensure that this is captured / linked in the Brand Onboarding issue. Should the text for EXPLICIT and IMPLIED_ON_SUBMIT be editable centrally under Brand properties or per survey?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Recommend: **Brand-level default with per-survey override**. Mirrors the responsePolicy pattern (brand sets default, survey can override). Rationale: most brands want one canonical consent text; some surveys (internal employee NPS, CSAT after support) may need different text. Brand owns `Brand.consentTextDefault`; Survey has nullable `Survey.consentTextOverride` (falls back to brand default if null). Add to spec § Open Questions resolution + new R16. Link to #225/#239 (consent text storage) and #241 (per-survey override UI).

### Comment 14 — UNADDRESSED (informs Comment 5)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 234 (Q1 — polymorphic identifier proposal)
- **Comment**: "Agreed with the caveats stated earlier about case sensitivity. If the customerID (in future) is a GUID, then case sensitivity may be needed?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Address in conjunction with Comment 5 — the spec's V0 position remains case-insensitive; the future `Brand.identifierCaseSensitive` flag specifically enables GUID-shaped customer_ids. Document the GUID example in the spec recommendation.

### Comment 15 — ACKNOWLEDGED (no action needed)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 243 (Q3 — `member_id` URL param)
- **Comment**: "Agreed"
- **Status**: ACKNOWLEDGED — Q3 position confirmed.

### Comment 16 — ACKNOWLEDGED (no action needed)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 251 (Q4 — `Brand.consentMode`)
- **Comment**: "Agreed"
- **Status**: ACKNOWLEDGED — Q4 position confirmed (subject to text-storage refinements from Comments 12, 13).

### Comment 17 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 262 (Q5 — late-arriving updates / upsert)
- **Comment**: "Agreed. See my comments about the text. I assume this consent text would also be needed when a member explicitly joins the Program like in the Demo script. If so, ensure that there is an issue with this requirement or create one. Is there a scenario where this text need not be shown? If so, how do we handle?"
- **Status**: ADDRESSED in commit on `feature/issue-231-survey-response-data-model-rework`
- **Action**: Two parts. (a) Confirm consent text is shown on explicit member-program-join (Demo script flow — Maya enrolls → consent text shown). Verify whether issue #3 (member-enrollment) already covers this or whether to add a comment / file follow-up. (b) Recommend: there is a "no consent text" scenario for *internal* surveys where the responder population is the brand's own employees / pre-consented users — handled by `Survey.consentTextOverride = ''` (empty-string treated as "no consent UI shown") with a brand-level admin attestation that the responder population has prior consent. Document and add new R17.

### Comment 18 — ACKNOWLEDGED (no action needed)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/231-survey-response-data-model-rework.md`
- **Line**: 273 (cross-issue dependency table)
- **Comment**: "Agreed"
- **Status**: ACKNOWLEDGED — dependency-table approach confirmed.

---

## Round 1 Resolution Plan

Three categories of work to address this round, in priority order:

### A. Direct spec edits (one commit)

- Correct Comment 11 (false claim about config.json) — primary lift.
- Reverse Comments 7 + 10 (migration default → MULTIPLE).
- Add `Member.phone` symmetric column semantics (Comment 9).
- Add `Member.enrolledVia` enum + R15 (Comment 6).
- Remove `OTHER` from `MemberIdentifierKind` enum + update mock (Comment 8).
- Add `Brand.consentTextDefault`, `Survey.consentTextOverride`, R16 (Comment 13).
- Add `Brand.privacyPolicyUrl` / `Brand.termsUrl` captured during brand onboarding (Comment 12).
- Add R17 covering "no-consent-text" scenario via empty-string override + attestation (Comment 17).
- Document case-sensitivity recommendation in Open Questions (Comments 5 + 14).
- Clarify "no existing brand-setup flow exists today" (Comment 3).

### B. Cross-issue propagation (separate work — 3-4 issue comments)

Add comments linking back to this spec on:
- **#225** (parent epic, brand-onboarding requirements): identifier-kind picker, consent-mode picker, privacy-policy + terms URL fields, consent-text default field
- **#239** (auto-provision Brand): set defaults during brand provisioning
- **#241** (survey lifecycle): responsePolicy picker UI, consent-text-override field on survey, embedded-form layout with consent UX

### C. Member-enrollment consent verification (Comment 17 part a)

Verify whether issue #3 (member-enrollment) already covers consent-text-on-explicit-join. If yes — link. If no — file or add comment to track.

### Round 1 resolution status

User confirmed:
- Case-sensitivity (#5, #14): **defer entirely for V0** with rationale documented in spec R5 ✅ committed
- Cross-issue comments: **agent drafts them** ✅ in progress (separate sub-task after the spec edits commit)

All 18 comments addressed in the spec round-1 update; cross-issue comments to be drafted as a follow-up step under this same FRAIM `address-feedback` phase.
