# Feature Specification: Split brand-level theme from per-survey overrides

Issue: [#291](https://github.com/mathursrus/CustomerEQ/issues/291)
PR: (linked once opened)

## Completeness Evidence

- Issue tagged with label `phase:spec`: Yes (will be applied at submission)
- Issue tagged with label `status:needs-review`: Yes (will be applied at submission)
- All specification documents committed/synced to branch: Yes
  - `docs/feature-specs/291-brandtheme-surveytheme-split.md`
  - `docs/feature-specs/mocks/291-view.html`
  - `docs/evidence/291-feature-specification-evidence.md` (this file)

### Customer Research

| Customer Research Area | Sources of Information |
|---|---|
| The wrongness of conflating brand identity with per-survey overrides on `SurveyTheme` | PR #290 review threads on the #277 RFC: [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842) — both reviewers agreed the model is structurally wrong and named the 6 fields. |
| Origin of the current `SurveyTheme` shape | `docs/feature-specs/36-survey-theming.md` — the original spec described a single editor that conflated brand identity, per-survey copy, and a default-flag. |
| What downstream surfaces will read the brand-level theme | `docs/feature-specs/277-organization-settings.md` (F4 Look & Feel) explicitly defers the underlying theme model to this RFC and names "BrandTheme" and "four default themes". Future consumers (member portal, embed, emails) will read brand identity directly. |
| Existing schema state | `packages/database/prisma/schema.prisma:692-730` (`SurveyTheme`); `:193-233` (`Brand` — `logoUrl` already exists at L199, `defaultThemeId` exists at L211 without `@relation` due to drift comment); `:599-636` (`Survey`). |
| Migration history (no longer drifted) | `packages/database/prisma/migrations/20260427200452_add_survey_distribution/migration.sql:60-88` (CREATE TABLE `survey_themes`); `20260430000000_patch_survey_distribution_gap/migration.sql:124-128` (`surveys.themeId` FK). The drift comment in schema.prisma is stale. |
| Existing read sites that bind theme to brand identity / per-survey copy | `apps/web/src/app/survey/[id]/page.tsx` lines 347, 364, 413, 446, 476 (renderer); `apps/web/src/components/themes/ThemeForm.tsx` lines 11-28, 49-51, 170-181, 255-264, 309-311, 386, 415-425, 497-517, 529-548 (admin editor); `apps/api/src/routes/themes.ts` lines 31-36, 116-125 (default-toggle pair). |
| Compliance posture for a model rename / column move | `fraim/config.json:49-66` — GDPR/CCPA in-scope, SOC2 target month-12, PCI-DSS minimal. The 6 moved fields are org-authored configuration, not respondent / member PII. No new compliance obligations beyond preserving the existing audit trail. |

### Phase Completion Trace

| Phase | Outcome | Evidence |
|---|---|---|
| context-gathering | Issue loaded; schema, migrations, route handlers, admin UI, and renderer surfaces enumerated; compliance reconciled. | seekMentoring(complete) — see findings block. |
| spec-drafting | Spec doc + mock authored. | `docs/feature-specs/291-brandtheme-surveytheme-split.md`, `docs/feature-specs/mocks/291-view.html` |
| competitor-analysis | N/A — internal model refactor, no customer-visible surface change. Defers to #36's existing matrix. | spec § "Competitive Analysis" |
| spec-completeness-review | Traceability matrix maps all 6 issue ACs to spec requirements R1–R14. Mock-vs-spec sync verified across 3 scenes. | spec body; seekMentoring(complete) findings. |
| spec-submission | This document + commit + PR + label update. | (in progress) |

### Reviewer Threads (post-submission)

| PR Comment | How Addressed |
|---|---|
| _(none yet — populated after first review round)_ | _(per-thread reply with resolving commit SHA at resolution time, per validated-pattern P-HIGH 8.0)_ |

## Validation

- **Mock structural review**: Three scenes present (`#scene-theme-editor`, `#scene-theme-list`, `#scene-survey-builder`); chrome reuses `#36`'s top-bar / sidebar / color-picker styling so the diff is a visible prune of the existing editor; no new design tokens introduced.
- **Traceability**: All 6 issue ACs map to one or more requirements in R1–R14 (matrix in spec body and in completeness-review findings).
- **Compliance**: GDPR/CCPA/SOC2/PCI-DSS section walks each obligation; the only meaningful posture change is "data minimization improved" (one less duplicated field on the brand-theme row).
- **Project rules satisfied**: R6 (`brandId` from JWT) — no change in route handlers' brandId source. R10 (branch-issue link) — branch `feature/291-refactor-split-brandtheme-from-surveytheme-prune-brand-level-fields-out-of-survey-theme` is tied to #291. R21 (one issue per branch) — branch carries only #291 work; this commit only adds the spec + mock + this evidence.

## Quality Checks

- ✅ Spec doc covers all template sections (Customer / Desired Outcome / Problem / UX / Compliance / Validation Plan / Alternatives / Competitive Analysis / Open Questions / References / Design Standards Applied).
- ✅ HTML mock authored, no Markdown UI mocks (per FRAIM principle).
- ✅ Compliance section explicitly addresses each configured regulation rather than "no compliance applicable" boilerplate.
- ✅ Open decisions surfaced as numbered DR1/DR2/DR3 with `← recommended` defaults for one-round resolution.
- ✅ Evidence document concrete (file paths + line numbers + commit references), not "made some changes."

## Where Past Learnings Fired

| Learning | Where it fired this cycle |
|---|---|
| `Asserted facts about file/config without reading the primary source first` (P-HIGH 8.0) | Verified `fraim/config.json` directly (lines 49-66) instead of trusting the mentor's "compliance not configured" warning. The warning is a known false-positive — captured durably in `reference_fraim_connect_overdue_learnings_false_positive.md`. |
| `Open decisions framed with ← recommended get one-round answers` (P-HIGH 8.0) | DR1/DR2/DR3 surfaced with numbered options + `← recommended` default + one-line tradeoff. Same shape will land at the bottom of the PR body. |
| `Filing backlog issues proactively for deferred work` (P-MED 5.0) | Out of Scope section explicitly defers per-region variants, theme inheritance, packages/consent-text decoupling, and the four-default-themes seed — the seed deferral cites #277 as the owner; the others are self-contained "add issue when a real consumer asks." No premature backlog issues filed. |
| `Tight PR scope — no opportunistic scope creep` (P-HIGH 8.0) | The branch carries only #291 work — no incidental schema-comment fixes for unrelated drift, no "while we're here" refactors. The stale drift comment at schema.prisma:206-210 is removed in implementation phase, not in this spec. |
| `Overcorrected toward generating unnecessary artifacts on broad approvals` (P-MED 4.0) | Competitive analysis is N/A and stated as such — did not generate a duplicate matrix that would shadow #36's existing one. |
| `Audit-trail design omitted the WHY column` (P-MED 5.0) | N/A this cycle — no new attestation surface introduced. The migration is a one-time schema change, not a runtime mutation, so no AuditEvent rows are required. |
| `Drafted downstream-surface scope into a P0 production hotfix instead of deferring` (P-HIGH 8.0) | Out of Scope section is explicit: per-region variants, theme inheritance, consent-text decoupling, and the seed mechanism are deferred with one-line rationale each — not buried in narrative. |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| Refactor specs benefit from a tight "what is binding vs what is implementation choice" framing — issue #291 explicitly leaves rename-vs-new-model and column-vs-override-row to the implementation. Surfacing those as DRs (not specifying them) keeps the spec focused on the binding contract. | (none — this is a one-off scope discipline call, not a rule. If a second refactor spec follows the same shape, promote to a feedback memory.) |
| Brand-level vs per-entity field placement is a recurring schema-shape question (#291 is the second one in this repo after #277's `Brand.timezone` / `Brand.locale` decisions). The deciding question is "which row's lifecycle does this field share?" — brand identity outlives any single survey; per-survey copy lives and dies with the survey. | (informational — fits as a "design heuristic" sub-bullet under existing field-placement guidance if a third instance arises.) |
