# Feature Specification: Survey response data model rework — auto-enrollment, recurring responses, polymorphic identifier

Issue: #231
PR: *(see below — created as part of this submission)*
Branch: `feature/issue-231-survey-response-data-model-rework`
Date: 2026-05-02
Agent: manohar.madhira@outlook.com (Claude, FRAIM `feature-specification` job)

---

## Completeness Evidence

- Issue tagged `phase:spec`: No — label not used in repo
- Issue tagged `status:needs-review`: Added in this submission
- Spec committed/synced to branch: **Yes**
- Open Questions: **5/5 resolved with proposed positions** awaiting user iteration in PR review

### Customer Research Areas

| Customer Research Area | Sources of Information |
|---|---|
| Brand admin / integrator pain — member-must-exist constraint | Issue #231 body, [#225 ArtistOS comment](https://github.com/mathursrus/CustomerEQ/issues/225#issuecomment-4362090471), constituent gap comments (15a, 17, 20, 21, 23 in #225) |
| Canonical V0 direction (auto-enroll, polymorphic identifier, optional consentGivenAt, default-MULTIPLE responsePolicy) | [Issue #231 user comment dated 2026-05-03](https://github.com/mathursrus/CustomerEQ/issues/231#issuecomment-4365469095) |
| Schema reality (current `Member`, `Survey`, `SurveyResponse`) | `packages/database/prisma/schema.prisma` lines 282-320, 552-581, 691-716 |
| Compliance regulations (GDPR / CCPA) | `docs/architecture/architecture.md` §10 Compliance Architecture |
| Hero #6 SLA preservation | Issue #6 acceptance criteria, project rule R5 (event-driven loyalty actions) |
| Cross-issue dependencies | Issues #225 (parent), #239 (brand auto-provisioning), #241 (survey lifecycle convergence — UI picker home), #117 (survey creation UX), #217 (JTBD picker) |
| Competitive landscape | `docs/replicate/reports/REPLICATION_ANALYSIS.md`, `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` (Annex Cloud, Yotpo, Qualtrics, Typeform/SurveyMonkey) |

### PR Comment History

| PR Comment | How Addressed |
|---|---|
| *(No prior PR comments — initial spec submission)* | N/A |

---

## Work Completed

### Files Created

| File | Description |
|---|---|
| `docs/feature-specs/231-survey-response-data-model-rework.md` | Full feature spec — Customer / Desired Outcome / Problem / UX / 14 functional requirements (R1-R14, SHALL form) / data-model migration / API surface / GDPR-CCPA Compliance section / Open Questions Q1-Q5 with proposed positions / Cross-issue dependencies / Validation Plan / Rejected design calls (framing B) / Competitive Analysis |
| `docs/feature-specs/mocks/231-brand-identifier-kind.html` | Interactive HTML/CSS mock of the brand-setup `memberIdentifierKind` picker (4 radio options + locked-in note + nav buttons) |
| `docs/evidence/231-spec-evidence.md` | This evidence document |

### Files Modified

| File | Description |
|---|---|
| Issue #231 body (via `gh issue edit`) | Updated to canonical direction; original framing's reversed design calls preserved in spec's "Alternatives — rejected design calls" appendix per user's framing-B choice |

### Approach

1. **Context gathering** (FRAIM phase 1): Read issue body + canonical comment, parent issue #225, hero #6, schema (`schema.prisma`), architecture standards (`architecture.md`), and identified the right UI-picker home (#241). Confirmed user decisions (responsePolicy stays in scope, framing B, propose-then-iterate, update issue body).
2. **Spec drafting** (FRAIM phase 2): Used `FEATURESPEC-TEMPLATE.md`. Reconciled issue body's 4 reversed design calls with user's canonical comment in a single coherent V0 design. Stated explicit positions on Q1-Q5 with rationale and tradeoffs for user iteration. Wrote 14 SHALL-form requirements with G/W/T criteria.
3. **Competitor analysis** (FRAIM phase 3): Pulled from existing project research (Annex Cloud / Yotpo / Qualtrics / Typeform). No new competitors discovered requiring `fraim/config.json` update. Differentiation pillars: native survey-as-first-class, hero #6 loop preserved, recurring-response-default for V0.
4. **Spec completeness review** (FRAIM phase 4): Traced all 6 original ACs to spec requirements (R3-R14); compliance section addresses GDPR Art. 7/15/17 and CCPA §1798.105/110; design standards section names `architecture.md` as source.
5. **Mock authoring**: Single mock for the brand-setup identifier-kind picker. The `responsePolicy` picker UI mock is delegated to **#241** (survey lifecycle convergence) per the cross-issue dependency table — not duplicated here.

### Approach Notes

- **Framing B applied**: Spec is written from the user's canonical comment forward; original issue body's design calls (memberId-nullable, drop-consentGivenAt, citext-email, anonymous-vs-auto-enroll-as-design-call) are documented in a "rejected design calls" table with the rationale for each reversal.
- **Reversal on responsePolicy**: User reversed earlier framing — `Survey.responsePolicy` enum stays in V0 scope. UI picker is delegated to #241; the schema field lands in this issue's implementation. Existing surveys migrated as `ONCE` (preserves current per-deployed-brand behavior); new surveys default to `MULTIPLE`.

---

## Validation

### How Validated

- **Mock**: Static self-validation — semantic radio-group structure, real `<label>` wrapping for click-target, accent-color CSS variable, `.selected` state synced via small JS, locked-in warning panel, primary/secondary nav buttons. Color palette matches existing admin UI (slate text, indigo accent, white surface, 12px border radius).
- **Requirements traceability**: All 6 issue ACs mapped to spec R3-R14. Additional ACs added from user comment (polymorphic identifier R4, late-arriving updates R6, bulk-migration consent preservation R8, per-survey responsePolicy override R3 + #241).
- **Schema review**: Migration plan verified against current `schema.prisma`; `(brandId, lower(email))` collision-detection guard added as pre-flight (`packages/database/scripts/`); existing `Member.consentGivenAt` already nullable (no migration needed for that field).
- **Compliance review**: Auto-enrollment lawful-basis matrix maps to GDPR Art. 6(1)(a) (EXPLICIT mode) and Art. 6(1)(f) with disclosure (IMPLIED_ON_SUBMIT mode); bulk-migration path preserves integrator-supplied `consentGivenAt`; new `externalId` field added to erasure-job and data-export field lists.

### Validation Results

- ✅ All FRAIM `feature-specification` phase requirements met (context, draft, competitor, completeness)
- ✅ Spec, mock, evidence doc all on branch
- ✅ Issue body updated to canonical direction
- ⏳ User iteration on Q1-Q5 proposed positions — pending PR review

---

## Quality Checks

- ✅ Spec follows `FEATURESPEC-TEMPLATE.md` section order
- ✅ Mock is real HTML/CSS (not a markdown code block) per project rule
- ✅ Compliance section addresses configured regulations (GDPR + CCPA per `architecture.md` §10)
- ✅ Design Standards Applied section names the source (`docs/architecture/architecture.md`)
- ✅ Competitive analysis covers 4 competitors with current solution / strengths / weaknesses / sources
- ✅ Open Questions resolved with proposed positions + tradeoffs (5/5)
- ✅ Rejected design calls documented with rationale (framing B applied honestly)
- ✅ Cross-issue dependencies explicit (#241 picker UI, #225/#239 brand-setup, #6 hero, #217 unblock)

---

## Phase Completion

| Phase | Status | Evidence |
|---|---|---|
| `context-gathering` | ✅ | seekMentoring complete; issue + canonical comment + schema + arch standards + cross-issues all reviewed |
| `spec-drafting` | ✅ | Spec + mock written; issue body updated |
| `competitor-analysis` | ✅ | 4-competitor matrix in spec; no new fraim/config.json entries needed |
| `spec-completeness-review` | ✅ | Requirements traceability, compliance, design standards, mocks all checked |
| `spec-submission` | 🔄 | This evidence doc; PR being opened |
| `address-feedback` | ⏳ | Awaiting PR review |
| `retrospective` | ⏳ | Post-merge |
