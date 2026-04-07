# Feature Specification: Response-to-Action Rule Builder and Loop Monitor
Issue: #80
PR: (to be linked after push)

## Completeness Evidence
- Issue tagged with label `phase:spec`: No (will update after PR)
- Issue tagged with label `status:needs-review`: Yes (will update after PR)
- All specification documents committed/synced to branch: Yes

| Customer Research Area | Sources of Information |
|------------------------|----------------------|
| In-context rule definition problem | Issue #80 requirements (R35–R40) derived from Issue #75 UX analysis; cross-tool hand-off identified as 5-step manual process |
| Score-range-to-action mapping | Issue #75 spec R6–R8 campaign trigger requirements |
| CX Playbook reuse pattern | Issue #80 operator persona research — mid-market marketing manager needs to standardize rule sets across surveys |
| Loop Monitor pipeline stages | Issue #6 (Real-Time CX-to-Loyalty Campaign) pipeline architecture — 5-stage feedback-to-outcome model |
| P50/P95 latency SLA | Issue #75 R8 — 15-minute feedback-to-action SLA established in existing platform design |
| Competitor CX-to-loyalty automation | Delighted, Typeform, Medallia, Qualtrics, LoyaltyLion, Yotpo product documentation (April 2026) |
| Existing UI patterns | `docs/feature-specs/mocks/79-survey-trigger-wizard.html` wizard chrome, `docs/feature-specs/mocks/75-marketing-manager-flow.html` Scenario 6 |

| PR Comment | How Addressed |
|------------|---------------|
| (No prior feedback — initial spec submission) | — |

## Work Completed

### Files Created
- `docs/feature-specs/80-response-to-action-rule-builder-and-loop-monitor.md` — Full spec with 6 requirements (R35–R40), 8 error states, compliance section, validation plan, alternatives table, competitive analysis
- `docs/feature-specs/mocks/80-response-to-action-rule-builder.html` — Interactive HTML mock with multiple scenarios covering the full wizard flow and Loop Monitor

### Requirements Covered
| Requirement | Description |
|-------------|-------------|
| R35 | Rule Builder Step — "What happens next?" wizard step with score range → action mapping |
| R36 | CX Playbooks — save/load named rule sets reusable across surveys of the same type |
| R37 | Loop Monitor — 5-stage pipeline view (Surveys Sent → Responses → Rules Matched → Campaigns Triggered → Loyalty Outcomes) |
| R38 | 48-Hour Warning — amber banner when zero campaigns triggered after 48h of first responses |
| R39 | Review & Launch Step — full-width summary step before activating a survey |
| R40 | Loop Monitor Latency Metrics — P50/P95 feedback-to-campaign latency with SLA color coding |

### API Surface Documented
- `POST /v1/cx-playbooks` — create playbook
- `GET /v1/cx-playbooks?surveyType=NPS` — list playbooks for brand
- `PUT /v1/cx-playbooks/:id` — overwrite playbook rules
- `DELETE /v1/cx-playbooks/:id` — soft-delete playbook
- `GET /v1/surveys/:id/loop-monitor` — pipeline stats with latency object

### Approach
- Extended the 4-step wizard established in #79: Steps 3 (Rule Builder) and 4 (Review & Launch) added to the existing chrome
- Rule builder pre-populates a default rule appropriate to survey type (NPS default: Detractors 0–6 → award_points 100 pts)
- Loop Monitor is survey-scoped (on the survey detail page, not the global analytics dashboard) to give zero-navigation access from survey context
- 48-hour warning clock starts from first SurveyResponse timestamp (not launch date) to account for slow-start surveys
- Playbooks are brand-scoped (not program-scoped) for cross-program reuse within the same brand
- All estimated reach and point cost figures are aggregate-only (no member PII returned to frontend)
- Inherited existing member consent gate — no new consent capture required

## Validation
- Spec completeness checklist: all 6 requirements present with Given/When/Then ACs, compliance section explicit, design standards documented
- Mock renders in browser: scenarios cover wizard Step 3, Step 4, Loop Monitor (healthy), Loop Monitor (48h warning), Loop Monitor (latency SLA breach)
- Competitive analysis: 6 competitors analyzed — Delighted, Typeform, Medallia, Qualtrics, LoyaltyLion, Yotpo; 4 differentiation pillars documented

## Quality Checks
- ✅ All deliverables complete (spec + mock)
- ✅ Requirements R35–R40 have testable Given/When/Then acceptance criteria
- ✅ Error states for all 8 failure scenarios documented
- ✅ Compliance section explicit (GDPR/CCPA consent gate, aggregate-only estimates, SOC2 audit trail)
- ✅ Design standards section references existing wizard chrome from #79
- ✅ Validation plan covers Playwright E2E (6 scenarios), API integration (curl examples), and 48h warning worker
- ✅ Mock matches existing admin shell design language (indigo #6366f1, zinc neutrals, 12px border-radius)
- ✅ API surface fully documented with request/response shapes

## Phase Completion
All 5 phases completed:
1. `context-gathering` — read #80, #79, #75, #6 pipeline architecture, existing wizard mock
2. `spec-drafting` — created `80-response-to-action-rule-builder-and-loop-monitor.md` + `80-response-to-action-rule-builder.html`
3. `competitor-analysis` — 6 competitors analyzed inline (Delighted, Typeform, Medallia, Qualtrics, LoyaltyLion, Yotpo)
4. `spec-completeness-review` — all sections verified present and complete
5. `spec-submission` — this document

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| Loop Monitor must be survey-scoped (on the survey detail page) not program-scoped (on the analytics dashboard) — placing it on the analytics dashboard would require filtering that recreates the survey detail page, losing zero-navigation access. | No rule file updated — design decision captured in Alternatives section of spec. |
| 48-hour warning clock should start from first SurveyResponse timestamp, not survey launch date — surveys can go live with no responses for days; using launch date would fire false positives. | No rule file updated — implementation detail captured in R38 AC and background worker description. |
| CX Playbooks must be brand-scoped (not program-scoped) to allow reuse across multiple loyalty programs within the same brand. | No rule file updated — design decision captured in R36 data model section. |
