# Feature: Split brand-level theme from per-survey overrides

Issue: #291
Owner: Claude (claude-opus-4-7)
Status: draft (phase:spec-drafting · round 2 — scope tightened per reviewer)

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

- The brand-level theme model exposes only colors, typography, layout — surfaces beyond surveys (member portal, embeds, emails) can consume it without dragging per-survey copy or redundant brand-name / logo-URL fields into the read.
- The survey row owns per-survey thank-you copy, redirect URL, and incentive-points display — the columns exist so admins can set them per-survey via the API today, and a follow-on issue lights up the admin UI.
- The brand row owns "which theme is the default" via an FK — `Brand.defaultThemeId` — replacing the `SurveyTheme.isDefault` boolean (which permits the impossible state of multiple defaults per brand and depends on `updateMany`-then-`update` sequences to enforce uniqueness).
- #277's Look & Feel section can ship against a stable, brand-shaped theme model.

## Customer Problem being solved

`SurveyTheme` (`packages/database/prisma/schema.prisma:692-730`) carries 6 fields that do not belong on a per-survey-rendering theme:

| Field (schema.prisma line) | Belongs on | Why |
|---|---|---|
| `logoUrl` (699) | `Brand` | A brand has one logo. `Brand.logoUrl` already exists (line 199, shipped under #170 / #190). The duplicate on `SurveyTheme` is dead weight. |
| `brandName` (700) | `Brand` (already present as `Brand.name`) | A brand has one name. The renderer today has to decide which of `theme.brandName` or `survey.brand.name` wins — the field exists only because the original spec mistakenly let an admin override the display name per-theme. |
| `thankYouMessage` (719) | `Survey` | Per-survey copy. Two surveys under the same brand can have different thank-you wording (e.g. NPS vs. CSAT post-purchase). |
| `thankYouRedirectUrl` (720) | `Survey` | Per-survey routing. Some surveys redirect to `/rewards`, others to `/account`. |
| `showIncentivePoints` (721) | `Survey` | Per-survey toggle. Whether to render the points-earned tile depends on whether the survey awards points, not on the brand's visual identity. |
| `isDefault` (697) | `Brand.defaultThemeId` (FK) | A brand has *one* default. A boolean on every theme row admits a multi-default state and depends on application-level uniqueness enforcement (`updateMany` clear + `update` set in `apps/api/src/routes/themes.ts:31-36, 116-125`). The natural shape is an FK on `Brand`. |

This split is binding for #277 because PR #290's RFC was preparing to add `Brand.defaultThemeId → SurveyTheme.id`. Shipping that FK against a model both parties agree is wrong locks the schema into the wrong shape; #277 cannot ship the FK until the target model is right.

## User Experience that will solve the problem

### Surface 1 — Theme editor (`/admin/settings/themes/new`, `/admin/settings/themes/:id`, `/admin/settings/themes/:id/edit`)

**The editor's existing layout is unchanged.** `apps/web/src/components/themes/ThemeForm.tsx` keeps its single-column flat-sections shape: a left configuration pane (Brand → Colors → Typography → Layout → Thank You → isDefault checkbox → action buttons) and a right preview pane. #291 only **drops rows** from that pane; sections that retain at least one input keep their header; sections that empty out disappear, but the surrounding chrome does not shift.

Specifically:

- **In the "Brand" section** — drop the `Logo URL` input row (`ThemeForm.tsx:411-420`) and the `Brand Name` input row (`:421-430`). Theme Name (`:402-410`) stays. The section header stays.
- **The "Thank You" section** — drop the entire section (`:491-523`): Message textarea, Redirect URL input, Show-incentive-points checkbox. The section header is removed because all its inputs are gone.
- **The "Set as default theme" checkbox section** — drop entirely (`:525-535`). The form-level `isDefault` control is gone. The existing edit-mode "Set as Default" *button* (`:548-556`) stays — its `onClick` still calls `POST /v1/themes/:id/default`, but the handler now writes `Brand.defaultThemeId` instead of toggling per-row booleans.
- **The "Default" badge in the editor heading** (`:386-390`) — stays visible. Its data source switches from `theme.isDefault` to derived (`brand.defaultThemeId === theme.id`).
- **In the right preview pane** — drop the brand-name / logo placeholder (`:170-181`) and the thank-you screen preview (`:255-264`). The survey-question preview stays.

No new sections, no new tabs, no field reordering. The post-refactor editor is the current editor with the listed rows literally removed.

### Surface 2 — Theme list (`/admin/settings/themes`)

No layout change. The "Default" badge (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx:97-102`) keeps its current shape — its data source switches from the per-row `theme.isDefault` boolean to derived `brand.defaultThemeId === theme.id`.

### Surface 3 — Public survey rendering (`apps/web/src/app/survey/[id]/page.tsx`)

No respondent-visible change. The renderer reads from new locations to keep the rendered DOM byte-for-byte identical:

- `theme.logoUrl` → `survey.brand.logoUrl`
- `theme.brandName` → `survey.brand.name`
- `theme.thankYouMessage` → `survey.thankYouMessage`
- `theme.thankYouRedirectUrl` → `survey.thankYouRedirectUrl`
- `theme.showIncentivePoints` → `survey.showIncentivePoints`

This is a renderer-side rebind and is unavoidable once the columns move — it is not a new surface or a UX change.

### Surface 4 — Organization Settings page (#277)

`Brand.defaultThemeId` becomes a real FK with a real `@relation`. The four-default-themes seed contract from #277's F4 lands on the model #291 produces. Implementation of the seed itself is owned by #277.

### UI mocks

High-fidelity HTML mock at [`./mocks/291-view.html`](./mocks/291-view.html). Single scene `#scene-theme-editor-after` shows the editor with the 6 fields removed, side-by-side with the current (before) state, so the diff is visible at a glance. No survey-builder mock — that surface is out of scope for #291.

## Out of scope

- **Admin UI for the new survey-level fields.** R8 ensures the survey API accepts `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` on the body so admins can set them via the API today. The admin form section that exposes these in the survey-edit page is **deferred to a follow-on issue** — #291 ships the schema and the API contract; the admin UX for these three fields ships separately. Filing the follow-on issue is the responsibility of whoever picks up admin-side survey UX (likely under #241 — Survey Admin UX epic).
- **Per-region / per-locale theme variants.** Defer until a real consumer asks.
- **Theme inheritance** ("SurveyTheme extends from BrandTheme"). Defer until a sub-brand override is requested.
- **`packages/consent-text` decoupling.** That is #277's territory.
- **Four-default-themes seed.** Owned by #277. #291's responsibility is to provide a model that supports it; the seed itself ships with #277.
- **Renaming `Brand.logoUrl`.** It already exists at the right place; #291 does not duplicate, move, or rename it.

## Acceptance criteria & Requirements

Requirements are SHALL-style with traceability tags (R1, R2, …).

### Schema (R1–R5)

- **R1.** The brand-level theme model SHALL NOT carry `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, or `isDefault` columns.
- **R2.** `Brand` SHALL expose the brand-level identity already known to be brand-shaped: `Brand.logoUrl` (already exists, no change) and `Brand.defaultThemeId String?` with a real Prisma `@relation` to the brand-theme model. The drift comment at `schema.prisma:206-210` SHALL be removed when the relation is restored.
- **R3.** `Survey` SHALL gain `thankYouMessage String @default("Thank you for your feedback!")`, `thankYouRedirectUrl String?`, `showIncentivePoints Boolean @default(true)` — the same shape and defaults the fields had on `SurveyTheme`.
- **R4.** A forward-only Prisma migration SHALL execute the column moves (drop on the brand-theme table, add on `Survey`, FK on `Brand`). Pre-drop the migration SHALL `SELECT` for any `survey_themes` row whose `logoUrl`, `brandName`, `thankYouRedirectUrl` is non-NULL OR `thankYouMessage` differs from the default OR `showIncentivePoints` is FALSE OR `isDefault` is TRUE; if any are found, the migration SHALL preserve those values onto the corresponding `Survey` rows (joined via `Survey.themeId`) and onto `Brand.defaultThemeId` for the `isDefault=TRUE` row, before the column drop runs. (See DR1.)
- **R5.** The migration SHALL be reviewable in a single PR diff: schema delta, migration SQL, and the cross-package code changes that follow ship together.

### API (R6–R8)

- **R6.** `GET /v1/themes`, `POST /v1/themes`, `GET/PATCH/DELETE /v1/themes/:id`, `POST /v1/themes/:id/default` (`apps/api/src/routes/themes.ts`) SHALL accept and return only the colors / typography / layout fields plus `id`, `brandId`, `name`, `_count.surveys`, `createdAt`, `updatedAt`. The `isDefault` returned by these endpoints SHALL be a derived value (`brand.defaultThemeId === theme.id`) — not a stored column.
- **R7.** `POST /v1/themes/:id/default` SHALL update `Brand.defaultThemeId = :id` in a single statement; the `updateMany`-clear-then-`update`-set sequence at `themes.ts:116-125` SHALL be removed.
- **R8.** Survey routes (`apps/api/src/routes/surveys.ts`) — `POST /v1/surveys` and `PATCH /v1/surveys/:id` — SHALL accept `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` on the body and persist them to the corresponding `Survey` columns. The Zod schemas (`packages/shared/src/zod/survey.schema.ts`) SHALL be split: the create/update theme schemas SHALL drop these three plus `logoUrl`, `brandName`, `isDefault`; the create/update survey schemas SHALL gain the three. **No admin-UI surface in this issue.**

### UI (R9–R10)

- **R9.** The theme editor (`apps/web/src/components/themes/ThemeForm.tsx`) SHALL drop the input rows enumerated in *Surface 1* without any other layout change. No new sections, no new tabs, no reordering.
- **R10.** The theme list page (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx`) SHALL keep its current shape; the "Default" badge SHALL be backed by the derived `isDefault` (R6).

### Renderer (R11)

- **R11.** The public survey page (`apps/web/src/app/survey/[id]/page.tsx`) SHALL read `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` from the survey row, and `logoUrl` / `brandName` from the survey's brand row. The rendered DOM for the survey-completion page SHALL be byte-for-byte identical to pre-refactor for any survey whose three new columns hold the values that were previously on its theme row (or on the theme defaults). Snapshot-test asserts this.

### Tests & seeds (R12)

- **R12.** Unit tests (`packages/shared/src/zod/survey.schema.test.ts`), E2E tests (`apps/web/test/e2e/themes-crud-pattern.spec.ts`), and seed scripts (`packages/config/src/test-utils/db/seed.ts`, `examples/acme-coffee-demo/seed-acme.mjs`) SHALL be updated in the same PR to use the new field locations. No leftover references to `theme.logoUrl`, `theme.brandName`, `theme.thankYouMessage`, `theme.thankYouRedirectUrl`, `theme.showIncentivePoints`, or `theme.isDefault` remain in the repo (`grep` clean).

### Migration verification (R13)

- **R13.** The implementation SHALL run `pnpm prisma migrate dev` against a real Docker-backed Postgres before submission, not only static checks.

## Compliance Requirements

`fraim/config.json` lists **GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope)**.

#291 is a **schema rename / column move** with no PII change. The fields moved are organization-level configuration, not respondent or member data.

| Obligation | Source | Control on this refactor |
|---|---|---|
| Lawful basis (Art. 6) / Right to know / Right to delete | GDPR / CCPA | **No change.** No member or respondent PII is added, removed, or relocated. |
| Data minimization (Art. 5(1)(c)) | GDPR | **Improved.** The brand-theme row no longer carries `brandName` (which duplicated `Brand.name`). |
| Audit trail (CC7.2) | SOC2 (target M-12) | The forward migration is a single reviewable diff (R5). The pre-drop verify-and-preserve step (R4) ensures no admin-authored configuration is silently lost. |
| Logical access (CC6.1) | SOC2 | **No change.** Existing admin role gate on theme/survey routes is preserved. `brandId` continues to flow only from the verified JWT (project rule R6). |
| Cardholder data scope | PCI-DSS (minimal) | **Out of scope.** |

## Validation Plan

| Step | Method | Expected result |
|---|---|---|
| Migration applies on fresh Postgres | `docker compose up -d postgres && pnpm prisma migrate reset && pnpm prisma migrate dev` | Migration runs to head; the brand-theme table shows no pruned columns; `\d surveys` shows the three new columns; `\d brands` shows `defaultThemeId` with the FK constraint. |
| Migration on a DB with non-default theme rows preserves data | Integration test against a Docker-backed DB seeded with: a theme row whose `thankYouMessage` is custom, `showIncentivePoints` is FALSE, and `isDefault` is TRUE; a survey pointing at that theme | After migrate: the survey row carries the custom values; the brand row's `defaultThemeId` points at that theme. The dropped columns are gone. |
| Theme editor — no logo / brand-name / thank-you / set-default-checkbox controls | Browser: `/admin/settings/themes/new` and `/admin/settings/themes/:id/edit` | The 6 enumerated rows are absent. The remaining sections (Theme Name, Colors, Typography, Layout) keep their current position and styling. The "Set as Default" button on edit mode still works; it now writes `Brand.defaultThemeId`. |
| Theme list — Default badge backed by FK | Browser: `/admin/settings/themes` → click "Set as Default" on a row | The previously-default badge moves to the clicked row; `Brand.defaultThemeId` in the DB matches. |
| Survey API — thank-you fields persist | `curl -X PATCH /v1/surveys/:id -d '{"thankYouMessage":"X","thankYouRedirectUrl":"https://Y","showIncentivePoints":false}'` | 200 OK; the survey row in DB has the new values. |
| Public survey completion page — DOM unchanged | Playwright snapshot: respondent completes a survey whose new columns mirror the previous theme values | Completion-page DOM byte-matches the pre-refactor snapshot. |
| Cross-package grep clean | `git grep -nE "theme\\.(logoUrl\|brandName\|thankYouMessage\|thankYouRedirectUrl\|showIncentivePoints\|isDefault)"` (excluding migration data-preservation SQL) | Returns 0 lines. |
| Smoke + unit + integration suites | `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration` | All four pass. |

## Alternatives

| Alternative | Why discard? |
|---|---|
| Leave `SurveyTheme` as-is and add `Brand.defaultThemeId → SurveyTheme.id` in #277. | Locks the schema into a model both PR #290 reviewers agreed is structurally wrong. The lock-in is the explicit reason #291 was filed. |
| Move only `isDefault` (the FK problem) and leave the other 5 fields on `SurveyTheme`. | Leaves the model still wrong. A second refactor would land later when a non-survey consumer (member portal) tries to read the brand's theme and finds `thankYouRedirectUrl` on it. |
| Introduce theme inheritance now. | Adds complexity for zero current consumers. Defer until a concrete consumer asks. |
| Keep `isDefault` boolean, enforce uniqueness via partial unique index `WHERE isDefault = true`. | Solves multi-default but expresses "brand has one default" as a constraint instead of a relationship. The FK on `Brand` is the natural shape. |
| Move fields out of `SurveyTheme` *without* adding the corresponding columns to `Survey` (just drop them). | Violates AC#3 ("per-survey overrides reachable from `Survey` directly"). Loses any admin-customised thank-you messaging for existing surveys (the verify-and-preserve migration has nowhere to write to). |
| Ship the admin survey-builder UI for the 3 fields in #291 alongside the schema move. | This is the version of the spec the reviewer pushed back against in round 1 — scope balloon. The schema + API + renderer rebind in #291 is enough; the admin UX has its own owner under #241. |

## Competitive Analysis

#291 is an **internal data-model refactor**, not a customer-facing feature. There is no competitive surface to analyze. The competitive analysis for *survey theming* lives on the original feature spec [#36](./36-survey-theming.md). None of that competitive positioning changes here.

## Open Questions / Decisions for the reviewer

| # | Question | Options | Recommendation | Trade-off |
|---|---|---|---|---|
| **DR1** | Forward-only DROP vs. data-preserving migration. Issue body says "verify before drop." | a) Unconditional DROP — simpler. <br> b) Verify-and-preserve — `SELECT` non-default rows; if any, copy values onto `Survey` / `Brand.defaultThemeId` before drop; if none, behave as (a). | **(b) ← recommended** | (b) is one extra DO-block. (a) risks silently losing admin-customised `thankYouMessage` / `showIncentivePoints` / `isDefault`. R4 currently encodes (b). |
| **DR2** | Rename `SurveyTheme` → `BrandTheme` vs. introduce a new `BrandTheme` model. | a) **Rename** the existing `SurveyTheme` model to `BrandTheme`; the table renames in the same migration. <br> b) Introduce a new `BrandTheme` model and drop `SurveyTheme` entirely. | **(a) ← recommended** | (a) preserves row identities. (b) rebuilds nothing of value and forces extra data-copy code. #277's spec language already uses "BrandTheme" — that naming should land here. |
| **DR3** | Where Survey-level overrides land: directly on `Survey` columns vs. a thinner `SurveyOverride` row. | a) Three columns directly on `Survey`. <br> b) `SurveyOverride` 1:1 row joined via `Survey.surveyOverrideId`. | **(a) ← recommended** | The fields are simple per-survey scalars. (b) adds a join for every survey render with no concrete benefit. |

## References

- Schema: `packages/database/prisma/schema.prisma:692-730` (`SurveyTheme`), `:193-233` (`Brand`), `:599-636` (`Survey`).
- Existing migration: `packages/database/prisma/migrations/20260427200452_add_survey_distribution/migration.sql:60-88` (creates `survey_themes`).
- Drift-restoration migration: `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql:124-128` (adds `surveys.themeId` FK).
- Original SurveyTheme spec: `docs/feature-specs/36-survey-theming.md`.
- Blocking spec: `docs/feature-specs/277-organization-settings.md` (F4 Look & Feel).
- PR #290 review threads: [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842).
- Round-1 reviewer feedback: `docs/evidence/291-feature-specification-feedback.md`.
- Mocks: `docs/feature-specs/mocks/291-view.html`.
- Project rules: R6 (brandId from JWT), R10 (branch-issue link), R21 (one issue per branch). All satisfied.

## Design Standards Applied

- Source: `docs/architecture/architecture.md` (authoritative tech / pattern decisions).
- The mock reproduces the actual `ThemeForm.tsx` chrome (single-column flat-sections layout, indigo-600 button, gray-300 borders, `text-xs uppercase` section headers) so the diff is visibly a *prune* of the existing editor — no design tokens introduced, no layout reshape.
