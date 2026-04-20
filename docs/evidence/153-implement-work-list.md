# Issue #153 — Implementation Work List

**Issue**: bug: Programs and Campaigns show blank fields when opened in edit/view mode
**Related**: #133 (wizard step label), #134 (reward eligibleTiers hardcoded)
**Type**: Bug (with two related minor bugs bundled)
**Branch**: `feature/153-bug-programs-and-campaigns-show-blank-fields-when-opened-in-edit-view-mode`

---

## Root Cause Summary

Both Programs and Campaigns detail pages fail to populate form state when data arrives after initial render:

1. **Programs**: `ProgramWizard` uses `useReducer` initialized once. A `LOAD` action exists but is never dispatched. When navigating between programs (component reuse) or on cold loads where server-rendered props change, the reducer keeps stale/empty state.
2. **Campaigns**: `CampaignForm` uses `useState` initialized from `initialData` which is `null` on first render (client-side fetch). No `useEffect` syncs form state when data arrives.
3. **#133**: Step 3 label says "Next: Rewards" for POINTS programs, but Step 4 (Tiers) always renders.
4. **#134**: `mapReward` in `program-wizard-loader.tsx` hardcodes `eligibleTiers: 'All Tiers'` ignoring the API's `eligibleTierIds`.

The "works in creating browser, blank in others" behavior is explained by Next.js router cache preserving RSC payload from the creation flow.

---

## Implementation Checklist

### Fix 1: ProgramWizard — dispatch LOAD on initialState change
- [x] `apps/web/src/app/(admin)/admin/programs/_components/program-wizard.tsx`
  - Added `useEffect`, `useRef` imports
  - Added `useEffect` after `useReducer` that dispatches `LOAD` when `initialState` changes
  - Uses JSON comparison via `useRef` to avoid infinite re-renders

### Fix 2: CampaignForm — sync form state on initialData change
- [x] `apps/web/src/components/campaigns/CampaignForm.tsx`
  - Added `useEffect` after `useState` init watching `initialData`
  - When `initialData` becomes non-null, calls `setForm()` with mapped values

### Fix 3: Step 3 label — #133
- [x] `apps/web/src/app/(admin)/admin/programs/_components/wizard-steps/step3-earning-rules.tsx`
  - Changed conditional label to always show `'Next: Tiers →'`

### Fix 4: mapReward eligibleTiers — #134
- [x] `apps/web/src/app/(admin)/admin/programs/_components/program-wizard-loader.tsx`
  - Changed `mapReward` to accept `tiers: ApiTier[]` parameter
  - Resolves `eligibleTierIds` to tier names; falls back to `'All Tiers'` when empty
  - Updated call site in `mapProgramToState`

---

## Validation Requirements

- **uiValidationRequired**: false (no new UI; fixes data population in existing UI)
- **mobileValidationRequired**: false
- **buildCheck**: `pnpm build` must pass
- **typecheckCheck**: `pnpm typecheck` must pass
- **smokeTests**: `pnpm test:smoke` must pass
- **manualValidation**: Requires running app with database to verify programs/campaigns load data

---

## Deferrals / Open Questions

- None. All four fixes are straightforward state-management corrections with no architectural impact.

---

## Pattern Notes (from codebase discovery)

- `getAuthToken` helper from `@/lib/config` is the standard auth pattern
- Server components use `auth()` from `@clerk/nextjs/server` for SSR data fetching
- `useReducer` + action dispatch is the established pattern in the program wizard
- `useState` + `useEffect` sync is the standard pattern for client components with async data
- Project Rule #15 applies: these are per-component fixes (4 files), not a systemic abstraction issue
