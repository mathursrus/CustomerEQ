# Feature Specification: Survey Builder — Drag-and-Drop Question Editor with Skip Logic
Issue: #35
PR: TBD (will be updated after PR creation)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Pending
- Issue tagged with label `status:needs-review`: Pending
- All specification documents committed/synced to branch: Pending

| Customer Research Area | Sources of Information |
|---|---|
| Current survey implementation | Codebase review: Prisma schema, Zod schemas, admin UI, public survey page, API routes |
| Question type requirements | Issue #35 description, competitor analysis |
| Skip logic patterns | [Qualtrics Branch Logic docs](https://www.qualtrics.com/support/survey-platform/survey-module/survey-flow/standard-elements/branch-logic/), [Qualtrics Skip Logic docs](https://www.qualtrics.com/support/survey-platform/survey-module/question-options/skip-logic/) |
| Competitive landscape | [SurveyMonkey vs Typeform 2026](https://www.softwareadvice.com/customer-satisfaction/surveymonkey-profile/vs/typeform/), [Medallia Admin Suite](https://www.medallia.com/platform/admin-suite/), [Qualaroo Capterra 2026](https://www.capterra.com/p/114046/Qualaroo/) |
| Accessibility requirements | WCAG 2.1 AA guidelines (inferred — no formal compliance config) |

| PR Comment | How Addressed |
|---|---|
| (No feedback yet) | — |

## Deliverables

| Artifact | Path | Description |
|---|---|---|
| Feature Spec | `docs/feature-specs/35-survey-builder.md` | Full specification with user stories, data models, acceptance criteria, validation plan |
| UI Mock | `docs/feature-specs/mocks/35-survey-builder.html` | Interactive HTML/CSS mock of the three-panel survey builder (palette, canvas, config) |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| CustomerEQ survey schema already supports `choice` type but UI doesn't render it — always verify both schema and rendering when assessing current capabilities | None (observation noted in spec) |
| Existing `DEFAULT_QUESTIONS` structure is a valid subset of the new extended schema — backward compatibility is achievable without migration | None (documented in spec migration section) |
