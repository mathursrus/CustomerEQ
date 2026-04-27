# Feature: Standardize list → view → edit navigation pattern across CRUD entities — Technical Design

Issue: #157
Owner: manohar.madhira@outlook.com

---

## Customer

Two audiences are affected:

- **Brand admin operators** who navigate the admin portal across multiple entity types (Programs, Surveys, Alert Rules, Campaigns, Themes). Today they hit a different click-to-detail behavior depending on which list they opened, which breaks muscle memory and produces accidental edits.
- **AI coding agents** working in this repo who infer conventions from existing code. Today they see two competing CRUD patterns (Programs/Surveys vs Alert Rules/Campaigns/Themes) and replicate whichever they pattern-matched first when adding a new entity.

## Customer Problem Being Solved

The Programs page establishes a 4-route CRUD pattern: `list → /[id]` (view-only with `ViewOnlyBanner`) → `/[id]/edit` (editable). Three route-based entities deviate:

| Entity        | Current behavior                                                                  | Deviation                                                |
| :------------ | :-------------------------------------------------------------------------------- | :------------------------------------------------------- |
| Alert Rules   | List click → `/admin/alerts/rules/{id}/edit` (skips view)                         | No `/[id]` view-only route exists                         |
| Campaigns     | Name not clickable; `CampaignActions` "Edit" → `/admin/campaigns/{id}/edit`        | No `/[id]` view-only route; name not navigable           |
| Themes        | List click → `/admin/settings/themes/{id}` (combined view+edit on same page)      | No mode separation; no `/[id]/edit` route                |

A second-order problem emerges from this remediation. Two of the three deviating entities (Alert Rules, Themes) have **fully duplicated form code** — `new/page.tsx` and the edit page each contain ~450–500 lines of the same form markup, validation, and submit logic. Adding a third "view" copy by hand would compound the drift and violate project rule #15 ("Fix at the Right Abstraction Level"). Campaigns is already correctly factored via `@/components/campaigns/CampaignForm` and only needs `mode='view'` extended onto it.

## User Experience That Will Solve the Problem

For each affected entity, the operator workflow becomes:

1. Operator navigates to `/admin/{entity}` list page.
2. Clicking the entity **name** navigates to `/admin/{entity}/{id}` — a read-only page with a yellow `ViewOnlyBanner` at top showing an "Edit {Entity}" button.
3. The list row also exposes a separate **"Edit"** action link directly to `/admin/{entity}/{id}/edit` for fast editing.
4. On the view page, fields are rendered using the same form component as create/edit but disabled; clicking the banner's "Edit {Entity}" button navigates to `/admin/{entity}/{id}/edit`.
5. On the edit page, fields are interactive; submit calls `PATCH /v1/{entity}/{id}`.

For AI agents, the developer workflow becomes: any new CRUD entity ships 4 thin route files that all delegate to a single `<EntityForm mode={…} />` component. The pattern is documented in `architecture.md` as the canonical admin CRUD layout.

---

## Technical Details

### Standard CRUD Route Layout (canonical)

| Route                          | Purpose      | Component                              |
| :----------------------------- | :----------- | :------------------------------------- |
| `/admin/{entity}`              | List         | List page (existing per entity)        |
| `/admin/{entity}/new`          | Create       | `<{Entity}Form mode="create" />`       |
| `/admin/{entity}/[id]`         | View-only    | `<{Entity}Form mode="view" entity={…}/>` wrapped by `ViewOnlyBanner` |
| `/admin/{entity}/[id]/edit`    | Edit         | `<{Entity}Form mode="edit" entity={…}/>` |

Form components must accept `mode: 'create' | 'edit' | 'view'` and derive `const isViewOnly = mode === 'view'`. Every interactive control (`input`, `textarea`, `select`, `button[type="button"]` for toggles, "Add row" buttons) takes `disabled={isViewOnly}`. Submit/save actions are hidden entirely when `isViewOnly`. This is the same pattern already used by `ProgramWizard` (`apps/web/src/app/(admin)/admin/programs/_components/program-wizard.tsx:189`).

### UI Changes

#### Component 1 — Generalize `ViewOnlyBanner`

**File:** `apps/web/src/components/ui/view-only-banner.tsx`

Today the banner hardcodes `"Edit Program"` and `"You are viewing this program in read-only mode"`. Generalize:

```typescript
interface ViewOnlyBannerProps {
  entityLabel: string         // e.g. "Alert Rule", "Campaign", "Theme"
  onEdit: () => void
}
```

Rendered text becomes `You are viewing this {entityLabel.toLowerCase()} in read-only mode. Changes are not saved.` and the button label becomes `✏️ Edit {entityLabel}`. Update existing call site in `program-wizard.tsx` to pass `entityLabel="Program"`.

This is a non-breaking widening — the only existing consumer adds one prop.

#### Component 2 — Extract `AlertRuleForm`

**New file:** `apps/web/src/components/alert-rules/AlertRuleForm.tsx`

Extract the form body (currently duplicated across `alerts/rules/new/page.tsx:33` and `alerts/rules/[id]/edit/page.tsx:39`). Single component with the following contract:

```typescript
export interface AlertRuleFormInitialData {
  name: string
  status: 'ACTIVE' | 'PAUSED'
  surveyTypes: string[]
  scoreMin?: number | null
  scoreMax?: number | null
  sentimentThreshold?: number | null
  topicFilters: string[]
  slackWebhookUrl?: string | null     // may be masked '****…' on edit/view
  slackChannelName?: string | null
  emailRecipients: string[]
  teamsWebhookUrl?: string | null     // may be masked
  defaultAssignee?: string | null
  assignmentRules: Array<{ topic: string; assignee: string }>
  slaHours: number
}

interface AlertRuleFormProps {
  mode: 'create' | 'edit' | 'view'
  ruleId?: string                                   // required when mode !== 'create'
  initialData?: AlertRuleFormInitialData
}
```

Internal behavior preserved from the existing edit page:
- The webhook-mask handling (`isMasked()`, `slackAlreadySet`, `teamsAlreadySet`) — must continue to work in `'edit'` mode so leaving a masked field blank preserves the existing value rather than nulling it.
- POST vs PATCH branching keyed on `mode === 'create'`.
- View mode: every input/select/textarea/toggle/"Add Rule"/"Remove" button takes `disabled={isViewOnly}`; the trailing Save/Cancel block is omitted entirely.

#### Component 3 — Extract `ThemeForm`

**New file:** `apps/web/src/components/themes/ThemeForm.tsx`

Extract the form body (currently duplicated across `settings/themes/new/page.tsx:287` and `settings/themes/[id]/page.tsx:264`). The `SurveyPreview`, `ColorInput`, and `ChipGroup` helper components should also move into this file (they are duplicated today). Contract:

```typescript
export interface ThemeFormInitialData {
  name: string
  isDefault: boolean
  logoUrl: string
  brandName: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
  fontFamily: string
  headingSize: 'sm' | 'md' | 'lg'
  bodySize: 'sm' | 'md' | 'lg'
  cardStyle: 'flat' | 'shadow' | 'border'
  borderRadius: 'none' | 'sm' | 'md' | 'lg'
  maxWidth: 'sm' | 'md' | 'lg'
  thankYouMessage: string
  thankYouRedirectUrl: string
  showIncentivePoints: boolean
}

interface ThemeFormProps {
  mode: 'create' | 'edit' | 'view'
  themeId?: string                          // required when mode !== 'create'
  initialData?: ThemeFormInitialData
}
```

`SurveyPreview` always renders interactively (it's a visual preview, not user input) — `isViewOnly` does not affect it. The "Save Changes", "Set as Default", and "Delete Theme" buttons in the left panel are hidden when `isViewOnly`.

#### Component 4 — Extend `CampaignForm` with view mode

**File:** `apps/web/src/components/campaigns/CampaignForm.tsx`

Already shared. Currently `mode?: 'create' | 'edit'` (line 438). Widen to `'create' | 'edit' | 'view'` and add `const isViewOnly = mode === 'view'`. Apply `disabled={isViewOnly || lockActionType}` to the existing controls and hide the submit row when `isViewOnly`.

#### Route Changes

| File                                                                          | Change                                                                                                              |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/(admin)/admin/alerts/rules/page.tsx`                        | Make name a `Link` to `/admin/alerts/rules/{id}`. Add separate "Edit" action link to `/admin/alerts/rules/{id}/edit` next to existing actions. |
| `apps/web/src/app/(admin)/admin/alerts/rules/new/page.tsx`                    | Replace 460-line form body with `<AlertRuleForm mode="create" />`.                                                   |
| **NEW** `apps/web/src/app/(admin)/admin/alerts/rules/[id]/page.tsx`           | RSC fetches rule via `GET /v1/alert-rules/{id}`, renders `<ViewOnlyBanner entityLabel="Alert Rule" onEdit={…} />` + `<AlertRuleForm mode="view" ruleId={id} initialData={…} />`. Mirror Programs `[id]/page.tsx` shape. |
| `apps/web/src/app/(admin)/admin/alerts/rules/[id]/edit/page.tsx`              | Replace 549-line form body with `<AlertRuleForm mode="edit" ruleId={id} initialData={…} />`.                          |
| `apps/web/src/app/(admin)/admin/campaigns/page.tsx`                           | Wrap campaign name cell in `<Link href={…/campaigns/{id}}>`.                                                        |
| `apps/web/src/app/(admin)/admin/campaigns/CampaignActions.tsx`                | Promote a "View" link as primary; demote "Edit" to a secondary text link.                                            |
| **NEW** `apps/web/src/app/(admin)/admin/campaigns/[id]/page.tsx`              | RSC fetches campaign via `GET /v1/campaigns/{id}`, renders `<ViewOnlyBanner entityLabel="Campaign" onEdit={…} />` + `<CampaignForm mode="view" initialData={…} />`. |
| `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx`                | Refactor to view-only: fetch via `GET /v1/themes/{id}`, render `<ViewOnlyBanner entityLabel="Theme" onEdit={…} />` + `<ThemeForm mode="view" themeId={id} initialData={…} />`. |
| **NEW** `apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx`   | Fetch and render `<ThemeForm mode="edit" themeId={id} initialData={…} />`.                                            |
| `apps/web/src/app/(admin)/admin/settings/themes/new/page.tsx`                 | Replace 506-line form body with `<ThemeForm mode="create" />`.                                                       |

### API Surface Changes

**None.** All required endpoints already exist:

- `GET /v1/alert-rules/{id}` — confirmed in use by current edit page (`alerts/rules/[id]/edit/page.tsx:78`)
- `GET /v1/campaigns/{id}` — confirmed in use (`campaigns/[id]/edit/page.tsx:38`)
- `GET /v1/themes/{id}` — confirmed in use (`settings/themes/[id]/page.tsx:281`)

The view-only pages reuse the same GET endpoints the edit pages already call. No backend work.

### Data Model / Schema Changes

**None.** Frontend-only refactor.

### Architecture Updates (most important section)

This RFC adds one new architectural standard. Two changes capture it:

#### Update 1 — Add a section to `docs/architecture/architecture.md` section 3.1 (Presentation Layer)

Insert under "Admin home entry point" / "Context-aware navigation" the following paragraph:

> **Standard CRUD admin pattern**: All admin route-based CRUD entities follow the four-route layout `/admin/{entity}` (list), `/admin/{entity}/new` (create), `/admin/{entity}/[id]` (view-only), `/admin/{entity}/[id]/edit` (edit). The view route wraps the form in `<ViewOnlyBanner entityLabel="…" />` (`apps/web/src/components/ui/view-only-banner.tsx`). Each entity has a single `{Entity}Form` component accepting `mode: 'create' | 'edit' | 'view'` that derives `isViewOnly = mode === 'view'` and disables interactive controls. The list page exposes a clickable name `Link` to the view route plus a separate row-action "Edit" link to the edit route. Reference implementation: `apps/web/src/app/(admin)/admin/programs/`. Established by Issue #157.

#### Update 2 — Create the ADR directory and the first ADR

`docs/architecture/adr/` does not yet exist (verified). Create it with the first ADR:

**`docs/architecture/adr/0001-admin-crud-route-pattern.md`** — captures the decision, the alternatives considered (single-page combined view+edit; modal-based view), the consequences (every CRUD entity now needs 4 route files instead of 2-3), and links to Issue #157 as the establishing context. Project rule #4 says "If a significant new decision is made (one-way door), add an ADR" — this qualifies because it dictates URL contracts that bookmarks/external tools may depend on.

These two updates are deliberately small. The pattern is already practiced by Programs; this RFC formalizes it as the standard so future entities don't drift.

### Failure Modes & Timeouts

- **Stale view data**: View pages fetch with `cache: 'no-store'` (matching the Programs reference). Operator clicking "Edit" on the banner re-fetches on the edit page mount, so any drift between view and edit load is at most one round-trip.
- **404 on view route**: All three new view pages call `notFound()` if the GET returns non-OK, mirroring `programs/[id]/page.tsx:28`.
- **Webhook-mask preservation in `AlertRuleForm`**: This is the trickiest extracted behavior. View mode displays the masked value as a plain disabled input (no special handling). Edit mode preserves the existing `slackAlreadySet`/`teamsAlreadySet` logic so leaving a masked field empty omits it from the PATCH payload. Validation by integration test below.
- **Theme detail URL contract change**: Today `/admin/settings/themes/{id}` is editable (auto-saves, can delete, can set default). After this change it becomes view-only and the destructive actions (Delete, Set Default) move to the edit route. This is a one-way door for any external bookmarks/links — the URL still resolves but the behavior changes. Acceptable because this is an internal admin surface with no external consumers.

### Telemetry & Analytics

Not applicable. No new analytics events, no metric instrumentation needed for a navigation refactor.

---

## Confidence Level

**95.** The pattern is fully proven by Programs (the reference implementation has been in production since Issue #2). All three transformations (extract shared form → add view route → wire navigation) are mechanical translations of the Programs structure. The only non-mechanical detail is preserving the webhook-mask handling inside the extracted `AlertRuleForm` — covered by the validation plan below. The two ADR/architecture-doc updates are documentation, not code, so they carry no implementation risk.

## Validation Plan

| User Scenario                                                                  | Expected Outcome                                                                                                                | Validation Method                                                       |
| :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| Operator clicks an alert rule name in the list                                 | Navigates to `/admin/alerts/rules/{id}`, page renders read-only with yellow `ViewOnlyBanner` and disabled fields                | E2E (Playwright) — click → assert URL → assert banner visible → assert input disabled |
| Operator clicks "Edit Alert Rule" in the banner                                | Navigates to `/admin/alerts/rules/{id}/edit`, fields become interactive                                                          | E2E — click banner button → assert URL → assert input enabled            |
| Operator clicks the row's "Edit" action on the alert rules list                | Navigates directly to `/admin/alerts/rules/{id}/edit` (skipping view)                                                            | E2E — click row Edit → assert URL                                       |
| Operator edits an alert rule whose Slack webhook is masked, leaves field blank, saves | PATCH payload omits `slackWebhookUrl` (existing value preserved); rule still has the original webhook on subsequent GET    | Integration (Vitest + supertest against real API + DB)                  |
| Operator edits an alert rule, types a new Slack URL                            | PATCH payload includes the new URL; subsequent GET returns the new masked value                                                  | Integration                                                             |
| Operator views a campaign by clicking its name                                 | Navigates to `/admin/campaigns/{id}`, fields disabled, `CampaignActions` Edit/Activate/Pause still work from the list           | E2E                                                                     |
| Operator views a theme; clicks "Edit Theme" in banner; modifies a color; saves | Navigates `view → edit`, color persists, list reflects new color swatch                                                          | E2E                                                                     |
| Operator opens a stale bookmark to `/admin/settings/themes/{id}` (was editable) | Page now renders read-only with `ViewOnlyBanner`; clicking the banner reaches the edit page                                       | E2E                                                                     |
| Form component receives `mode='view'`                                          | Every `<input>`, `<textarea>`, `<select>`, toggle button, and "Add row" / "Remove" button has `disabled` attribute true; no Save button rendered | Unit (Vitest + React Testing Library) on each of the three new form components |
| AlertRuleForm receives `mode='create'` and submits                             | Calls `POST /v1/alert-rules` with the validated payload                                                                          | Unit (mock fetch)                                                       |
| AlertRuleForm receives `mode='edit'` with masked webhooks and submits with field blank | PATCH payload omits the masked webhook keys                                                                              | Unit (mock fetch, assert payload)                                       |

## Test Matrix

- **Unit (Vitest + RTL):**
  - **NEW** `apps/web/src/components/alert-rules/AlertRuleForm.test.tsx` — mode disabling, webhook-mask preservation, POST vs PATCH branching, validation rules.
  - **NEW** `apps/web/src/components/themes/ThemeForm.test.tsx` — mode disabling, default-on-create state, save/delete button visibility per mode.
  - **MODIFIED** `apps/web/src/components/campaigns/CampaignForm.test.tsx` (if exists; otherwise add) — add cases for `mode='view'` field disabling and submit-button hiding.
  - **MODIFIED** `apps/web/src/components/ui/view-only-banner.test.tsx` (add if missing) — verify `entityLabel` prop renders in both the message and the button.

- **Integration (Vitest + supertest, real DB):**
  - **MODIFIED** `apps/api/test/routes/alert-rules.test.ts` — add a case asserting a PATCH that omits `slackWebhookUrl` does not null the existing column value (this protects the masked-webhook behavior end-to-end, not just at the form layer).
  - No other API integration changes — endpoints unchanged.

- **E2E (Playwright):**
  - **NEW** `apps/web/e2e/admin-crud-navigation.spec.ts` — one spec covering the navigation pattern across all three entities (list → name click → view → banner-click → edit → list-row-edit → edit). One spec is sufficient per project guidance ("E2E (1 at most…)") because the pattern is identical across entities.

## Risks & Mitigations

| Risk                                                                                                            | Likelihood | Impact | Mitigation                                                                                                                                                                                       |
| :-------------------------------------------------------------------------------------------------------------- | :--------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook-mask handling regresses during AlertRule form extraction — masked URL gets sent back as `'****abc12345'` and the API rejects (or worse, accepts and corrupts) the column | Medium     | High   | Integration test (above) asserts both the omit-when-blank and replace-when-typed paths against the real API. Added before the extraction PR is merged.                                          |
| Theme `[id]` URL contract change breaks an external bookmark or doc link                                         | Low        | Low    | Internal admin surface only; no public-facing consumers. View-only behavior at the same URL is a graceful change (operator still sees the theme, just clicks "Edit" to mutate).                  |
| Three large form extractions in one PR balloon review surface and risk regression on three entities at once     | Medium     | Medium | Split into one PR per entity (alert-rules, campaigns, themes) plus a small leading PR for the `ViewOnlyBanner` widening. Each PR includes its own validation. The architecture/ADR docs land with the last PR. |
| `ProgramWizard` call site for `ViewOnlyBanner` regresses when the banner gets a new prop                         | Low        | Low    | The widening adds a required prop, so TypeScript will error at the existing call site if `entityLabel` is missing. Caught by `pnpm typecheck` before merge (gated by rule #11).                  |
| Inline-editing entities (KB Articles, Support Rules, Integrations) are explicitly out of scope but reviewers may push to include them | Low | Low | Issue #157 acceptance criteria already scope to the three route-based entities; out-of-scope confirmation is captured in the broken-windows report. New issues for inline-editing entities can be filed separately if their pattern needs standardizing. |

## Spike Findings

Not applicable. The pattern is fully validated by the existing Programs reference implementation. No technology, integration, or external system uncertainty.

## Observability (logs, metrics, alerts)

No new observability. The new view-only pages call existing GET endpoints which are already instrumented at the API layer (Pino structured logs per the architecture doc section 3.2). No new background jobs, no new queues, no new failure surfaces.

---

## Architecture Analysis

Comparison of the RFC's design against `docs/architecture/architecture.md` (frontend section 3.1 in particular). Gaps below are flagged for reviewer decision; per FRAIM, the architecture document is updated in the address-feedback phase, not now.

### Patterns Correctly Followed

- **Next.js App Router admin portal layout** (architecture.md §3.1). All new routes live under `apps/web/src/app/(admin)/admin/{entity}/[id]` and `/[id]/edit`, matching the established admin grouping.
- **Server-side data fetch with Clerk token forwarding** (architecture.md §3.1: "Server components fetch with Clerk token"). The new view RSC pages (`alerts/rules/[id]/page.tsx`, `campaigns/[id]/page.tsx`) follow the exact `auth()` → `getToken()` → `fetch(..., { cache: 'no-store', headers: token ? { Authorization: ... } : {} })` shape already used by `programs/[id]/page.tsx`.
- **Multi-tenant `brandId` scoping** (architecture.md §4.2 + project rule #6). No new endpoints; all reads reuse `GET /v1/alert-rules/:id`, `/v1/campaigns/:id`, `/v1/themes/:id` which already enforce `brandId` from the verified JWT. The forms never accept or send `brandId` in any payload.
- **Tailwind CSS v4 + shadcn-style copy-into-repo components** (architecture.md §2). `ViewOnlyBanner` is already a shadcn-style local component; the widening preserves the convention. New form components use the same utility-class vocabulary as the existing duplicates.
- **TypeScript strict mode at component boundaries** (architecture.md §2 + project rule #11). Each new `{Entity}FormInitialData` interface mirrors the API GET response shape; the `mode` prop is a literal union; `pnpm typecheck` will catch the `ViewOnlyBanner` widening at the existing `program-wizard.tsx` call site.
- **Test coverage matched to feature priority** (project rule #9). Issue #157 is broken-windows/UX (≈P2 by the project rubric — unit tests required). The plan exceeds the floor with unit + integration + 1 E2E because the change touches navigation flows that benefit from end-to-end validation, while staying inside the "1 at most" E2E ceiling per the TECHSPEC template.
- **Fix at the right abstraction level** (project rule #15). The duplicated forms in Alert Rules (~450 LOC × 2) and Themes (~500 LOC × 2) qualify exactly as "repeated logic across pages — extract to a shared utility or hook." The RFC extracts to shared form components rather than copy-pasting view-mode markup into a third file.

### Patterns Missing from Architecture

These are the gaps the RFC's "Architecture Updates" section already proposes filling. Listing them explicitly so the reviewer can confirm the documentation surface in the PR:

| Pattern | Why it's needed | Suggested resolution |
| :--- | :--- | :--- |
| **Standard CRUD admin route layout** (`/admin/{entity}` + `/new` + `/[id]` + `/[id]/edit`) | Three of five route-based admin entities currently deviate. Without documenting the standard, future entities will continue to drift and AI agents will replicate whichever pattern they pattern-matched first. | Add the paragraph proposed in the RFC's "Architecture Updates → Update 1" to `architecture.md` §3.1. |
| **Form-mode prop convention** (`mode: 'create' \| 'edit' \| 'view'` + `isViewOnly` derivation) | The Programs reference uses it; this RFC propagates it; no architecture doc currently records it as the standard. | Same paragraph as above — covers both the route layout and the form-mode prop together. |
| **`ViewOnlyBanner` as the standard admin read-mode chrome** | Currently a one-off component used only by Programs. Becoming a cross-entity standard. | Reference it from §3.1's new paragraph and from the ADR. |
| **ADR directory existence** | Project rule #4 mandates ADRs for one-way doors; the RFC's URL contract change for Themes (`/themes/{id}` going from editable to view-only) is one such door. The directory `docs/architecture/adr/` does not yet exist (verified during this phase). | Create `docs/architecture/adr/` and add ADR `0001-admin-crud-route-pattern.md` capturing decision, alternatives (single combined view+edit; modal-based view), and consequences. |
| **Shared test utils convention for new form factories** (project rule #8) | Plan adds `alertRuleFactory()` / `themeFactory()` style fixtures for the new unit tests. Rule #8 mandates these live in `packages/config/src/test-utils/`, not inline in the test files. The RFC implies but does not state this. | Resolve in implementation: any new factory used by `AlertRuleForm.test.tsx` / `ThemeForm.test.tsx` is added to `packages/config/src/test-utils/` first, then imported via `@customerEQ/config/test-utils`. No architecture-doc change required (rule already in `project_rules.md`). |

### Patterns Incorrectly Followed

None identified. The RFC does not violate any pattern documented in `architecture.md` or `project_rules.md`. The most relevant negative checks:

- **Event-driven for loyalty actions** (project rule #5): N/A — this is a UI navigation refactor with no loyalty state changes.
- **Transactions for earn/burn ledger integrity** (project rule #7): N/A — no ledger writes.
- **GDPR/CCPA PII handling** (project rule #13): N/A — alert rules, campaigns, and themes are configuration entities, not PII stores. Webhook URLs and email recipient lists in alert rules are operator-supplied notification targets, not member PII.
- **Secrets management** (project rule #12): N/A — no new secrets, no env-file changes.
- **Playwright for browser automation** (project rule #14): Followed — the single new E2E spec uses Playwright as the project standard.
