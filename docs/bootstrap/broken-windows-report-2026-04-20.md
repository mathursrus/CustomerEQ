# Broken Windows Detection Report

**Date**: 2026-04-20
**Pattern Health**: Moderate — 3 list pages deviate from the standard list → view → edit navigation pattern

## Executive Summary

The Programs page establishes the standard CRUD navigation pattern: list click opens a **view-only** page (`/entity/{id}`), which offers an "Edit" button navigating to a separate **edit** page (`/entity/{id}/edit`). The list also provides a direct "Edit" link in row actions. Three route-based entities deviate from this pattern, causing AI agents to learn inconsistent navigation flows.

**Reference implementation**: Programs, Surveys (both follow the pattern correctly)
**Reusable component**: `apps/web/src/components/ui/view-only-banner.tsx`

## Critical Broken Windows

### 1. Alert Rules — Direct-to-Edit, No View Route (Priority: High)

**Dominant pattern**: List click → `/entity/{id}` (view-only) → `/entity/{id}/edit`
**Broken**: List click → `/admin/alerts/rules/{id}/edit` (skips view-only)

- **List page**: `apps/web/src/app/(admin)/admin/alerts/rules/page.tsx:138` — `href` links directly to `/edit`
- **Existing routes**: `/alerts/rules` (list), `/alerts/rules/new`, `/alerts/rules/[id]/edit`
- **Missing route**: `/alerts/rules/[id]` (view-only page does not exist)

**Impact**: AI agents see direct-to-edit as the pattern and will replicate it for new entities.
**Fix**:
1. Create `apps/web/src/app/(admin)/admin/alerts/rules/[id]/page.tsx` — view-only with `ViewOnlyBanner`
2. Update list `href` at line 138 from `/alerts/rules/${rule.id}/edit` to `/alerts/rules/${rule.id}`
3. Add separate "Edit" link in row actions
4. Rule form component should accept `mode: 'view' | 'edit'` and disable fields when `mode='view'`

### 2. Campaigns — Direct-to-Edit, No View Route (Priority: High)

**Dominant pattern**: List click → `/entity/{id}` (view-only) → `/entity/{id}/edit`
**Broken**: List click → `/admin/campaigns/{id}/edit` (skips view-only)

- **Actions component**: `apps/web/src/app/(admin)/admin/campaigns/CampaignActions.tsx:36` — `href` links directly to `/edit`
- **List page**: `apps/web/src/app/(admin)/admin/campaigns/page.tsx` — campaign name is not a clickable link to view
- **Existing routes**: `/campaigns` (list), `/campaigns/new`, `/campaigns/[id]/edit`, `/campaigns/[id]/preview`
- **Missing route**: `/campaigns/[id]` (view-only page does not exist)

**Impact**: Same direct-to-edit anti-pattern; AI agents will copy this for new entities.
**Fix**:
1. Create `apps/web/src/app/(admin)/admin/campaigns/[id]/page.tsx` — view-only with `ViewOnlyBanner`
2. Make campaign name a clickable `Link` to `/campaigns/{id}` in the list
3. Update `CampaignActions` primary action to link to view route; keep "Edit" as secondary action
4. Campaign form should accept `mode: 'view' | 'edit'` and disable fields when `mode='view'`

### 3. Themes — Combined View+Edit, No Mode Separation (Priority: Medium)

**Dominant pattern**: Separate `/entity/{id}` (view-only) and `/entity/{id}/edit` (editable)
**Broken**: `/settings/themes/{id}` handles both viewing and editing on the same page

- **List page**: `apps/web/src/app/(admin)/admin/settings/themes/page.tsx:93` — links to `/settings/themes/${theme.id}`
- **Detail page**: `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx` — combined view+edit, no mode prop
- **Existing routes**: `/settings/themes` (list), `/settings/themes/new`, `/settings/themes/[id]` (combined)
- **Missing route**: `/settings/themes/[id]/edit` (no separate edit route)

**Impact**: AI agents learn a combined view+edit page pattern instead of the separated approach.
**Fix**:
1. Refactor `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx` to be view-only with `ViewOnlyBanner`
2. Create `apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx` for editing
3. Theme form should accept `mode: 'view' | 'edit'` and disable fields when `mode='view'`

## Clean Patterns (No Broken Windows)

- **Programs**: Full list → view → edit pattern with `ViewOnlyBanner` (**reference**)
- **Surveys**: Full list → view → edit pattern
- **Members**: List → view-only detail page (no edit concept — correct)
- **Alert Cases**: List → view-only detail page with inline status actions (no edit concept — correct)
- **Support Conversations**: List → view-only detail page with reply actions (no edit concept — correct)

## Remediation Priority

1. **Alert Rules** — Create view-only route, update list navigation (Medium effort)
2. **Campaigns** — Create view-only route, update CampaignActions and list navigation (Medium effort)
3. **Themes** — Separate view and edit routes, refactor detail page (Medium effort)

## Prevention Strategy

- Any new CRUD entity must follow the list → view → edit route pattern
- Reuse existing `ViewOnlyBanner` component in all view-only pages
- Form components should accept `mode: 'create' | 'edit' | 'view'` prop
