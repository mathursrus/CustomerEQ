# ADR 0001 — Standard CRUD Admin Route Pattern

**Status**: Accepted
**Date**: 2026-04-20
**Deciders**: CustomerEQ engineering
**Establishing context**: Issue #157 — Standardize list → view → edit navigation pattern across CRUD entities
**Related RFC**: `docs/rfcs/157-standardize-list-view-edit-pattern.md`

---

## Context

The admin portal hosts multiple route-based CRUD entities (Programs, Surveys, Alert Rules, Campaigns, Themes, and more to come). Two distinct navigation conventions emerged organically:

- **Programs / Surveys**: list → view-only at `/[id]` (with an "Edit" call-to-action via `ViewOnlyBanner`) → edit at `/[id]/edit`. Form components accept a `mode` prop (`'create' | 'edit' | 'view'`) and render disabled fields when in view mode.
- **Alert Rules / Campaigns / Themes**: list → directly to edit (Alert Rules, Campaigns), or list → combined view+edit on the same page (Themes).

The drift produced two operator costs (broken muscle memory, accidental edits) and two engineering costs (form-code duplication when each entity hand-rolled its own create/edit pages, and AI-agent confusion about which pattern to copy when adding a new entity).

This ADR records the decision to formalize the Programs pattern as the standard. It is filed as the first ADR in this repository because the choice of route layout creates URL contracts that bookmarks, deep links, and external automation may depend on — making it a one-way door per project rule #4.

## Decision

All admin route-based CRUD entities use the four-route layout:

| Route                          | Purpose      | Component                                                                       |
| :----------------------------- | :----------- | :------------------------------------------------------------------------------ |
| `/admin/{entity}`              | List         | List page (entity-specific)                                                     |
| `/admin/{entity}/new`          | Create       | `<{Entity}Form mode="create" />`                                                |
| `/admin/{entity}/[id]`         | View-only    | `<{Entity}Form mode="view" entity={…} />` wrapped by `<ViewOnlyBanner entityLabel="…" />` |
| `/admin/{entity}/[id]/edit`    | Edit         | `<{Entity}Form mode="edit" entity={…} />`                                       |

Form components must:
- Accept `mode: 'create' | 'edit' | 'view'`
- Derive `const isViewOnly = mode === 'view'`
- Apply `disabled={isViewOnly}` to every interactive control (`<input>`, `<textarea>`, `<select>`, toggle buttons, "Add row" / "Remove" buttons)
- Hide submit/save actions entirely when `isViewOnly`

List pages must:
- Render the entity name as a clickable `<Link>` to `/admin/{entity}/{id}` (the view route)
- Expose a separate row-action "Edit" link directly to `/admin/{entity}/{id}/edit`

`ViewOnlyBanner` (`apps/web/src/components/ui/view-only-banner.tsx`) is the standard read-mode chrome and accepts `entityLabel: string` for entity-specific copy.

Reference implementation: `apps/web/src/app/(admin)/admin/programs/`.

## Alternatives Considered

### A. Single combined view+edit page (Themes pattern, before #157)

Each entity has only `/admin/{entity}/[id]` and `/new`. The detail page renders the form in editable mode by default; saving updates the record in place.

- **Pros**: Two route files instead of three; no banner chrome; one less click for power users.
- **Cons**: Operators cannot share a "look at this without editing it" link. Audit/training scenarios suffer because every read of a record is also an opportunity to mutate it. No deterministic way to detect read intent vs. edit intent in analytics.
- **Why rejected**: Loses the distinction between read intent and edit intent. The vast majority of admin entity views are reads, not edits — surfacing edit affordances in every visit produces accidental modifications and complicates audit trail interpretation.

### B. Modal-based view (read-only modal launched from the list)

The list opens a modal dialog showing the entity in read-only mode; an "Edit" button in the modal navigates to `/admin/{entity}/{id}/edit`. No standalone view route.

- **Pros**: List context is preserved; no full-page navigation; lighter perceived weight.
- **Cons**: View state is not addressable via URL — cannot deep-link, bookmark, or share. Modals do not survive page refresh. Mobile/responsive behavior of large config forms inside a modal is poor.
- **Why rejected**: Loss of URL-addressability is a regression for support workflows ("send me the link to the alert rule that fired") and for AI agents that need to reference a specific entity state.

### C. Pattern owned per entity, no global standard

Each entity team picks the navigation approach that fits its workflow. Do not document a standard.

- **Pros**: Maximum flexibility; no lift-and-shift cost for the existing deviating entities.
- **Cons**: Continued drift; AI agents replicating whichever pattern they pattern-matched first; broken operator muscle memory when navigating across entities.
- **Why rejected**: The whole point of issue #157 is that drift is the problem. Codifying the standard is the remediation.

## Consequences

### Positive

- Consistent operator experience across all admin CRUD entities.
- Single place (this ADR + the architecture.md §3.1 paragraph) to point AI agents at when they ask "how do I add a new admin entity?"
- URL-addressable view state; share-and-bookmark workflows work naturally.
- Form-mode prop convention enables a single form component per entity rather than separate `EditFoo.tsx` / `NewFoo.tsx` files (which today drift apart — see project rule #15).
- TypeScript catches misuse of `ViewOnlyBanner` because `entityLabel` is a required prop.

### Negative / Costs

- Adding a new entity now requires four route files instead of two or three. This is mostly mechanical (the route files are thin wrappers around the form component) but it is more files.
- One-way door: the Themes URL change (`/admin/settings/themes/{id}` going from editable to view-only) is a contract change for any pre-existing bookmarks. Internal admin surface only — no public consumers — so the impact is bounded, but it is real.
- The standard does not apply to inline-editing list pages (KB Articles, Support Rules, Integrations as of 2026-04-20) where the editing surface is the list itself. Those entities are explicitly out of scope; if their pattern needs standardizing, file a separate issue.

### Implementation order

Per the RFC, rolled out in 4 PRs:

1. `ViewOnlyBanner` widening + this ADR + architecture.md update (this PR)
2. Alert Rules
3. Campaigns
4. Themes (carries the URL contract change + the cross-entity Playwright spec)
