# Issue #122 — Implementation Work List

**Issue**: bug: read-only program view requires start date entry, making programs unviewable without editing  
**Type**: Bug  
**Branch**: `feature/122-bug-read-only-program-view-requires-start-date-entry-making-programs-unviewable-without-editing`

## Root Cause

Two bugs compounded to make read-only program viewing impossible:

1. **`Step2BasicInfo.handleNext()`** runs field validation (name required, start date required) even when `isViewOnly=true`. Since the Start Date input is `disabled` in view-only mode, users cannot fill it — the validation fires, blocks navigation, and there is no way to advance.

2. **`WizardStepper`** only makes *completed* (already-visited) steps clickable, controlled by `isClickable = isCompleted && !!onStepClick`. `program-wizard.tsx` passed `onStepClick={undefined}` in view-only mode, making the stepper entirely non-interactive.

Together: users on Step 2 in view-only mode have no forward path.

## Changes

| File | Change |
|------|--------|
| `apps/web/src/app/(admin)/admin/programs/_components/wizard-steps/step2-basic-info.tsx` | `handleNext()` returns early via `onNext()` when `isViewOnly` — no validation runs |
| `apps/web/src/components/ui/wizard-stepper.tsx` | Added `allStepsClickable?: boolean` prop; `isClickable` condition updated to `!!onStepClick && (isCompleted \|\| !!allStepsClickable)` |
| `apps/web/src/app/(admin)/admin/programs/_components/program-wizard.tsx` | Stepper always receives `onStepClick={goToStep}` and `allStepsClickable={isViewOnly}` |
| `apps/web/test/e2e/program-view-readonly.spec.ts` | New E2E test: 3 scenarios covering null startDate, set startDate, and stepper direct-click in view-only mode |

## Validation Requirements

- `uiValidationRequired`: Yes — navigating all 7 steps in view-only mode on an existing program, including one with `startDate: null`
- `mobileValidationRequired`: No — desktop admin console only
- Browser baseline: Chrome (primary), Edge, Firefox

## Implementation Checklist

- [x] `step2-basic-info.tsx` — skip validation in `handleNext` when `isViewOnly`
- [x] `wizard-stepper.tsx` — add `allStepsClickable` prop
- [x] `program-wizard.tsx` — pass `allStepsClickable={isViewOnly}` and always wire `onStepClick`
- [x] E2E test written: `program-view-readonly.spec.ts`
- [ ] TypeScript build passes (`pnpm typecheck` in `apps/web`)
- [ ] Committed and pushed

## UI Validation Plan

Target journeys:
1. Navigate to a program with no startDate in view mode → advance through all 7 steps without entering edit mode
2. Navigate to an active program with a startDate in view mode → same journey
3. Verify stepper steps are directly clickable in view mode
4. Verify validation still fires correctly in create/edit mode (regression)

Evidence artifact: `docs/evidence/122-ui-validation.md` (to be created after manual validation)

## Deferrals / Open Questions

- Step 1 "Next" button is `disabled` when `!state.programType`. For a real program, type is always set, so this is not a blocker. No change needed.
- Other steps (3–7) have no blocking validation on their "Next" buttons per code review — no changes needed there.
