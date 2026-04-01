# Feature Specification: Streamline End-to-End CX-to-Loyalty Workflows
Issue: #75
PR: (pending)

## Completeness Evidence

- Issue tagged with label `phase:spec`: No — label not yet applied
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes (feature/75-cx-loyalty-workflow-spec)

| Customer Research Area | Sources of Information |
|------------------------|------------------------|
| Member onboarding and first-earn friction | `docs/replicate/analysis/use-cases.md` UC-03, UC-04; user journey analysis |
| Hero CX-to-loyalty flow (Issue #6) | `docs/replicate/IMPLEMENTATION_ROADMAP.md`; Issue #6 description |
| Reward discovery UX | `docs/replicate/analysis/use-cases.md` UC-05; rewards catalog pattern analysis |
| Operator program setup | UC-09 (Configure Loyalty Program); Issue #2 |
| Campaign creation (CX-triggered) | UC-10, UC-11; Issue #6 |
| Analytics and SLA visibility | UC-13; Issue #7; business validation report |
| CRM integration setup UX | UC-14; Issue #9 |
| Compliance (GDPR/CCPA/SOC2/PCI) | `fraim/config.json` compliance config; `fraim/personalized-employee/rules/project_rules.md` rules 6, 13 |
| Competitive landscape | Annex Cloud, Yotpo, Smile.io, Loyalty Lion, Antavo — G2, Capterra, official docs (March 2026) |

| PR Comment | How Addressed |
|------------|---------------|
| (No prior PR feedback — first submission) | — |

---

## Work Completed

### Files Written

| File | Description |
|------|-------------|
| `docs/feature-specs/75-cx-loyalty-workflow-streamlining.md` | Full PM spec: 9 workflows, 27 requirements (R1–R27), 7 compliance requirements (R-C1–R-C7), 10-item friction inventory, validation plan, alternatives table, 5-competitor analysis with matrix and objection handling |
| `docs/feature-specs/mocks/75-member-onboarding-flow.html` | Interactive HTML/CSS mock with 3 switchable scenarios: First Login (Getting Started checklist), Hero Flow (CX→Campaign confirmation + SLA indicator), Reward Discovery (affordable-first catalog) |

### Key Decisions Made

1. **P0 friction items identified**: Hero flow member confirmation (R7, R8) and consent check on campaign trigger (R-C3) classified as P0 — they cannot wait for a polish sprint as they affect the core SLA and GDPR compliance.
2. **Affordable-first reward catalog** (R12, R13): Explicit requirement added — no existing issue specified catalog sort order or the "X more points needed" earn shortcut.
3. **Program setup wizard** (R17–R20): No existing issue specified a multi-step wizard flow. Added as a friction item (F7) and spec requirement.
4. **Latency metric in dashboard** (R10, R24): Made explicit as a verifiable SLA artifact — directly tied to the <15-min hero commitment.
5. **Two new competitors added to analysis**: Loyalty Lion and Antavo — discovered during research, not previously tracked.

---

## Validation

### Mock Validation (Playwright browser — localhost:9876)

| Scenario | Result |
|----------|--------|
| Scenario 1: First Login — Getting Started checklist, tier widget, reward CTA, toast | ✅ PASS |
| Scenario 2: Hero Flow — CX confirmation banner, activity feed, SLA progress bar | ✅ PASS |
| Scenario 3: Reward Discovery — affordable-first sort, locked reward de-emphasis, earn CTA | ✅ PASS |
| Layout sanity (no overlap/clipping/horizontal scroll) | ✅ PASS |
| Typography hierarchy and contrast | ✅ PASS |
| Scenario switcher interactivity | ✅ PASS |
| Console errors | ⚠️ P2: 1 non-blocking JS reference warning (scenario button highlight) — does not affect functionality |

### Requirement Coverage

- 27 functional requirements covering all 9 workflows in Issue #75
- 7 compliance requirements covering GDPR, CCPA, SOC2, PCI
- All 10 friction items mapped to at least one requirement
- All 5 Issue #75 success criteria traceable to at least one requirement

---

## Quality Checks

- ✅ Every requirement uses SHALL language with a testable acceptance criterion
- ✅ Compliance section explicitly addresses all 4 configured regulations
- ✅ UI mock uses generic UI baseline (shadcn/tailwind v4 color palette) — design standards noted in spec
- ✅ Competitive analysis sourced with dates; no unsupported claims
- ✅ All friction items prioritized (P0/P1/P2)
- ✅ Alternatives table explains why each alternative was discarded
- ✅ No implementation details in requirements (schema-free, UX-first)

---

## Continuous Learning

| Learning | Agent Rule Updates |
|----------|--------------------|
| CX-triggered campaign type is a distinct campaign category — not a variant of a standard campaign. Spec requires a dedicated wizard path (R21), not a flag on existing campaign builder. | No rule file update needed — captured in spec R21 |
| Member-visible SLA confirmation (R7, R8) is a P0 requirement, not a polish item. Future agents writing Issue #6 must treat hero flow member confirmation as blocking, not optional. | Consider adding to `project_rules.md` Rule 2 (Issue #6 is the Hero) |
| Loyalty Lion and Antavo are relevant mid-market competitors not previously tracked. | Propose adding to `fraim/config.json` competitors list |
