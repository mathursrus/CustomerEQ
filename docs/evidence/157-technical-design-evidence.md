# Feature: Standardize list → view → edit navigation pattern across CRUD entities
Issue: #157
Feature Spec: None — Issue body is the source of truth (no `docs/feature-specs/157-*.md`).
PR: To be linked at design-submission phase.

## Completeness Evidence
 - Issue tagged with label `phase:design`: Yes
 - Issue tagged with label `status:needs-review`: To be added at submission
 - All files committed/synced to branch: Pending submission
 - PR Comment table:

| PR Comment | How Addressed |
| :--- | :--- |
| (None yet — RFC just authored.) | — |

### Traceability Matrix

Source: GitHub issue #157 acceptance criteria. Each AC is mapped to the RFC section that implements it.

| Requirement / User Story (from Issue #157) | RFC Section / Data Model | Status | Validation Plan Alignment |
| :--- | :--- | :--- | :--- |
| **Alert Rules — AC1**: Create `apps/web/src/app/(admin)/admin/alerts/rules/[id]/page.tsx` — view-only with `ViewOnlyBanner` | Technical Details → Route Changes (NEW row for `alerts/rules/[id]/page.tsx`) | Met | E2E: "Operator clicks an alert rule name in the list" → asserts URL + banner + disabled inputs |
| **Alert Rules — AC2**: Update list `href` from `/alerts/rules/${rule.id}/edit` to `/alerts/rules/${rule.id}` | Technical Details → Route Changes (modify `alerts/rules/page.tsx`) | Met | E2E: list-name click navigates to view route |
| **Alert Rules — AC3**: Add separate "Edit" link in row actions | Technical Details → Route Changes (modify `alerts/rules/page.tsx`) | Met | E2E: "Operator clicks the row's 'Edit' action on the alert rules list" |
| **Alert Rules — AC4**: Rule form accepts `mode: 'view' \| 'edit'` and disables fields when `mode='view'` | Technical Details → Component 2 — Extract `AlertRuleForm` | Met (extended to `'create' \| 'edit' \| 'view'` to also dedupe the new/page form per rule #15) | Unit: `AlertRuleForm.test.tsx` mode-disabling cases; integration: webhook-mask preservation |
| **Campaigns — AC1**: Create `apps/web/src/app/(admin)/admin/campaigns/[id]/page.tsx` — view-only with `ViewOnlyBanner` | Technical Details → Route Changes (NEW row for `campaigns/[id]/page.tsx`) | Met | E2E: "Operator views a campaign by clicking its name" |
| **Campaigns — AC2**: Make campaign name a clickable `Link` to `/campaigns/{id}` in the list | Technical Details → Route Changes (modify `campaigns/page.tsx`) | Met | E2E (covered by the same scenario above) |
| **Campaigns — AC3**: Update `CampaignActions` primary action to link to view route; keep "Edit" as secondary | Technical Details → Route Changes (modify `CampaignActions.tsx`) | Met | E2E: pattern check — primary action lands on view route |
| **Campaigns — AC4**: Campaign form accepts `mode: 'view' \| 'edit'` and disables fields when `mode='view'` | Technical Details → Component 4 — Extend `CampaignForm` | Met (widening existing `mode` union from `'create' \| 'edit'` to `'create' \| 'edit' \| 'view'`) | Unit: add `mode='view'` cases to `CampaignForm.test.tsx` |
| **Themes — AC1**: Refactor `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx` to be view-only with `ViewOnlyBanner` | Technical Details → Route Changes (modify `themes/[id]/page.tsx`) | Met | E2E: "Operator opens a stale bookmark to `/admin/settings/themes/{id}`" → asserts read-only render |
| **Themes — AC2**: Create `apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx` for editing | Technical Details → Route Changes (NEW row for `themes/[id]/edit/page.tsx`) | Met | E2E: "Operator views a theme; clicks 'Edit Theme' in banner; modifies a color; saves" |
| **Themes — AC3**: Theme form accepts `mode: 'view' \| 'edit'` and disables fields when `mode='view'` | Technical Details → Component 3 — Extract `ThemeForm` | Met (extended to `'create' \| 'edit' \| 'view'` to also dedupe new/page form per rule #15) | Unit: `ThemeForm.test.tsx` mode-disabling cases |
| **Pattern Standard table from Issue body** (4-route layout for all new CRUD entities) | Technical Details → Standard CRUD Route Layout + Architecture Updates → Update 1 (architecture.md §3.1 paragraph) + Update 2 (ADR 0001) | Met | Architecture-doc update validated by reviewer in PR; ADR captures one-way-door rationale |

**Result**: Pass — every AC in the issue body has a corresponding section in the RFC. No Unmet rows. Validation plan in the RFC covers each AC with a unit, integration, or E2E test (the matrix above shows the alignment).

### Architectural Gaps Documented for User Review

These are the gaps surfaced by the architecture-gap-review phase. They do not block this completeness review. Resolution happens in the address-feedback phase after the user weighs in via the PR.

| Gap | Why it's needed | Suggested resolution (in RFC) |
| :--- | :--- | :--- |
| Standard CRUD admin route pattern not in `architecture.md` §3.1 | Three of five route-based admin entities currently deviate; future entities will continue to drift without a documented standard | Add the proposed paragraph to §3.1 (Update 1 in RFC) |
| Form-mode prop convention (`mode: 'create' \| 'edit' \| 'view'`) not documented | Programs proves the pattern; this RFC propagates it to 3 more entities; needs a single source of truth | Bundled into the same §3.1 paragraph (Update 1) |
| `ViewOnlyBanner` not documented as the standard admin read-mode chrome | Becoming a cross-entity standard — currently only used by Programs | Reference from §3.1's new paragraph and the ADR |
| `docs/architecture/adr/` directory does not exist | Project rule #4 mandates ADRs for one-way doors; the Themes URL contract change is one such door | Create the directory and add `0001-admin-crud-route-pattern.md` (Update 2 in RFC) |
| Shared test utils convention (rule #8) not explicitly applied to new form factories | Plan adds `alertRuleFactory()` / `themeFactory()` style fixtures; rule mandates these live in `packages/config/src/test-utils/` | Implementation detail — applied during PR work, no architecture-doc change needed |

## Due Diligence Evidence
 - Reviewed feature spec in detail (if feature spec present): N/A — no feature spec exists for #157; issue body is the spec
 - Reviewed codebase in detail to understand and repro the issue: Yes — read all 12 admin list pages plus the Programs reference plus the existing Alert Rules / Campaigns / Themes / Surveys implementations; identified the form-duplication second-order problem
 - Included detailed design, validation plan, test strategy in doc: Yes — RFC has Technical Details (per-entity), Validation Plan, Test Matrix, Risks & Mitigations, Architecture Analysis sections

## Prototype & Validation Evidence
 - [x] Built simple proof-of-concept that works end-to-end — N/A by spike-first criteria; the pattern is already in production via Programs (`/admin/programs/[id]` view-only + `/admin/programs/[id]/edit` since Issue #2)
 - [x] Manually tested complete user flow (browser/curl) — Programs reference flow is live; this RFC propagates the proven pattern
 - [x] Verified solution actually works before designing architecture — Programs is the live verification
 - [x] Identified minimal viable implementation — split into 4 PRs (one leading PR for `ViewOnlyBanner` widening + one per entity)
 - [x] Documented what works vs. what's overengineered — RFC explicitly scopes out inline-editing entities (KB Articles, Support Rules, Integrations) per the broken-windows report

## Continuous Learning

| Learning | Agent Rule Updates |
| :--- | :--- |
| When standardizing a UI pattern across multiple entities, the bigger architectural risk is often the form-code duplication, not the navigation fix itself. Project rule #15 (Fix at the Right Abstraction Level) makes extracting the shared form mandatory rather than optional when the same form lives in two files of ~450+ LOC. | No new rule needed — `project_rules.md` rule #15 already covers this. The RFC explicitly cites rule #15 as the rationale for the form extraction so future agents see the connection. |
| Frontend pattern standards belong in `architecture.md` §3.1 alongside the existing "Admin home entry point" / "Context-aware navigation" / "Client-side utilities" bullets — not in a separate doc. | No new rule. Followed the existing convention. |
| The ADR directory does not yet exist in this repo; rule #4 needs it. Issue #157's URL-contract change (Themes) is a fitting first ADR. | No new rule — rule #4 already exists; this RFC creates the directory it implies. |
