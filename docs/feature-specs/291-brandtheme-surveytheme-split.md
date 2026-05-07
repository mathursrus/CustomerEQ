# Feature: Split brand-level theme from per-survey overrides

Issue: #291
Owner: Claude (claude-opus-4-7)
Status: draft (phase:spec-drafting)

> **Closes:** #291.
> **Blocks:** [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (Organization Settings) — F4 (Look & Feel) explicitly defers the underlying theme model to this RFC.
> **Cross-refs:** [#36](https://github.com/mathursrus/CustomerEQ/issues/36) (origin spec for the current `SurveyTheme` model), [#290](https://github.com/mathursrus/CustomerEQ/pull/290) (review threads where the split was surfaced — [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842)).

---

## Customer

Two customers.

1. **Brand admins** who manage their organization's visual identity (color scheme, logo, brand name) — they expect that identity to live at the **brand** level so it is reusable beyond surveys (member portals, embedded widgets, emails). When they edit a "theme" today, the editor mixes brand identity (logo, brand name) with per-survey copy (thank-you message, redirect URL, incentive-points display) and a "default theme" toggle. That conflation is wrong on its face, but it is also a forward-compat problem: any surface that wants to reuse the brand's visual identity (member portal, email templates, future embed widgets) cannot point at `SurveyTheme` without inheriting per-survey concerns it does not need.

2. **CustomerEQ engineering** working under #277 (Organization Settings page). #277 must add `Brand.defaultThemeId` and surface a brand-default theme picker — but the FK target is the load-bearing question. Pointing the FK at `SurveyTheme.id` would lock the schema into a model both reviewers on #290 agreed is structurally wrong. #291 is the prerequisite that makes #277 mergeable without that lock-in.

## Customer's Desired Outcome

> "A brand has *one* visual identity (colors, typography, layout, logo, brand name). Surveys may reference it, but per-survey copy (thank-you wording, redirect URL, incentive-points toggle) lives on the survey, not on the brand's theme."

Concretely:

- The brand-level theme model exposes only colors, typography, layout, logo, and brand name — surfaces beyond surveys (member portal, embeds, emails) can consume it without dragging per-survey copy into the read.
- The survey row owns per-survey thank-you copy, redirect URL, and incentive-points display — surveys may diverge from each other without each one needing its own theme row.
- The brand row owns "which theme is the default" via an FK — `Brand.defaultThemeId` — replacing the `SurveyTheme.isDefault` boolean (which permits the impossible state of multiple defaults per brand and depends on transactional updateMany-then-update sequences to enforce uniqueness).
- #277's Look & Feel section can ship against a stable, brand-shaped theme model. The four-default-themes seed contract that #277 owns lands on the model #291 produces here.

## Customer Problem being solved

`SurveyTheme` (`packages/database/prisma/schema.prisma:692-730`) carries 6 fields that do not belong on a per-survey-rendering theme:

| Field (schema.prisma line) | Belongs on | Why |
|---|---|---|
| `logoUrl` (699) | `Brand` | A brand has one logo. `Brand.logoUrl` already exists (line 199, shipped under #170 / #190). The duplicate on `SurveyTheme` is dead weight. |
| `brandName` (700) | `Brand` (already present as `Brand.name`) | A brand has one name. Today the renderer has to decide which of `theme.brandName` or `survey.brand.name` wins — the field exists only because the original spec mistakenly let an admin "override the display name per-theme." |
| `thankYouMessage` (719) | `Survey` | Per-survey copy. Two surveys under the same brand can have different thank-you wording (e.g. NPS vs. CSAT post-purchase). |
| `thankYouRedirectUrl` (720) | `Survey` | Per-survey routing. Some surveys redirect to `/rewards`, others to `/account`. |
| `showIncentivePoints` (721) | `Survey` | Per-survey toggle. Whether to render the points-earned tile depends on whether the survey awards points, not on the brand's visual identity. |
| `isDefault` (697) | `Brand.defaultThemeId` (FK) | A brand has *one* default. A boolean on every theme row admits a multi-default state and depends on application-level uniqueness enforcement (`updateMany` clear + `update` set in `apps/api/src/routes/themes.ts:31-36, 116-125`). The natural shape is an FK on `Brand`. |

The remaining attributes — colors, typography, layout — *are* the brand's visual style and form the brand-level theme.

This split is binding for #277 because PR #290's RFC was preparing to add `Brand.defaultThemeId → SurveyTheme.id`. Shipping that FK against a model both parties agree is wrong locks the schema into the wrong shape; #277 cannot ship the FK until the target model is right.

## User Experience that will solve the problem

The visible end-state is a **smaller, more focused** theme editor and a small **new "Thank you" section** on the survey builder. No new surfaces are introduced; existing surfaces are re-partitioned along the right concern boundaries. Public survey rendering is byte-for-byte identical post-migration (the renderer reads from the new locations but produces the same DOM).

### Surface 1 — Theme editor (`/admin/settings/themes/new` and `/admin/settings/themes/:id`)

Removed from the editor:

- **Brand tab** (logo upload, brand name override) — these belong on the Organization Settings page (#277, F2 / F1) where the brand's identity is configured once.
- **Thank-you tab** (thank-you message, redirect URL, show-incentive-points checkbox) — moves to the survey builder (Surface 2).
- **"Set as default theme" checkbox** (the form's `isDefault` field) — replaced by a row-level "Set as default" action on the theme list page that calls the existing `POST /v1/themes/:id/default` endpoint. The endpoint stays; the checkbox in the form goes away.

Retained: **Colors**, **Typography**, **Layout** tabs (no field changes within these).

The "Default" badge on the theme list (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx:97-102`) keeps its current shape — backed by the new `Brand.defaultThemeId` FK rather than the per-row `isDefault` boolean.

### Surface 2 — Survey builder (`/admin/surveys/new` and `/admin/surveys/:id/edit`)

A new **Thank you** section is added to the survey-edit form, slotted alongside the existing Incentive Points field (`apps/web/src/app/(admin)/admin/surveys/new/page.tsx:391-401`). The section contains exactly the three fields that move out of `SurveyTheme`:

- **Thank-you message** (text, ≤500 chars, default "Thank you for your feedback!")
- **Thank-you redirect URL** (URL, optional)
- **Show incentive points** (checkbox, default true — only meaningful if the survey awards points)

Per-survey UX is unchanged: filling these fields produces the same survey-completion experience that today comes from filling them on the theme. The change is which entity owns them.

### Surface 3 — Organization Settings page (#277)

`Brand.defaultThemeId` becomes a real FK with a real `@relation` and the four-default-themes seed contract from #277's F4 lands here. #291's contract to #277 is: "the model exists, has the brand-level fields #277 expects, and supports the seed mechanism." Implementation of the seed itself is owned by #277.

### Public survey rendering — no visible change

`apps/web/src/app/survey/[id]/page.tsx` renders the survey-completion page using `theme.thankYouMessage`, `theme.thankYouRedirectUrl`, `theme.showIncentivePoints`, `theme.logoUrl`, and `theme.brandName` today (lines 347, 364, 413, 446, 476). Post-refactor the same DOM is produced by reading:

- `theme.logoUrl` → `survey.brand.logoUrl` (or the brand-theme's logo if a future BrandTheme model carries one — see DR2)
- `theme.brandName` → `survey.brand.name`
- `theme.thankYouMessage` → `survey.thankYouMessage`
- `theme.thankYouRedirectUrl` → `survey.thankYouRedirectUrl`
- `theme.showIncentivePoints` → `survey.showIncentivePoints`

This is a renderer-side rebind; no respondent-visible change.

### UI mocks

High-fidelity HTML mock at [`./mocks/291-view.html`](./mocks/291-view.html). Two scenes:

- **`#scene-theme-editor`** — theme editor *after* the prune. The Brand and Thank-you tabs are gone; only Colors, Typography, Layout remain. The form footer no longer shows the "Set as default theme" checkbox; instead, the row-level "Set as default" action is illustrated on the list view in scene 2.
- **`#scene-survey-builder`** — the new Thank-you section in the survey-edit form, slotted next to Incentive Points. Three controls: thank-you message textarea, redirect URL input, show-incentive-points checkbox.

Mocks deliberately reuse the existing `[#36](./mocks/36-theme-editor.html)` chrome (sidebar, top bar, color-picker styling) so the diff is visually obvious — the change is what the editor *does not* show, not a redesign.

## Out of scope

- **Per-region / per-locale theme variants.** Issue #291 is a model split, not a multi-locale design. Defer until a concrete consumer asks.
- **Theme inheritance / override mechanics** ("a SurveyTheme extends from BrandTheme"). Defer until a concrete consumer (e.g. a sub-brand wanting to override one color) asks. The current model is a flat brand-level theme; if inheritance is needed later, it lands as its own issue.
- **`packages/consent-text` decoupling.** That is #277's territory.
- **The four-default-themes seed.** Owned by #277. #291's responsibility is to provide a model that supports it; the seed itself ships with #277.
- **Renaming `Brand.logoUrl`.** It already exists at the right place; #291 does not duplicate, move, or rename it. (Surface 3 callout above is informational only.)

## Acceptance criteria & Requirements

Requirements are SHALL-style with traceability tags (R1, R2, …). Acceptance criteria are paired with each requirement in `Given/When/Then` form where it adds clarity beyond the SHALL.

### Schema (R1–R5)

- **R1.** The brand-level theme model SHALL NOT carry `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, or `isDefault` columns. The current `SurveyTheme` model is the prune target.
  - *Given* a fresh DB, *when* `prisma migrate dev` runs to head, *then* `\d survey_themes` (or whatever the renamed table becomes — see DR2) returns no column named `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, or `isDefault`.
- **R2.** `Brand` SHALL expose the brand-level identity already known to be brand-shaped: `Brand.logoUrl` (already exists, no change) and `Brand.defaultThemeId String?` with a real Prisma `@relation` to the brand-theme model. The drift comment at `schema.prisma:206-210` SHALL be removed when the relation is restored.
- **R3.** `Survey` SHALL gain `thankYouMessage String @default("Thank you for your feedback!")`, `thankYouRedirectUrl String?`, `showIncentivePoints Boolean @default(true)` — the same shape and defaults the fields had on `SurveyTheme`.
- **R4.** A forward-only Prisma migration SHALL execute the column moves (drop on the brand-theme table, add on `Survey`, FK on `Brand`). Pre-drop the migration SHALL `SELECT` for any `survey_themes` row whose `logoUrl`, `brandName`, `thankYouRedirectUrl` is non-NULL OR `thankYouMessage` differs from the default OR `showIncentivePoints` is FALSE OR `isDefault` is TRUE; if any are found, the migration SHALL preserve those values onto the corresponding `Survey` rows (joined via `Survey.themeId`) and onto `Brand.defaultThemeId` for the `isDefault=TRUE` row, before the column drop runs. (See DR1 for the data-preservation vs. unconditional-drop tradeoff.)
- **R5.** The migration SHALL be reviewable in a single PR diff: schema delta, migration SQL, and the cross-package code changes that follow ship together. No follow-up "drift fix" PR.

### API (R6–R8)

- **R6.** `GET /v1/themes`, `POST /v1/themes`, `GET/PATCH/DELETE /v1/themes/:id`, `POST /v1/themes/:id/default` (`apps/api/src/routes/themes.ts`) SHALL accept and return only the colors / typography / layout fields plus `id`, `brandId`, `name`, `_count.surveys`, `createdAt`, `updatedAt`. The `isDefault` boolean returned by these endpoints SHALL be a derived value (`brand.defaultThemeId === theme.id`) — not a stored column.
- **R7.** `POST /v1/themes/:id/default` SHALL update `Brand.defaultThemeId = :id` in a single statement; the `updateMany`-clear-then-`update`-set sequence at `themes.ts:116-125` SHALL be removed.
- **R8.** Survey routes (`apps/api/src/routes/surveys.ts`) — `POST /v1/surveys` and `PATCH /v1/surveys/:id` — SHALL accept `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` on the body and persist them to the corresponding `Survey` columns. The Zod schemas (`packages/shared/src/zod/survey.schema.ts`) SHALL be split: the create/update theme schemas SHALL drop these three plus `logoUrl`, `brandName`, `isDefault`; the create/update survey schemas SHALL gain the three.

### UI (R9–R11)

- **R9.** The theme editor (`apps/web/src/components/themes/ThemeForm.tsx`) SHALL NOT render input controls for `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, or `isDefault`. The preview pane SHALL NOT render the brand-name placeholder or the thank-you screen.
- **R10.** The theme list page (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx`) SHALL show a row-level "Set as default" action that calls `POST /v1/themes/:id/default`. The "Default" badge SHALL be backed by the derived `isDefault` (R6), not a per-row boolean.
- **R11.** The survey builder (`apps/web/src/app/(admin)/admin/surveys/new/page.tsx` and `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx`) SHALL render a "Thank you" section with three controls: thank-you message textarea (≤500 chars), redirect URL input, show-incentive-points checkbox. The section saves via the survey PATCH endpoint (R8).

### Renderer (R12)

- **R12.** The public survey page (`apps/web/src/app/survey/[id]/page.tsx`) SHALL read `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` from the survey row, and `logoUrl` / `brandName` from the survey's brand row. The rendered DOM for the survey-completion page SHALL be byte-for-byte identical to pre-refactor for any survey whose three new columns hold the values that were previously on its theme row (or on the theme defaults). Snapshot-test asserts this.

### Tests & seeds (R13)

- **R13.** Unit tests (`packages/shared/src/zod/survey.schema.test.ts`), E2E tests (`apps/web/test/e2e/themes-crud-pattern.spec.ts`), and seed scripts (`packages/config/src/test-utils/db/seed.ts`, `examples/acme-coffee-demo/seed-acme.mjs`) SHALL be updated in the same PR to use the new field locations. No leftover references to `theme.logoUrl`, `theme.brandName`, `theme.thankYouMessage`, `theme.thankYouRedirectUrl`, `theme.showIncentivePoints`, or `theme.isDefault` remain in the repo (`grep` clean).

### Migration verification (R14)

- **R14.** The implementation SHALL run `pnpm prisma migrate dev` against a real Docker-backed Postgres before submission, not only static checks. (Per L1 mistake-pattern: migrations validated against a real DB before PR submission.)

## Compliance Requirements

`fraim/config.json` lists **GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope)** for CustomerEQ overall.

#291 is a **schema rename / column move** with no PII change. The fields moved (logo URL, brand name, thank-you copy, redirect URL, incentive-points toggle, default-theme flag) are organization-level configuration, not respondent or member data. The compliance posture for each regulation:

| Obligation | Source | Control on this refactor |
|---|---|---|
| Lawful basis (Art. 6) / Right to know / Right to delete | GDPR / CCPA | **No change.** No member or respondent PII is added, removed, or relocated. The `Survey` columns gained (`thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`) are org-authored copy, not respondent data. |
| Data minimization (Art. 5(1)(c)) | GDPR | **Improved.** The brand-theme row no longer carries `brandName` (which duplicated `Brand.name`) — one less field replicated across rows. |
| Audit trail (CC7.2 — change management) | SOC2 (target M-12) | The forward migration is a single reviewable diff (R5). The pre-drop verify-and-preserve step (R4) ensures no admin-authored configuration is silently lost. The migration SQL itself is the audit record. No `AuditEvent` rows are emitted by the migration; this is a one-time schema change, not a runtime mutation. |
| Logical access (CC6.1) | SOC2 | **No change.** The split routes / Zod schemas keep the existing admin role gate. `brandId` continues to flow only from the verified JWT (project rule R6). |
| Cardholder data scope | PCI-DSS (minimal) | **Out of scope.** No cardholder data on either model. |

**Compliance validation** (covered in Validation Plan):

- An integration test asserts `prisma migrate dev` applies cleanly against a fresh Postgres and that the verify-and-preserve step (R4) writes the expected values onto `Survey` / `Brand` for any non-default `survey_themes` row.
- A grep-level cross-package check asserts no production code still reads the dropped fields (R13) — protects against a half-applied refactor that compiles but reads NULL at runtime.
- Existing audit-trail tests on `AuditEvent` are unaffected (no new audit hooks introduced).

## Validation Plan

| Step | Method | Expected result |
|---|---|---|
| Migration applies on fresh Postgres | `docker compose up -d postgres && pnpm prisma migrate reset && pnpm prisma migrate dev` | Migration runs to head; `\d survey_themes` (or renamed table) shows no pruned columns; `\d surveys` shows the three new columns; `\d brands` shows `defaultThemeId` with the FK constraint. |
| Migration on a DB with non-default theme rows preserves data | Integration test against a Docker-backed DB seeded with: a theme row whose `thankYouMessage` is custom, `showIncentivePoints` is FALSE, and `isDefault` is TRUE; a survey pointing at that theme | After migrate: the survey row carries the custom `thankYouMessage` and `showIncentivePoints=FALSE`; the brand row's `defaultThemeId` points at that theme. The dropped columns are gone from the theme row. |
| Theme editor — no logo / brand-name / thank-you fields | Browser: `/admin/settings/themes/new` | Only Colors, Typography, Layout tabs render. Form footer has no "Set as default" checkbox. Save persists the theme; `GET /v1/themes/:id` returns no pruned fields. |
| Theme list — set-default via row action | Browser: `/admin/settings/themes` → click "Set as default" on a row | Row's badge updates to "Default"; the previously-default row's badge clears; `Brand.defaultThemeId` in the DB matches the clicked row. |
| Survey builder — thank-you section renders and saves | Browser: `/admin/surveys/new` → fill basic survey + Thank-you section → save | Survey row in DB has the entered `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`. Edit page round-trips the values. |
| Public survey completion page — DOM unchanged | Playwright snapshot: respondent completes a survey whose new columns mirror the previous theme values | Completion-page DOM byte-matches the pre-refactor snapshot for that survey. |
| Public survey completion — redirect honored from `Survey` | Playwright: respondent completes a survey whose `thankYouRedirectUrl` is set on the survey row (not on the theme) | After 3s the browser navigates to the configured URL. |
| Cross-package grep clean | `git grep -nE "(logoUrl\|brandName\|thankYouMessage\|thankYouRedirectUrl\|showIncentivePoints\|isDefault)" -- 'packages/shared/src/zod/' 'apps/api/src/routes/themes.ts' 'apps/web/src/components/themes/' 'apps/web/test/'` | Returns 0 lines that reference the pruned theme fields. (Brand-side `logoUrl` references are expected and excluded.) |
| Smoke + unit + integration suites | `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration` | All four pass. |
| Compliance — GDPR/CCPA control map | Code-level inspection | No member / respondent PII is added or moved. Org-authored copy fields (`thankYouMessage` etc.) move from one org-row to another org-row. |

## Alternatives

| Alternative | Why discard? |
|---|---|
| Leave `SurveyTheme` as-is and add `Brand.defaultThemeId → SurveyTheme.id` in #277. | Locks the schema into a model both PR #290 reviewers agreed is structurally wrong. The 6 fields would still be wrong on the theme; every consumer (member portal, embed, email) would still inherit per-survey concerns. The lock-in is the explicit reason #291 was filed. |
| Move only `isDefault` (the FK problem) and leave the other 5 fields on `SurveyTheme`. | Resolves #277's immediate FK question but leaves the model still wrong. A second refactor would land later when a non-survey consumer (member portal) tries to read the brand's theme and finds `thankYouRedirectUrl` on it. Doing both moves in one PR is cheaper than doing them in two. |
| Introduce theme inheritance now (`SurveyTheme extends from BrandTheme`). | Adds complexity (override resolution, partial-row writes, UI for "what does this survey override?") for zero current consumers. Defer until a concrete consumer asks. The flat-model split is the right scope today. |
| Keep `isDefault` boolean and enforce uniqueness via a partial unique index `WHERE isDefault = true`. | Solves multi-default but leaves the natural shape ("brand has one default") expressed as a constraint instead of a relationship. The FK on `Brand` is the natural shape. |
| Stash the per-survey fields on a new `SurveyOverride` row (1:1 with `Survey`). | Adds a join for every survey read for no clear benefit at this scope. The fields are simple, low-cardinality, per-survey scalars — `Survey` columns are the right shape. (See DR3 for the explicit decision.) |
| Multi-step migration: drop fields in PR A, add to `Survey` in PR B, switch the renderer in PR C. | Forces an interim state where the renderer reads from a column that no longer exists or that has not been backfilled. A single-PR forward migration with verify-and-preserve is the safer shape. |

## Competitive Analysis

#291 is an **internal data-model refactor**, not a customer-facing feature. There is no competitive surface to analyze for this issue specifically — the public outcome (a branded survey) is identical pre- and post-refactor. The competitive analysis for *survey theming* lives on the original feature spec [#36](./36-survey-theming.md§competitive-analysis), which compared CustomerEQ against Qualtrics, SurveyMonkey, Typeform, Medallia, and Delighted. None of that competitive positioning changes here; #291 only re-partitions internal concerns.

## Open Questions / Decisions for the reviewer

| # | Question | Options | Recommendation | Trade-off |
|---|---|---|---|---|
| **DR1** | Forward-only DROP vs. data-preserving migration. Issue body says "no production rows hold the legacy fields populated since #157 didn't seed defaults; verify before drop." | a) Unconditional DROP — simpler, smaller migration. <br> b) Verify-and-preserve — `SELECT` non-default rows; if any, copy values onto `Survey` / `Brand.defaultThemeId` before drop; if none, behave as (a). | **(b) ← recommended** | (a) is simpler but violates the issue's "verify before drop" condition and risks silently losing admin-customised `thankYouMessage` / `showIncentivePoints` / `isDefault`. (b) is one extra DO-block in the migration SQL. The cost of (b) is small relative to the cost of (a) on a single brand whose admin had configured a custom thank-you message. R4 currently encodes (b). |
| **DR2** | Rename `SurveyTheme` → `BrandTheme` vs. introduce a new `BrandTheme` model and leave `SurveyTheme` empty (or drop it). | a) **Rename** the existing `SurveyTheme` model to `BrandTheme`; the table renames in the same migration. <br> b) Introduce a new `BrandTheme` model and drop `SurveyTheme` entirely; recreate any references fresh. | **(a) ← recommended** | (a) preserves row identities (the `Brand.defaultThemeId` FK lands on the same rows that exist today). The Survey.themeId FK retargets to the renamed table. Less code churn, smaller migration. (b) is cleaner from a "the model is new" framing but rebuilds nothing of value and forces extra data-migration code to copy rows over. #277's spec language already uses "BrandTheme" — that naming should land here. |
| **DR3** | Where Survey-level overrides land: directly on `Survey` columns vs. a thinner `SurveyOverride` row. | a) Three columns directly on `Survey` (`thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`). <br> b) A new `SurveyOverride` 1:1 row joined via `Survey.surveyOverrideId`. | **(a) ← recommended** | (a) is what the fields look like in product semantics — they are simple, per-survey, low-cardinality scalars. (b) adds a join for every survey render with no concrete benefit; the model would be empty most of the time given the defaults on the columns. The issue body explicitly leaves the choice open ("either way they leave the brand theme") — the lighter shape is right. |

## References

- Schema: `packages/database/prisma/schema.prisma:692-730` (`SurveyTheme`), `:193-233` (`Brand`), `:599-636` (`Survey`).
- Existing migration: `packages/database/prisma/migrations/20260427200452_add_survey_distribution/migration.sql:60-88` (creates `survey_themes`).
- Drift-restoration migration: `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql:124-128` (adds `surveys.themeId` FK).
- Original SurveyTheme spec: `docs/feature-specs/36-survey-theming.md`.
- Blocking spec: `docs/feature-specs/277-organization-settings.md` (F4 Look & Feel).
- PR #290 review threads: [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842).
- Mocks: `docs/feature-specs/mocks/291-view.html`.
- Project rules: R6 (brandId from JWT), R10 (branch-issue link), R21 (one issue per branch). All satisfied — branch `feature/291-refactor-split-brandtheme-from-surveytheme-prune-brand-level-fields-out-of-survey-theme` is tied to #291.

## Design Standards Applied

- Source: `docs/architecture/architecture.md` (authoritative tech / pattern decisions).
- Mock chrome reuses `[#36](./mocks/36-theme-editor.html)`'s top bar, sidebar, and color-picker styling — the change is a *prune* of the existing editor, not a redesign, so visual continuity is the right standard.
- The new "Thank you" section on the survey builder uses the same form-row pattern as the existing Incentive Points field (`apps/web/src/app/(admin)/admin/surveys/new/page.tsx:391-401`) — shared label + input + helper-text shape; no new design tokens introduced.
