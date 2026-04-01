# Feature Specification: [UC-09] Configure Loyalty Program

Issue: #2
PR: *(see below — created as part of this submission)*
Branch: `feature/2-issue-2`
Date: 2026-03-24
Agent: manohar.madhira@outlook.com

---

## Completeness Evidence

- Issue tagged with label `phase:spec`: No — label does not exist in repo yet; `enhancement`, `p0`, `loyalty-engine`, `admin`, `phase-1` are present
- Issue tagged with label `status:needs-review`: No — being added as part of this submission
- All specification documents committed/synced to branch: **Yes** (see Work Completed below)

### Customer Research Areas

| Customer Research Area | Sources of Information |
|------------------------|------------------------|
| Admin / Program Owner workflow and pain points | Issue #2 body (UC-09), `docs/replicate/analysis/use-cases.md#uc-09`, `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` |
| Program types and configuration requirements | Issue #2 technical requirements, Annex Cloud replication analysis (`docs/replicate/reports/REPLICATION_ANALYSIS.md`) |
| Rules engine complexity and AND/OR logic | Issue #2 acceptance criteria, UC-09 use case steps, Annex Cloud feature audit |
| Tier configuration (names, criteria, multipliers) | Issue #2 data models, `docs/replicate/analysis/use-cases.md`, Annex Cloud loyalty-program-templates-and-instances |
| Compliance requirements (GDPR/CCPA) | `fraim/personalized-employee/rules/project_rules.md` Rule 13, `fraim/config.json` compliance settings |
| Competitive landscape | Web research: Yotpo (support.yotpo.com), Smile.io (help.smile.io), LoyaltyLion (loyaltylion.com), Antavo (antavo.com, Gartner Peer Insights), Annex Cloud (annexcloud.com/implementation-process/) — all sourced 2026-03-24 |

### PR Comment History

| PR Comment | How Addressed |
|------------|---------------|
| *(No prior PR comments — initial spec submission)* | N/A |

---

## Work Completed

### Files Created

| File | Description |
|------|-------------|
| `docs/feature-specs/2-configure-loyalty-program.md` | Full feature specification (Customer, Desired Outcome, Problem, 7-step UX, Compliance, Validation Plan, Alternatives, Competitive Analysis, Technical Summary) |
| `docs/feature-specs/mocks/2-view.html` | Interactive HTML/CSS/JS mock of the 7-step program configuration wizard |

### Approach

1. **Context gathering**: Read Issue #2, UC-09 from `use-cases.md`, project rules, architecture doc, and implementation roadmap to fully understand scope, constraints, and dependencies.
2. **Spec drafting**: Created comprehensive spec using FRAIM template covering all user-facing workflow steps, compliance controls, API shape, data model outline, and implementation order guidance.
3. **Mock creation**: Built fully interactive HTML wizard mock covering all 7 steps:
   - Step 1: Program type selector (4 types with visual cards)
   - Step 2: Basic info form (name, description, dates, currency symbol)
   - Step 3: Rules engine with composable AND/OR condition builder, two sample rules
   - Step 4: Tier ladder (Bronze/Silver/Gold/Platinum with multipliers)
   - Step 5: Rewards catalog (two rewards with tier eligibility)
   - Step 6: Budget controls (total cap, monthly cap, alert threshold, halt behavior)
   - Step 7: Preview panel (phone mock of member experience + rule simulation + activation modal)
4. **Competitive research**: Live web research on 5 competitors (Annex Cloud, Yotpo, Smile.io, LoyaltyLion, Antavo) with sourced URLs and dates. Discovered Antavo as a new competitor not previously in config.
5. **Mock validation**: Opened mock in browser via Playwright, navigated all 7 steps, ran simulation, verified activation modal — all pass. Only console issue: favicon 404 (benign).

---

## Validation

### Mock Validation (Playwright browser test)

| Step | Result |
|------|--------|
| Step 1 — Program Type: 4 type cards render, "Points" pre-selected | ✅ PASS |
| Step 2 — Basic Info: form fields populated, navigation works | ✅ PASS |
| Step 3 — Earning Rules: AND/OR buttons, condition dropdowns, budget cap, 2 rules | ✅ PASS |
| Step 4 — Tier Configuration: Bronze/Silver/Gold/Platinum ladder with multipliers | ✅ PASS |
| Step 5 — Rewards Catalog: 2 rewards with tier eligibility controls | ✅ PASS |
| Step 6 — Budget Controls: total + monthly cap, alert threshold, halt behavior | ✅ PASS |
| Step 7 — Preview: checklist, simulation panel, phone mock, activation modal | ✅ PASS |
| Simulation: $120 Electronics/web → Rule 1 fires → 240 Stars (2× multiplier) | ✅ PASS |
| Activation modal: program name re-entry required | ✅ PASS |
| Stepper: shows ✓ checkmarks for completed steps | ✅ PASS |

### Requirement Coverage

| AC from Issue | Spec Section | Status |
|---------------|--------------|--------|
| Admin creates program in <30 min via wizard | 7-step wizard UX + checklist | ✅ |
| Program types: Points, Tiered, Cashback, Hybrid | Step 1 + type-conditional step visibility | ✅ |
| AND/OR condition logic | Step 3 condition builder | ✅ |
| Point multipliers by category/channel/time | Step 3 condition attributes + action types | ✅ |
| Tier names, criteria, benefits customizable | Step 4 tier ladder | ✅ |
| Budget cap enforced | Step 6 + budget halt behavior | ✅ |
| Preview mode | Step 7 phone mock + simulation | ✅ |
| Pause/reactivate without data loss | Validation Plan steps 7–8 + `PUT /status` API | ✅ |

### Compliance Review

| Control | Mechanism | Status |
|---------|-----------|--------|
| R1: Tenant scoping via JWT | `brandId` from JWT only, Prisma middleware | ✅ |
| R2: Soft deletes | `deletedAt` on Program/Rule/Tier/Reward | ✅ |
| R3: Atomic earn/burn | PostgreSQL transaction in BullMQ worker | ✅ |
| R4: Audit trail for config changes | `PUT /programs/:id` change log | ✅ |
| R5: Consent gating | `Member.consentGivenAt` check in rules engine | ✅ |

### P2 Issues (non-blocking)
- `date_range` condition attribute not in Step 3 mock (only `time_of_day`) — spec text covers "time period"; implementation should add `date_range`
- OR branch visualization not shown in mock — acceptable for spec; implementation note in spec

---

## Quality Checks

- [x] All spec sections complete (Customer, Outcome, Problem, UX, Compliance, Validation, Alternatives, Competitive Analysis, Technical Summary)
- [x] Interactive HTML mock covers all 7 wizard steps
- [x] All 8 acceptance criteria from issue mapped to spec
- [x] 5 competitors researched with sourced URLs and dates
- [x] Compliance section maps 5 controls to specific files/code locations
- [x] Design Standards Applied section present
- [x] No markdown code blocks used for UI design — HTML mock file used
- [x] New competitor (Antavo) flagged for config update
- [x] Implementation order guidance provided (schema → API → UI → tests)

---

## Phase Completion

| Phase | Status | Key Output |
|-------|--------|------------|
| context-gathering | ✅ Complete | Issue loaded, UC-09 mapped, architecture constraints understood, compliance requirements identified |
| spec-drafting | ✅ Complete | `docs/feature-specs/2-configure-loyalty-program.md` + `docs/feature-specs/mocks/2-view.html` |
| competitor-analysis | ✅ Complete | 5 competitors researched (Annex Cloud, Yotpo, Smile.io, LoyaltyLion, Antavo). 4 key differentiation pillars identified. Antavo newly discovered — proposed config addition. |
| spec-completeness-review | ✅ Complete | All 8 ACs covered. Mock renders and passes all 10 validation steps. No P0/P1 issues. |
| spec-submission | ✅ In Progress | Evidence document created; committing and submitting for review |

---

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| Antavo is a significant mid-market/enterprise competitor for loyalty program configuration — their drag-and-drop Workflows module directly competes with CustomerEQ's rules engine. Should be tracked alongside Annex Cloud. | Propose adding `"competitors": ["Annex Cloud", "Yotpo", "Smile.io", "LoyaltyLion", "Antavo"]` to `fraim/config.json` |
| The <30-minute self-serve setup SLA is a strong, defensible differentiator — Smile.io is faster (minutes) but lacks AND/OR logic; LoyaltyLion targets 30 days; Annex Cloud/Antavo require weeks. This SLA should be referenced in all future marketing content specs. | No rule file change needed — captured in spec and competitive analysis |
| Preview/simulation mode (show member experience + rule fire before activation) is a genuine market gap — no competitor has it. This feature should be highlighted in pitch decks and marketing specs. | No rule file change needed — captured in spec differentiation section |
