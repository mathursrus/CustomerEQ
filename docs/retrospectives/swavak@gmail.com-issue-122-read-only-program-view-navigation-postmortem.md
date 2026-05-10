---
author: swavak@gmail.com
date: 2026-04-09
synthesized: 2026-05-08
---

# Postmortem: Read-Only Program View Navigation Bug — Issue #122

**Date**: 2026-04-09
**Duration**: 1 session (scoping → implementation → submission)
**Objective**: Fix read-only program view blocking navigation from Step 2 (Basic Info) due to Start Date validation firing on a disabled field, and stepper being fully non-interactive in view-only mode.
**Outcome**: Success — PR #124 submitted and approved in first round with zero feedback.

## Executive Summary

Issue #122 was a UX demo blocker: viewing a loyalty program in read-only mode was impossible because `Step2BasicInfo.handleNext()` validated `startDate` as required even when `isViewOnly=true` (where the field is disabled). A secondary bug — `WizardStepper` receiving `onStepClick=undefined` in view-only mode — made it fully non-interactive. The combined effect was that users had no path forward past Step 2 without switching to Edit mode. Both bugs fixed with 11 net lines across 3 files. Zero feedback rounds.

## Architectural Impact

**Has Architectural Impact**: No

The fix is purely behavioral — no new components, patterns, endpoints, or DB changes. `allStepsClickable` is a minor optional prop on an existing shared component, not a new architectural pattern.

## Timeline of Events

### Phase 1: Scoping & Root Cause
- ✅ **Read issue #122**: Understood two-bug chain — validation + stepper disabled
- ✅ **Read step2-basic-info.tsx**: Confirmed `handleNext()` validates unconditionally
- ✅ **Read program-wizard.tsx**: Confirmed `onStepClick={isViewOnly ? undefined : goToStep}`
- ✅ **Read wizard-stepper.tsx**: Confirmed `isClickable = isCompleted && !!onStepClick` — all future steps non-clickable
- ✅ **Read program-wizard-loader.tsx**: Confirmed `startDate: null` maps to empty string, triggering validation

### Phase 2: Implementation
- ✅ **E2E test written**: 3 scenarios in `program-view-readonly.spec.ts`
- ✅ **Fix 1**: `handleNext()` early-return when `isViewOnly`
- ✅ **Fix 2**: `allStepsClickable` prop added to `WizardStepper`
- ✅ **Fix 3**: `program-wizard.tsx` updated to always wire `onStepClick` and pass `allStepsClickable={isViewOnly}`
- ✅ **TypeScript clean**: 0 errors in changed files
- ✅ **Smoke tests**: 516 passed

### Phase 3: Submission
- ✅ **Committed**: `6c6ab5d` — fix + tests + evidence
- ✅ **Evidence committed**: `2ffce2d` — implementation evidence + quality feedback
- ✅ **PR #124 created**: Draft, first round, approved with zero feedback
- ✅ **Issue labeled**: `phase:impl`, `status:needs-review`

## Root Cause Analysis

### 1. **Validation not gated on mode**
**Problem**: `Step2BasicInfo.handleNext()` was written for create/edit mode only. When view-only mode was introduced later, the validation was not updated to skip when `isViewOnly=true`.
**Impact**: `startDate` is empty string when the DB value is null. Validation fires. Field is disabled. User is permanently blocked.

### 2. **Stepper interactivity silently disabled in view-only mode**
**Problem**: `program-wizard.tsx` passed `onStepClick={isViewOnly ? undefined : goToStep}`. The intent was to prevent editing via the stepper, but it also prevented read navigation.
**Impact**: Even if the "Next" button worked, users couldn't jump directly to a step via the stepper in view-only mode. Combined with bug #1, there was no forward path at all.

## What Went Wrong

1. **Two independent bugs compounded**: Either bug alone would have been a partial blocker, but both together created a complete dead-end with no workaround visible to users.
2. **View-only mode added as an afterthought**: The wizard was designed for create/edit; view mode was retrofitted without auditing each step's validation logic.

## What Went Right

1. **Root cause clearly visible in code**: Once `step2-basic-info.tsx` and `program-wizard.tsx` were read side-by-side, both bugs were immediately apparent. No debugging session required.
2. **Minimal, targeted fix**: 11 net lines across 3 files. The `isViewOnly` prop was already threaded through `StepProps` — no new prop drilling needed.
3. **Optional prop design for `allStepsClickable`**: Making it `boolean | undefined` with a falsy default means all existing `WizardStepper` call sites (create/edit mode) are unaffected without any changes.
4. **Zero feedback rounds**: PR #124 approved on first submission.
5. **Stepper fix has broader value**: `allStepsClickable` is now a reusable affordance for any future view-only or summary mode in the wizard.

## Lessons Learned

1. **When adding view-only mode to a wizard, audit every step's `onNext` handler**: Each step that validates required fields must gate that validation on `!isViewOnly`. This is not handled automatically by disabling form inputs.
2. **Removing event handlers to "disable" interaction in view-only mode is fragile**: Passing `undefined` as `onStepClick` silently removes navigation affordance. Prefer a prop (`allStepsClickable`) that is semantically clear about intent.
3. **Compounding bugs are harder to notice**: The two bugs together look like "read-only mode is broken everywhere," obscuring the fact that two independent, simple fixes are sufficient. Always decompose the symptom into its constituent causes before estimating fix complexity.
4. **`startDate: null` → empty string is a load-time gotcha**: The loader maps null to `''`, which means any validation checking `!state.startDate` will fire immediately on a program with no start date — even in edit mode if the program was saved without one. This could be a latent bug in edit mode too (though not reported).

## Agent Rule Updates Made to avoid recurrence

1. **View-only mode wizard audit rule**: When implementing or modifying any wizard step that has a `handleNext()` with field validation, the first check in `handleNext()` must be `if (isViewOnly) { onNext(); return; }`. This applies to all current and future steps.
2. **Stepper interactivity rule**: Never pass `onStepClick={undefined}` to disable stepper navigation in view-only mode. Instead pass the handler and use a semantic prop (`allStepsClickable`) to control which steps are reachable.

## Enforcement Updates Made to avoid recurrence

1. **New step checklist item**: When adding a new wizard step component with a "Next" handler, the implement-quality phase grep should check that `isViewOnly` is consulted before any required-field validation runs.
2. **View-only mode regression test**: Any PR that modifies the program wizard should include a check that view-only navigation (all 7 steps accessible without entering edit mode) still works.
