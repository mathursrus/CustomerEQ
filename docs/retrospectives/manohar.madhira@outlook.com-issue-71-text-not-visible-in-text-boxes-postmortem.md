---
author: manohar.madhira@outlook.com
date: 2026-03-31
synthesized: 2026-04-27
---

# Postmortem: Text not visible while typing in text boxes across the site - Issue #71

**Date**: 2026-03-31
**Duration**: ~30 minutes
**Objective**: Fix invisible text in form inputs (input, textarea, select) across the site — text was not visible while typing.
**Outcome**: Success (after course correction)

## Executive Summary

Form inputs across Surveys, Survey Builder, Campaigns, Alerts, and Analytics pages had invisible text while typing because they lacked an explicit text color. The initial fix added `text-gray-900` to each individual input across 7 files (50+ elements). After user feedback, the approach was corrected to a single 5-line global CSS rule in `globals.css` that sets `color: var(--foreground)` on all input/textarea/select elements — covering all current and future pages.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Issue Creation
- ✅ **Created Issue #71**: Documented the bug — text invisible in text boxes site-wide, previously fixed in Programs only.

### Phase 2: Investigation
- ✅ **Root cause identified**: Programs page had `text-gray-900` on all inputs; other pages did not. Form inputs don't reliably inherit `color` from `body` in all browsers/contexts.
- ✅ **Full audit**: Identified all 7 affected files and 50+ input elements missing text color.

### Phase 3: First Implementation (Wrong Approach)
- ❌ **Per-file fix**: Added `text-gray-900` individually to every input className across 7 files.
- ❌ **Committed and pushed**: `920925e fix: add text-gray-900 to all form inputs site-wide for visible text while typing`

### Phase 4: Course Correction
- ✅ **User feedback**: "Why are you individually updating style in each file? Isn't having global style a better pattern?"
- ✅ **Reverted per-file changes**: Restored all 7 files to original state.
- ✅ **Global fix**: Added `input, textarea, select { color: var(--foreground); }` to `globals.css`.
- ✅ **Committed and pushed**: `f126943 fix: add global text color for form inputs to ensure visible text while typing`

## Root Cause Analysis

### 5 Whys: Why was the first fix wrong?

1. **Why** was the first fix wrong? → Added `text-gray-900` per-file instead of a global CSS rule.
2. **Why** per-file? → Because the Programs page used `text-gray-900` and I treated it as the standard to replicate.
3. **Why** treat Programs as the standard? → Because the issue said "fixed in Programs" and I anchored on the existing implementation without questioning it.
4. **Why** not question it? → Because I skipped the "at what abstraction level should this fix live?" step — went straight from diagnosis to mechanical replication.
5. **Why** skip that step? → No built-in checkpoint in my process that asks "is this a systemic issue requiring a systemic fix?" before implementing.

**Category**: Skill — missing a design-level thinking step between diagnosis and implementation.

### 1. **Primary Cause (of the bug)**
**Problem**: Form elements (input, textarea, select) did not inherit the foreground text color from `body`. The `--foreground` CSS variable was set on `body` but form elements in many browsers/contexts don't inherit `color` from their parent.
**Impact**: Users could not see what they were typing in form fields on most pages except Programs.

### 2. **Primary Cause (of the wrong fix approach)**
**Problem**: Pattern-matching on the symptom rather than the root cause. Saw "Programs has `text-gray-900`, other pages don't" and mechanically replicated the pattern without asking "why is this needed at all?"
**Impact**: Produced a fragile, high-churn fix (7 files, 50+ changes) that would not protect future pages and increased maintenance burden.

### 3. **Contributing Factors**
**Problem**: The investigation found the difference between Programs and other pages but stopped there. Never questioned whether the Programs approach itself was the right pattern, or whether a systemic fix existed.
**Impact**: Skipped the architectural thinking step — went straight from "what's different" to "make everything the same" without considering "what should the system guarantee."

## What Went Wrong

1. **Symptom-level fix**: Mimicked the existing Programs pattern (per-element `text-gray-900`) instead of solving the root cause (missing global form element color inheritance).
2. **No design-level thinking**: Jumped to implementation without asking "what's the right abstraction level for this fix?" A CSS inheritance issue should be solved in CSS, not in 50+ JSX classNames.
3. **Anchoring bias**: The Programs code was treated as "the standard to copy" rather than "one workaround that happened to work." The real standard should have been the global stylesheet.

## What Went Right

1. **Thorough audit**: Successfully identified all 7 affected files and 50+ inputs across the entire site — no pages were missed.
2. **Quick course correction**: Once the user pointed out the issue, immediately reverted and implemented the correct global approach.
3. **Global fix is robust**: Uses `var(--foreground)` which respects dark mode, covers future pages, and is a single source of truth.

## Lessons Learned

1. **Ask "at what level should this fix live?"** before implementing. If the problem is cross-cutting (affects all pages), the fix should be cross-cutting (global CSS), not per-component.
2. **Don't copy patterns — question them.** The Programs `text-gray-900` was itself a workaround, not a standard to emulate. The right question was "why do inputs need this at all?" which leads to the CSS inheritance gap.
3. **CSS inheritance issues belong in the stylesheet, not in component classNames.** When form elements don't inherit a property, the fix is a global CSS rule, not 50 Tailwind classes.

## Agent Rule Updates Made to avoid recurrence

1. **Added Project Rule #15 — "Fix at the Right Abstraction Level"**: Codified in `fraim/personalized-employee/rules/project_rules.md`. Before implementing a fix that touches 3+ files with the same change, stop and ask whether it belongs in a shared layer (globals.css, shared component, utility, config). The test: if a new page would need the same fix applied manually, the abstraction level is wrong.
2. **Question the reference implementation**: When using an existing "working" page as a reference, ask whether its approach is the right pattern or just a local workaround that happened to work.

## Enforcement Updates Made to avoid recurrence

1. **3-file threshold trigger**: If a proposed change touches 3+ files with the same mechanical edit, the agent must pause and evaluate whether a shared/global fix exists before proceeding. This acts as a natural checkpoint against shotgun fixes.
2. **Saved feedback memory**: Recorded this learning in agent memory so it persists across future conversations.
