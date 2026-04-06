# Feature Specification: Survey Trigger Wizard — Decision Support for When and What Type of Survey to Send
Issue: #79
PR: (to be linked after push)

## Completeness Evidence
- Issue tagged with label `phase:spec`: No (will update after PR)
- Issue tagged with label `status:needs-review`: Yes (will update after PR)
- All specification documents committed/synced to branch: Yes

| Customer Research Area | Sources of Information |
|------------------------|----------------------|
| Survey strategy decision support | Issue #79 requirements (R31–R34) derived from Issue #75 UX analysis |
| Trigger-to-type recommendation mapping | CX methodology standards (CSAT for moment-level quality, NPS for relationship health, CES for friction) |
| Estimated reach computation | Issue spec + existing `GET /v1/analytics/program-health` pattern for DB-backed member counts |
| Competitor survey trigger approaches | Qualtrics, Typeform, SurveyMonkey, Medallia, Delighted, Yotpo product documentation (April 2026) |
| Existing UI patterns | `docs/feature-specs/mocks/75-marketing-manager-flow.html` Scenario 5 (pre-existing mock) |

| PR Comment | How Addressed |
|------------|---------------|
| (No prior feedback — initial spec submission) | — |

## Work Completed

### Files Created
- `docs/feature-specs/79-survey-trigger-wizard.md` — Full spec with 7 requirements (R31–R37), 6 error states, compliance section, validation plan, alternatives table, competitive analysis
- `docs/feature-specs/mocks/79-survey-trigger-wizard.html` — Interactive HTML mock with 4 scenarios:
  - Scenario A: Happy path — Loyalty Moment → Tier Upgrade → CSAT (interactive sub-trigger + override)
  - Scenario B: Validation errors (no category, no sub-trigger, reach unavailable)
  - Scenario C: CX Risk Moment → After Support Interaction → CES recommended, overridden to NPS
  - Scenario D: No earn rules configured — Loyalty Moment empty state

### Approach
- Grounded R31–R34 from Issue #75 spec into concrete, testable requirements with Given/When/Then acceptance criteria
- Added R35 (persistence), R36 (reach estimate fallback), R37 (dynamic sub-triggers) to close gaps found during drafting
- Matched existing CustomerEQ admin shell: indigo #6366f1, zinc neutrals, 12px border-radius, wizard sidebar pattern
- Mock is fully interactive (JavaScript-driven category/sub-trigger/override selections, real recommendation text per trigger)

## Validation
- Spec completeness checklist: all 7 requirements present with AC, compliance section explicit, design standards documented
- Mock renders in browser: 4 scenarios cover happy path, all 3 error classes, and empty program state
- Competitive analysis: 6 competitors analyzed, 4 differentiation pillars documented

## Quality Checks
- ✅ All deliverables complete (spec + mock)
- ✅ Requirements R31–R37 have testable acceptance criteria
- ✅ Error states for all 6 failure scenarios documented
- ✅ Compliance section explicit (no PII, no regulatory obligations)
- ✅ Design standards section references existing design baseline
- ✅ Validation plan covers Playwright E2E, API integration, and unit tests
- ✅ Mock matches existing admin shell design language

## Phase Completion
All 5 phases completed:
1. `context-gathering` — read #79, #75, existing spec/mock, #35 survey builder
2. `spec-drafting` — created `79-survey-trigger-wizard.md` + `79-survey-trigger-wizard.html`
3. `competitor-analysis` — 6 competitors analyzed inline (Qualtrics, Typeform, SurveyMonkey, Medallia, Delighted, Yotpo)
4. `spec-completeness-review` — all sections verified present and complete
5. `spec-submission` — this document

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| Sub-trigger options for Loyalty Moment should be dynamically loaded from earn rules — not a static list. Discovered during requirements extraction that a static list would be stale as soon as the operator reconfigures their program. | No rule file updated — this is a domain-specific design decision captured in R37 of the spec. |
| Reach estimate needs a graceful unavailable state for programs with < 7 days of history. Without this, early-stage programs would see misleading "~0 members" estimates. | No rule file updated — captured as R36 in spec. |
