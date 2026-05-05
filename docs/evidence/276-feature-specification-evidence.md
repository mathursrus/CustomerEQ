# Issue #276 — Feature Specification Evidence

**Issue**: [#276 — \[P0\] Production hotfix: survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT](https://github.com/mathursrus/CustomerEQ/issues/276)
**Workflow**: feature-specification (FRAIM)
**Branch**: `feature/276-p0-production-hotfix-survey-level-consent-override-migrate-existing-surveys-to-implied-on-submit`

## Summary

Spec for the per-survey override of `Brand.consentMode` plus the one-shot data migration that unblocks pre-existing surveys. The spec ships **the data model + backend + migration**; the survey-editor UX itself belongs to **#241** (round-1 reviewer scope decision). The mock is informational input to #241, not a #276 deliverable.

**Round-1 reviewer responses to open questions** (PR #282):
- Q1 (override semantics) → Nullable column ✓ approved
- Q2 (auth shape) → Reuse `consentSuppressedAttestedBy/At` ✓ approved
- Q3 (migration scope) → **Flipped from recommended (timestamp boundary) to "all Survey rows across all organizations" (alternative a)**.

**Round-1 reviewer additions**:
- Persona is **marketing manager / survey owner** (admin owns brand/programs).
- Override carries a `consentReason` text field captured at attestation time, stored on `Survey`, surfaced in the audit log, and shown in the badge.
- Survey-editor UX (panel, modal, badge) deferred to #241; this spec defines only the API contract that #241 binds to.

Compliance section maps GDPR / CCPA / SOC2 to specific controls. Competitive analysis kept honest and brief per project rule R3.

## Work Completed

| File | Type | Purpose |
|---|---|---|
| `docs/feature-specs/276-survey-level-consent-override.md` | new | Spec — customer / problem / UX / 9 functional requirements (R1-R9) / 3 open-question resolutions / compliance map / validation plan / alternatives / competitor brief / out-of-scope. |
| `docs/feature-specs/mocks/276-view.html` | new | Survey-editor Settings tab with Consent collection panel (3-way Inherit/Explicit/Implied radio) + attestation modal (more-permissive trigger + checkbox + confirm) + audit-trail row + revert button. Standalone HTML, mirrors `231-brand-identifier-kind.html` style. |
| `docs/evidence/276-feature-specification-evidence.md` | new (this file) | Phase evidence doc. |

### Approach

1. **Context-gathering** read issue #276, the parent #231 RFC retro, the actual schema (Brand + Survey models), the consent resolver (`apps/api/src/services/consentResolver.ts`), the survey-response endpoint (`apps/api/src/routes/public.ts:197`), the embedded widget (`generateWidgetJs()` in same file), and confirmed no existing Organization Settings page (sibling issue out of scope).
2. **Spec drafting** translated the issue's directional solution into 9 traceable requirements, with an `Open Decisions Resolved` table answering Q1 (override semantics — nullable column), Q2 (auth shape — reuse `consentSuppressedAttestedBy/At`), Q3 (migration scope — pre-#231-PR1 timestamp boundary). Each answer carries its alternative and the deciding tradeoff so reviewer can override without breaking R3-R9.
3. **Mock authoring** mirrored the existing `231-brand-identifier-kind.html` style (same shadcn/Tailwind admin shell, same radio component, same accent token). Added: an attestation modal that fires only when the chosen mode is strictly more permissive than the brand default; an audit-trail row that shows attester + timestamp once saved; a revert button to clear the override.
4. **Compliance mapping** walked GDPR (Art. 7§1, Recital 32, Art. 5§1(b)), CCPA (§1798.135, §1798.105), and SOC2 (CC6.1, CC7.2). Explicit non-goals: no new PII collection, no new data export surface, no new third-party data flow.
5. **Competitor analysis** brief and source-cited (Typeform, SurveyMonkey, Qualtrics XM, Medallia, Annex Cloud). No `fraim/config.json` `competitors` update proposed — wrong place to anchor that list.

## Validation

- **Mock renders**: standalone HTML opens in any modern browser; interactive JS exercises the radio-change → save-button-enable → conditional-modal → attestation-checkbox → confirm flow. Static-HTML self-check; no Playwright run for a no-novel-component mock.
- **Issue AC traceability**:
  - Issue AC1 ("existing surveys accept responses without code or admin action after migration") → R7 (idempotent migration, pre-#231-PR1 boundary) + R3 (endpoint honors resolved mode).
  - Issue AC2 ("admin can set a single survey to a different mode, gated by authorization") → R1 (column) + R5 (attestation gate when more permissive) + R6 (no attestation when same/stricter).
  - Issue AC3 ("override honored end-to-end: survey-response endpoint, embedded form, consent-resolver service") → R2 (resolver reads `survey.consentMode ?? brand.consentMode`) + R3 (endpoint) + R4 (widget transparently works because the resolver is the single source of truth).
- **Open-question coverage**: all 3 issue-body open questions get an explicit row in the spec's `Open Decisions Resolved` table.
- **Compliance section present**: GDPR/CCPA/SOC2 controls each mapped to a concrete control. PCI-DSS confirmed minimal-scope and not bound by this feature.
- **Design standards section present**: names `docs/architecture/architecture.md` as source; mock styled to match the established admin shell.

## Quality Checks

- All required spec template sections populated (Customer / Problem / UX / Compliance / Validation / Alternatives / Competitive Analysis / Out of Scope).
- Mock is a real HTML file, not a markdown code block (per FRAIM principle "No Markdown Mocks").
- Open questions have recommended answers AND alternatives, framed so reviewer can override cheaply.
- Honest competitor section — did not invent matrix rows to fill the template.

## Phase Completion

| Phase | Status | Artifact |
|---|---|---|
| context-gathering | ✅ | `seekMentoring` evidence; issue #276 read; parent #231 retro read; schema + resolver + endpoint + widget code paths mapped |
| spec-drafting | ✅ | `docs/feature-specs/276-survey-level-consent-override.md` + `docs/feature-specs/mocks/276-view.html` |
| competitor-analysis | ✅ | "Competitive Analysis" section in spec — honest brief over deep matrix |
| spec-completeness-review | ✅ | Issue-AC traceability + compliance + design standards + mock checklist confirmed |
| spec-submission | ⏳ | This evidence doc + commit + push + PR |
| address-feedback | (after submission) | — |
| retrospective | (after feedback closed) | — |

## Side note: dev-environment hygiene encountered during prep

Two non-blocking issues surfaced during the prep + spec-context-gathering for #276; both filed separately, neither in scope here:

1. **#270** (closed by PR #280 earlier today) — `20260430000000_patch_survey_distribution_gap` migration was non-idempotent against a fresh DB; tripped during #276 worktree verification. Fixed and merged.
2. **#281** (filed today) — `20260504000000_survey_response_data_model_rework` migration is non-idempotent against a `db push`-then-`migrate deploy` schema (CREATE TYPE without `DO/EXCEPTION` guards). Surfaced during dev-DB recovery for #276 spec work. Recovered the dev DB via `prisma migrate resolve --applied`; the underlying file fix is logged as #281.
