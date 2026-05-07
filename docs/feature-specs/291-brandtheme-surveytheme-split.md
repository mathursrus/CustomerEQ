# Feature: Split brand-level theme from per-survey overrides

Issue: #291
Owner: Claude (claude-opus-4-7)
Status: draft (phase:spec-drafting · round 3 — corrected misread of round-2 reviewer comment)

> **Closes:** #291.
> **Blocks:** [#277](https://github.com/mathursrus/CustomerEQ/issues/277) (Organization Settings) — F4 (Look & Feel) explicitly defers the underlying theme model to this RFC.
> **Cross-refs:** [#36](https://github.com/mathursrus/CustomerEQ/issues/36) (origin spec for the current `SurveyTheme` model), [#290](https://github.com/mathursrus/CustomerEQ/pull/290) (review threads where the split was surfaced — [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842)).

---

## Customer

Two customers.

1. **Brand admins** who manage their organization's visual identity (color scheme, logo, brand name) — they expect that identity to live at the **brand** level so it is reusable beyond surveys (member portals, embedded widgets, emails). When they edit a "theme" today, the editor mixes brand identity (logo, brand name) with per-survey copy (thank-you message, redirect URL, incentive-points display) and a "default theme" toggle. That conflation is wrong on its face, and it is also a forward-compat problem: any surface that wants to reuse the brand's visual identity (member portal, email templates, future embed widgets) cannot point at `SurveyTheme` without inheriting per-survey concerns it does not need.

2. **CustomerEQ engineering** working under #277 (Organization Settings page). #277 must add `Brand.defaultThemeId` and surface a brand-default theme picker — but the FK target is the load-bearing question. Pointing the FK at `SurveyTheme.id` would lock the schema into a model both reviewers on #290 agreed is structurally wrong. #291 is the prerequisite that makes #277 mergeable without that lock-in.

## Customer's Desired Outcome

> "A brand has *one* visual identity (colors, typography, layout). Surveys reference it. Per-survey thank-you copy, redirect URL, and incentive-points toggle live on the survey, not on the brand's theme."

Concretely:

- The brand-level theme model exposes only colors, typography, layout — surfaces beyond surveys (member portal, embeds, emails) can consume it without dragging per-survey copy or redundant brand-name / logo-URL fields into the read.
- The survey row owns per-survey thank-you copy, redirect URL, and incentive-points display — the columns exist so values currently set on shared themes carry forward (demo seeds have customised them) and so a follow-on issue can light up the admin UI.
- The brand row owns "which theme is the default" via an FK — `Brand.defaultThemeId` — replacing the `SurveyTheme.isDefault` boolean (which permits the impossible state of multiple defaults per brand and depends on `updateMany`-then-`update` sequences to enforce uniqueness).
- #277's Look & Feel section can ship against a stable, brand-shaped theme model.

## Customer Problem being solved

`SurveyTheme` (`packages/database/prisma/schema.prisma:692-730`) carries 6 fields that do not belong on a per-survey-rendering theme:

| Field (schema.prisma line) | Belongs on | Why |
|---|---|---|
| `logoUrl` (699) | `Brand` | A brand has one logo. `Brand.logoUrl` already exists (line 199, shipped under #170 / #190). The duplicate on `SurveyTheme` is dead weight. |
| `brandName` (700) | `Brand` (already present as `Brand.name`) | A brand has one name. The renderer today has to decide which of `theme.brandName` or `survey.brand.name` wins — the field exists only because the original spec mistakenly let an admin override the display name per-theme. |
| `thankYouMessage` (719) | `Survey` | Per-survey copy. The original spec frames this as customisable per-survey — see #36's "Custom thank-you message" deliverable. |
| `thankYouRedirectUrl` (720) | `Survey` | Per-survey routing. #36's intent was to redirect respondents back to the brand's external site after completion — invented examples in earlier round-1 spec text were hypothetical and have been removed. |
| `showIncentivePoints` (721) | `Survey` | Per-survey toggle. Whether to render the points-earned tile depends on whether the survey awards points, not on the brand's visual identity. |
| `isDefault` (697) | `Brand.defaultThemeId` (FK) | A brand has *one* default. A boolean on every theme row admits a multi-default state and depends on application-level uniqueness enforcement (`updateMany` clear + `update` set in `apps/api/src/routes/themes.ts:31-36, 116-125`). The natural shape is an FK on `Brand`. |

This split is binding for #277 because PR #290's RFC was preparing to add `Brand.defaultThemeId → SurveyTheme.id`. Shipping that FK against a model both parties agree is wrong locks the schema into the wrong shape; #277 cannot ship the FK until the target model is right.

### Empirical state — which fields are populated and read today

Reviewer round-2 push: don't take the issue body's "fields move" at face value; verify whether anything actually reads them today, and if so, migrate-and-backfill rather than drop.

**Populated by demo seeds:**

| Demo | File | Populates | Reads (renderer) |
|---|---|---|---|
| Acme Coffee | `examples/acme-coffee-demo/seed-acme.mjs:137-146` | `brandName: 'Acme Coffee'` | yes |
| StarBrew | `scripts/seed-demo.ts:151-170` | `brandName: 'StarBrew Coffee'`, custom `thankYouMessage`, `showIncentivePoints: true` | yes |
| Diamond Demo | `scripts/seed-demo.mjs:76-95` | `brandName: 'CustomerEQ Demo'`, `isDefault: true`, custom `thankYouMessage`, `showIncentivePoints: true` | yes |

**Read by the renderer** (`apps/web/src/app/survey/[id]/page.tsx`):

- `theme.thankYouRedirectUrl` (lines 347, 446) — drives redirect-after-submit
- `theme.showIncentivePoints` (line 364) — gates the "you earned X points" tile
- `theme.thankYouMessage` (line 413) — completion-page heading copy
- `theme.logoUrl` (lines 475-477) — survey-header logo `<img>` block
- `theme.brandName` (lines 476, 479) — survey-header label, falls back to `survey.brand.name`

**Production surveys**: per reviewer, "all surveys today are test surveys — data preservation is not critical [for production]." This means the migration's data-rigor bar is "preserve demo experience," not "preserve real customer data."

The right shape is therefore: **migrate-and-backfill from `survey_themes` rows onto `Survey` / `Brand`**, so the three demos render identically post-migration without re-running the seeds.

## User Experience that will solve the problem

### Surface 1 — Theme editor (`/admin/settings/themes/new`, `/admin/settings/themes/:id`, `/admin/settings/themes/:id/edit`)

**The editor's existing layout is unchanged.** `apps/web/src/components/themes/ThemeForm.tsx` keeps its single-column flat-sections shape (Brand → Colors → Typography → Layout → Thank You → isDefault checkbox → action buttons + right preview pane). #291 only **drops rows** from that pane.

- **In the "Brand" section** — drop the `Logo URL` input row (`ThemeForm.tsx:411-420`) and the `Brand Name` input row (`:421-430`). Theme Name (`:402-410`) stays. The section header stays.
- **The "Thank You" section** — drop the entire section (`:491-523`): Message textarea, Redirect URL input, Show-incentive-points checkbox. The section header is removed because all its inputs are gone.
- **The "Set as default theme" checkbox section** — drop entirely (`:525-535`). The form-level `isDefault` control is gone. The existing edit-mode "Set as Default" *button* (`:548-556`) stays — its `onClick` still calls `POST /v1/themes/:id/default`, but the handler now writes `Brand.defaultThemeId` instead of toggling per-row booleans.
- **The "Default" badge in the editor heading** (`:386-390`) — stays visible. Its data source switches from `theme.isDefault` to derived (`brand.defaultThemeId === theme.id`).
- **In the right preview pane** — drop the brand-name / logo placeholder (`:170-181`) and the thank-you screen preview (`:255-264`). The survey-question preview stays.

No new sections, no new tabs, no field reordering.

### Surface 2 — Theme list (`/admin/settings/themes`)

No layout change. The "Default" badge (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx:97-102`) keeps its current shape — its data source switches from per-row `theme.isDefault` to derived `brand.defaultThemeId === theme.id`.

### Surface 3 — Public survey rendering (`apps/web/src/app/survey/[id]/page.tsx`)

No respondent-visible change for any survey whose new columns hold the values that were previously on its theme row (true for all three demos post-backfill). The renderer reads from new locations:

- `theme.logoUrl` → `survey.brand.logoUrl` (the public survey API response gains `brand.logoUrl` in #291)
- `theme.brandName` → `survey.brand.name` (already in the response)
- `theme.thankYouMessage` → `survey.thankYouMessage` (new column on Survey, populated via backfill)
- `theme.thankYouRedirectUrl` → `survey.thankYouRedirectUrl` (new column, backfill)
- `theme.showIncentivePoints` → `survey.showIncentivePoints` (new column, backfill)

The `SurveyTheme` TS interface at `apps/web/src/app/survey/[id]/page.tsx:51-67` drops the five fields. The `SurveyData` interface gains the three Survey-level fields and a `logoUrl?: string` on `brand`.

### Surface 4 — Organization Settings page (#277)

`Brand.defaultThemeId` becomes a real FK with a real `@relation`. The four-default-themes seed contract from #277's F4 lands on the model #291 produces. Implementation of the seed itself is owned by #277.

### Demos affected — backfilled, no visible regression

The migration's backfill step (R4) writes the three demos' customised values onto `Survey` / `Brand` rows so the post-migration demo experience is identical to today's:

| Demo | What the backfill does |
|---|---|
| Acme Coffee | `theme.brandName = 'Acme Coffee'` is dropped (already matches `brand.name`, no copy needed). No other fields populated. |
| StarBrew | `theme.thankYouMessage` (custom) → `surveys.thankYouMessage` for the NPS and CSAT surveys pointing at this theme. `theme.showIncentivePoints = true` → `surveys.showIncentivePoints` (already the default true; explicit copy is a no-op). |
| Diamond Demo | `theme.thankYouMessage` (custom) → `surveys.thankYouMessage` for the two surveys. `theme.isDefault = true` → `Brand.defaultThemeId` for the brand. |

Reseeding any demo from scratch post-migration also works — the seed scripts update in the same PR (R10) to write the three thank-you fields on `surveys` directly and to call `POST /v1/themes/:id/default` for the default toggle.

### UI mocks

High-fidelity HTML mock at [`./mocks/291-brandtheme-surveytheme-split.html`](./mocks/291-brandtheme-surveytheme-split.html). Single scene `#scene-theme-editor-after` shows the editor with the 6 fields removed, side-by-side with the current (before) state.

## Out of scope

- **Admin UI for the new survey-level fields.** R8 ensures the survey API accepts `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` on the body so admins can set them via the API today; the survey-builder admin form section that exposes these in the survey-edit page is **deferred to a follow-on issue** (likely under #241 — Survey Admin UX epic). The schema columns ship in #291 because the migration backfills them; their UI is the follow-on's concern.
- **Public-survey logo width / placement design**. The renderer rebinds `<img src={theme.logoUrl}>` → `<img src={survey.brand.logoUrl}>` to keep the demo experience identical. Any redesign of how prominently the logo renders is a separate concern.
- **Per-region / per-locale theme variants.** Defer until a real consumer asks.
- **Theme inheritance.** Defer until a sub-brand override is requested.
- **`packages/consent-text` decoupling.** That is #277's territory.
- **Four-default-themes seed.** Owned by #277 (F4 Look & Feel); #291 only provides a model that supports the seed.

## Acceptance criteria & Requirements

Requirements are SHALL-style with traceability tags (R1, R2, …).

### Schema (R1–R5)

- **R1.** The brand-level theme model SHALL NOT carry `logoUrl`, `brandName`, `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints`, or `isDefault` columns.
- **R2.** The brand-level theme model SHALL be renamed `SurveyTheme` → `BrandTheme` (and table `survey_themes` → `brand_themes`) — DR2 resolved.
- **R3.** `Survey` SHALL gain `thankYouMessage String @default("Thank you for your feedback!")`, `thankYouRedirectUrl String?`, `showIncentivePoints Boolean @default(true)` — same shape and defaults the fields had on `SurveyTheme`. (DR3 — recommend Survey columns over a SurveyOverride row; see Decisions for the reviewer.)
- **R4.** `Brand.defaultThemeId String?` SHALL gain a real Prisma `@relation` to `BrandTheme`. The drift comment at `schema.prisma:206-210` SHALL be removed when the relation is restored.
- **R5.** A forward-only Prisma migration SHALL execute the column drops + table rename + Survey column adds + `Brand.defaultThemeId` FK in a single diff. **Backfill before drop:** the migration SHALL `UPDATE` each `Survey` row whose `themeId` points at a `survey_themes` row with non-default `thankYouMessage` / `thankYouRedirectUrl` / `showIncentivePoints`, copying those values into the new Survey columns. The migration SHALL `UPDATE` `Brand.defaultThemeId` to the `survey_themes.id` of any row whose `isDefault = TRUE`, scoped per-brand. Only after the backfill statements run does the migration `DROP COLUMN` the six fields. (DR1 resolution: backfill IS critical — not for production data, but to preserve the three demos' configurations without requiring a reseed. Reviewer round-2 clarification: *"If data is showing that dropped fields from the themes are used in the surveys, then we need to migrate those over to a survey level entity and backfill."*)

### API (R6–R8)

- **R6.** `GET /v1/themes`, `POST /v1/themes`, `GET/PATCH/DELETE /v1/themes/:id`, `POST /v1/themes/:id/default` (`apps/api/src/routes/themes.ts`) SHALL accept and return only the colors / typography / layout / `name` fields plus `id`, `brandId`, `createdAt`, `updatedAt`. The existing `_count.surveys` already in the response is preserved (the admin theme list at `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` reads it for the per-row "Surveys" count column — `themes.ts:11, 53` already include this; no change). The `isDefault` returned by these endpoints SHALL be a derived value (`brand.defaultThemeId === theme.id`) — not a stored column.
- **R7.** `POST /v1/themes/:id/default` SHALL update `Brand.defaultThemeId = :id` in a single statement; the `updateMany`-clear-then-`update`-set sequence at `themes.ts:116-125` SHALL be removed.
- **R8.** Survey routes (`apps/api/src/routes/surveys.ts`) — `POST /v1/surveys` and `PATCH /v1/surveys/:id` — SHALL accept `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` on the body and persist them to the corresponding `Survey` columns. The Zod schemas (`packages/shared/src/zod/survey.schema.ts`) SHALL be split: the create/update theme schemas SHALL drop these three plus `logoUrl`, `brandName`, `isDefault`; the create/update survey schemas SHALL gain the three. **No admin-UI surface in this issue** — the survey-builder UI for these fields is the follow-on issue's concern.
- The public survey API response SHALL include `brand.logoUrl` so the renderer (R11) can rebind `<img>` from `theme.logoUrl` to `survey.brand.logoUrl` without losing logos in the three demos.

### UI (R9–R10)

- **R9.** The theme editor (`apps/web/src/components/themes/ThemeForm.tsx`) SHALL drop the input rows enumerated in *Surface 1* without any other layout change. No new sections, no new tabs, no reordering.
- **R10.** The theme list page (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx`) SHALL keep its current shape; the "Default" badge SHALL be backed by the derived `isDefault` (R6).

### Renderer (R11)

- **R11.** The public survey page (`apps/web/src/app/survey/[id]/page.tsx`) SHALL read `thankYouMessage`, `thankYouRedirectUrl`, `showIncentivePoints` from the survey row, and `logoUrl` / `brandName` from the survey's brand row. The TS interfaces SHALL be updated accordingly: `SurveyTheme` (`:51-67`) drops the five fields; `SurveyData` (`:69-78`) gains the three Survey-level fields and `brand.logoUrl`. The rendered DOM for the survey-completion page SHALL be byte-for-byte identical to pre-refactor for any survey whose new columns hold the values that were previously on its theme row (asserted on the three demos via Playwright snapshot).

### Tests & seeds (R12)

- **R12.** Unit tests (`packages/shared/src/zod/survey.schema.test.ts`), E2E tests (`apps/web/test/e2e/themes-crud-pattern.spec.ts`), and seed scripts (`packages/config/src/test-utils/db/seed.ts`, `examples/acme-coffee-demo/seed-acme.mjs`, `scripts/seed-demo.mjs`, `scripts/seed-demo.ts`, `scripts/seed-demo-rich.mjs`) SHALL be updated in the same PR. Seed scripts SHALL move the three thank-you fields onto the survey creation calls, drop `brandName` / `logoUrl` from theme creation, and replace `isDefault: true` with a follow-up `POST /v1/themes/:id/default` call (or direct `Brand.defaultThemeId` write where the seed uses Prisma directly). After the PR lands, `git grep -nE "theme\\.(logoUrl|brandName|thankYouMessage|thankYouRedirectUrl|showIncentivePoints|isDefault)"` returns 0 lines (excluding the migration backfill SQL).

### Migration verification (R13)

- **R13.** The implementation SHALL run `pnpm prisma migrate dev` against a real Docker-backed Postgres before submission, not only static checks. The integration test SHALL seed Acme/StarBrew/Diamond, run the migration, and assert the three demos' surveys have the expected `thankYouMessage` / `showIncentivePoints` values and that the Diamond brand's `defaultThemeId` points at the right theme.

## Compliance Requirements

`fraim/config.json` lists **GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope)**.

#291 is a **schema rename / column move with backfill** and no PII change. The fields moved are organization-level configuration, not respondent or member data.

| Obligation | Source | Control on this refactor |
|---|---|---|
| Lawful basis (Art. 6) / Right to know / Right to delete | GDPR / CCPA | **No change.** No member or respondent PII is added, removed, or relocated. |
| Data minimization (Art. 5(1)(c)) | GDPR | **Improved.** The brand-theme row no longer carries `brandName` (which duplicated `Brand.name`). |
| Audit trail (CC7.2) | SOC2 (target M-12) | The forward migration is a single reviewable diff (R5). The backfill SQL is the audit record for the data move; no `AuditEvent` rows are emitted (this is a one-time schema change, not a runtime mutation). |
| Logical access (CC6.1) | SOC2 | **No change.** Existing admin role gate on theme/survey routes is preserved. `brandId` continues to flow only from the verified JWT (project rule R6). |
| Cardholder data scope | PCI-DSS (minimal) | **Out of scope.** |

## Validation Plan

| Step | Method | Expected result |
|---|---|---|
| Migration applies on fresh Postgres | `docker compose up -d postgres && pnpm prisma migrate reset && pnpm prisma migrate dev` | Migration runs to head; `\d brand_themes` shows no pruned columns; `\d surveys` shows the three new columns; `\d brands` shows `defaultThemeId` with FK to `brand_themes(id)`. |
| Migration on a DB with the three demos preserves customised values | Integration test against a Docker-backed DB seeded with Acme + StarBrew + Diamond before migration | Post-migrate: StarBrew and Diamond surveys carry their customised `thankYouMessage`. Diamond brand's `defaultThemeId` points at its theme. |
| Theme editor — no logo / brand-name / thank-you / set-default-checkbox controls | Browser: `/admin/settings/themes/new` and `/admin/settings/themes/:id/edit` | The 6 enumerated rows are absent. The remaining sections (Theme Name, Colors, Typography, Layout) keep their current position and styling. The "Set as Default" button on edit mode still works; it now writes `Brand.defaultThemeId`. |
| Theme list — Default badge backed by FK | Browser: `/admin/settings/themes` → click "Set as Default" on a row | The previously-default badge moves to the clicked row; `Brand.defaultThemeId` in the DB matches. |
| Survey API — thank-you fields persist | `curl -X PATCH /v1/surveys/:id -d '{"thankYouMessage":"X","thankYouRedirectUrl":"https://Y","showIncentivePoints":false}'` | 200 OK; survey row has the new values. |
| Public survey completion page — DOM identical for the three demos | Playwright snapshot: respondent completes Acme NPS, StarBrew NPS, and Diamond NPS surveys post-migration | Completion-page DOM byte-matches the pre-refactor snapshot for each demo. |
| Cross-package grep clean | `git grep -nE "theme\\.(logoUrl\|brandName\|thankYouMessage\|thankYouRedirectUrl\|showIncentivePoints\|isDefault)"` (excluding migration backfill SQL) | Returns 0 lines. |
| Smoke + unit + integration suites | `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration` | All four pass. |

## Alternatives

| Alternative | Why discard? |
|---|---|
| Leave `SurveyTheme` as-is and add `Brand.defaultThemeId → SurveyTheme.id` in #277. | Locks the schema into a model both PR #290 reviewers agreed is structurally wrong. |
| Move only `isDefault` (the FK problem) and leave the other 5 fields on `SurveyTheme`. | Leaves the model still wrong. Doing the full split now is cheaper than two refactors. |
| Introduce theme inheritance now. | Adds complexity for zero current consumers. Defer. |
| Keep `isDefault` boolean, enforce uniqueness via partial unique index. | Solves multi-default but expresses "brand has one default" as a constraint instead of a relationship. The FK on `Brand` is the natural shape. |
| Drop the 6 fields without adding Survey columns or backfilling (round-2 spec position). | Reviewer round-2 clarification: *"If data is showing that dropped fields from the themes are used in the surveys, then we need to migrate those over to a survey level entity and backfill."* The three demos populate these fields; dropping without migration would silently degrade the demo experience and force a reseed. |
| Ship the admin survey-builder UI for the 3 fields in #291 alongside the schema move. | Round-1 reviewer push-back: scope balloon. The admin UX has its own owner under #241 (Survey Admin UX) and ships separately. |
| Verify-and-preserve migration with conditional logic ("only backfill if non-default values exist"). | The simpler shape — backfill always, no conditional — is the same number of SQL statements and works cleanly whether the values are default or custom. The conditional is needless. |

## Competitive Analysis

#291 is an **internal data-model refactor**, not a customer-facing feature. There is no competitive surface to analyze. The competitive analysis for *survey theming* lives on the original feature spec [#36](./36-survey-theming.md). None of that competitive positioning changes here.

## Open Questions / Decisions for the reviewer

| # | Question | Resolution / Recommendation |
|---|---|---|
| **DR1** | Forward-only DROP vs. data-preserving migration. | **Backfill before drop** — corrected from round-2 misread. The three demo seeds populate the dropped fields; the migration SHALL `UPDATE surveys` and `UPDATE brands` from the joined `survey_themes` rows before dropping the columns, so demos render identically post-migration without requiring a reseed. R5 encodes this. |
| **DR2** | Rename `SurveyTheme` → `BrandTheme` vs. introduce a new `BrandTheme` model. | **(a) — rename in place.** Reviewer agreed (PR #295 thread). R2 encodes the rename. |
| **DR3** | Where Survey-level overrides land: directly on `Survey` columns, a thinner `SurveyOverride` 1:1 row, or as keys inside the existing `Survey.settings` Json column. | **(a) Survey columns ← recommended.** *Trade-off:* (a) typed columns — easiest for the migration backfill (`UPDATE surveys SET thankYouMessage = ... FROM survey_themes ...`), easiest for the future admin UI's Zod validation, mirrors the existing `Survey.incentivePoints Int?` precedent. (b) `SurveyOverride` row — adds a join for every survey render with no concrete benefit; the model would be empty most of the time given the defaults. (c) JSON in `Survey.settings` — lighter on schema but harder to query, validate, and surface in the admin UI; mixes typed and untyped configuration on the same row. R3 currently encodes (a). |

## References

- Schema: `packages/database/prisma/schema.prisma:692-730` (`SurveyTheme`), `:193-233` (`Brand`), `:599-636` (`Survey`).
- Existing migration: `packages/database/prisma/migrations/20260427200452_add_survey_distribution/migration.sql:60-88` (creates `survey_themes`).
- Drift-restoration migration: `packages/database/prisma/migrations/20260430000000_patch_survey_distribution_gap/migration.sql:124-128` (adds `surveys.themeId` FK).
- Original SurveyTheme spec: `docs/feature-specs/36-survey-theming.md`.
- Demo seeds: `examples/acme-coffee-demo/seed-acme.mjs:137-185`, `scripts/seed-demo.ts:151-213`, `scripts/seed-demo.mjs:76-121`.
- Renderer: `apps/web/src/app/survey/[id]/page.tsx:51-67, 347, 364, 413, 446, 475-479`.
- Blocking spec: `docs/feature-specs/277-organization-settings.md` (F4 Look & Feel).
- PR #290 review threads: [L240](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197741219), [L248](https://github.com/mathursrus/CustomerEQ/pull/290#discussion_r3197747842).
- Round-1 + Round-2 + Round-3 reviewer feedback: `docs/evidence/291-feature-specification-feedback.md`.
- Mocks: `docs/feature-specs/mocks/291-brandtheme-surveytheme-split.html`.
- Project rules: R6 (brandId from JWT), R10 (branch-issue link), R21 (one issue per branch). All satisfied.

## Design Standards Applied

- Source: `docs/architecture/architecture.md` (authoritative tech / pattern decisions).
- The mock reproduces the actual `ThemeForm.tsx` chrome (single-column flat-sections layout, indigo-600 button, gray-300 borders, `text-xs uppercase` section headers) so the diff is visibly a *prune* of the existing editor — no design tokens introduced, no layout reshape.
