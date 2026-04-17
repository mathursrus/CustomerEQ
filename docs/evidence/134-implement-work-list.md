# Issue #134 Standing Work List

## Bug
`mapReward` in `apps/web/src/app/(admin)/admin/programs/_components/program-wizard-loader.tsx` hardcodes `eligibleTiers: 'All Tiers'` and ignores `apiReward.eligibleTierIds` returned from `GET /v1/programs/:id`. View mode Step 5 displays the wrong tier eligibility for any tier-scoped reward.

## Fix Plan
- Update `mapReward` to accept the program's `ApiTier[]` and resolve `eligibleTierIds` to a comma-separated string of tier names.
- Empty array -> "All Tiers" sentinel (what Step 5 already falls back to).
- Unknown tier IDs (defensive) -> filter out; if nothing resolves, fall back to "All Tiers".
- Update `mapProgramToState` call site to pass tiers into `mapReward`.
- Export `mapReward` and `mapProgramToState` for unit testing.

## Checklist
- [ ] Update `program-wizard-loader.tsx`: new mapReward signature, export helpers.
- [ ] Add vitest config to `apps/web` + `test:smoke` npm script.
- [ ] Add unit test `apps/web/src/app/(admin)/admin/programs/_components/__tests__/program-wizard-loader.test.ts` covering:
  - Empty eligibleTierIds -> "All Tiers"
  - Single tier id -> matching tier name
  - Multiple tier ids -> comma-separated names (preserving tier order)
  - Unknown tier id -> filtered out, falls back to "All Tiers" if none resolve
  - `mapProgramToState` wires tiers through rewards end-to-end
- [ ] Run `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test:smoke`.
- [ ] Browser validation via Playwright: open a TIERED program in view mode, screenshot Step 5.
- [ ] Save screenshot to `docs/evidence/134-fix-validation.png`.

## Validation Requirements
- uiValidationRequired: true (view mode Step 5 rewards card)
- mobileValidationRequired: false
- Browser validation: Chromium via Playwright MCP, navigate to /admin/programs/{tiered-id}?mode=view

## Known Risks
- `apps/web` has no unit test runner today. Adding vitest here is scoped, additive, and aligned with the rest of the monorepo.
- Reward create/save path (`program-wizard.tsx` line 349) does not currently send `eligibleTierIds` to the API. That's a separate bug — out of scope for #134, which is specifically the view-mode read path.
