# Feature Specification: Survey Theming & White-Labeling
Issue: #36
PR: TBD (will be updated after PR creation)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Pending
- Issue tagged with label `status:needs-review`: Pending
- All specification documents committed/synced to branch: Pending

| Customer Research Area | Sources of Information |
|---|---|
| Current survey rendering | Codebase review: public survey page, widget embed, admin survey detail page |
| Theming patterns | [Qualtrics Branded Themes](https://www.qualtrics.com/support/survey-platform/sp-administration/brand-customization-services/branded-themes/), [Qualtrics Survey Theming](https://www.qualtrics.com/support/survey-platform/survey-module/look-feel/applying-survey-themes/) |
| Competitive landscape | [Medallia Experience '26](https://www.cmswire.com/customer-experience/medallia-experience-26-insight-generation-to-customer-action-orchestration/), [Delighted Alternatives](https://qualaroo.com/blog/delighted-alternatives/) |
| Accessibility requirements | WCAG 2.1 AA color contrast ratios (inferred — no formal compliance config) |

| PR Comment | How Addressed |
|---|---|
| (No feedback yet) | — |

## Deliverables

| Artifact | Path | Description |
|---|---|---|
| Feature Spec | `docs/feature-specs/36-survey-theming.md` | Full specification with theme data model, API endpoints, CSS variable approach, validation plan |
| UI Mock | `docs/feature-specs/mocks/36-theme-editor.html` | Interactive HTML/CSS mock of theme editor with live survey preview |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| CSS custom properties (variables) are the cleanest way to apply themes without runtime style manipulation — avoids inline styles and works with SSR | None (documented in spec) |
| Qualtrics distinguishes between Dynamic Themes (free, admin-created) and Static Themes (paid, Qualtrics-designed) — this tiered approach could inform future monetization | None (documented in competitive analysis) |
