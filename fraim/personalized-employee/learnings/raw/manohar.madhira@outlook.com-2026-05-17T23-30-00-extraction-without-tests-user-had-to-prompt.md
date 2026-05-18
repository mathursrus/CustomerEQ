---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: extraction-without-tests-user-had-to-prompt

## What happened

In response to the user's pushback on deferring the hook extraction (see [[merit-over-ease-misfired-on-hook-extraction]]), I authored `apps/web/src/components/survey-form/useSurveyResponseForm.ts` — a ~250-line shared hook owning survey fetch, answers/consent/memberId state, clear-on-change handlers, required-question + explicit-consent validation, and the `effectiveConsentMode` projection. I then refactored both live host pages (`apps/web/src/app/survey/[id]/page.tsx` and `apps/web/src/app/survey/[id]/r/[token]/page.tsx`) to consume it. I ran `pnpm --filter @customerEQ/web exec tsc --noEmit` (clean), eslint on the changed dirs (clean), and `pnpm --filter @customerEQ/web build` (clean). I then **reported the work done** without writing tests. The user prompted: *"Have you written test cases and run them?"* — and only then did I write `useSurveyResponseForm.test.ts`. The 14-case test suite passed first try (renderHook + global-fetch stub: validate() in both flows, clear-on-change for answer/consent/memberId, `effectiveConsentMode` resolution, `enabled=false` gate, `loadError`). The tests would have passed first try if written *before* declaring done, too. The gap was **process**, not capability. A shared module with no tests is **worse than the duplicate copies it replaces**, because consumers couple to a contract that nothing locks down — if a future refactor breaks the shape of `validate()`, both host pages silently regress at once. The tests are the lock. My internal accounting closed the work at "code compiles + downstream pages compile" — one step short of the FRAIM `feature-implementation` job's Principle: *"For features, write tests alongside code."* Project Rule 9 says *"P1 features: unit tests + integration tests required."* The hook is a unit; a unit test was the obvious co-deliverable. Neither the FRAIM principle nor Rule 9 fires automatically; both require me to *check* whether the new code I just wrote constitutes a "unit" and to pair the test accordingly. I didn't check.

## What was learned

**A test-discipline forcing function lives at the *declare-done* moment, not at the *deliverables* moment.** Before reporting any extraction / new-component / new-hook work done, name the test-file path in your head (`<dir>/<basename>.test.ts`). If the test file doesn't exist yet, write it now, run it, then declare done. Naming the path is the forcing function — if you can name it, the file must exist.

## What the agent should have done

1. **At the moment of typing `Write` on `useSurveyResponseForm.ts`**, also list `useSurveyResponseForm.test.ts` as the second file to write before the commit. The test belongs in the same logical unit of work as the extraction — pair them as a discipline at draft time, not as a post-hoc reflex.

2. **At the moment of declaring "the extraction is done"**, run a self-check: *"For every new file I wrote in this scope of work, name the corresponding test-file path. Do all of those test files exist on disk?"* If any don't, write them, run them, then declare done. The forcing function is *path-naming*, not abstract "are there tests?" — because path-naming converts the abstract question into a concrete file existence check.

3. **When the user prompts "have you written tests"**, take that as the canonical signal that I missed the gate. The right response is not "yes I'll write them now" — it's *"You're right, I should have paired the tests with the extraction. Writing them now."* The acknowledgement is the L0-promotion fuel.

Umbrella with [[extract-on-second-surface-introduction]]: the same draft-time-self-check pattern fixes both — *name what's about to be written before the typing, and check the gate before declaring done*. Both are *forcing functions on the agent at the load-bearing moment*, not rules to be remembered later.
