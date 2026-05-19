---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: extract-on-second-surface-introduction

## What happened

On #378 (PR #385), I built a new tokenized respondent page at `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (commit `f19ab7c`) as a structural sibling of the pre-existing public page at `apps/web/src/app/survey/[id]/page.tsx`. Both wrap the same `SurveyFormRenderer`. My mental model at draft time was *"one renderer, two thin host pages — they share the renderer, that's the locus of reuse"*. So I authored the tokenized page by **copying the structural shape** of the public page and then stripping out what the tokenized flow didn't need (member-id field, member-email POST). I kept the surrounding host-page logic — survey fetch, answers/consent state, required-question + explicit-consent validation, error wiring — as *page-local scaffolding*. That framing was wrong: the host-page glue WAS the locus of the inline-error contract from #241 (`errors.questions[id]` / `errors.consent` are renderer props, but the *values* are built by page-level validation). My copy reproduced the *shape* without the *contract*, and the inline-error contract silently disappeared from the tokenized flow. The regression then surfaced in Phase 12 round 2 when the user reported *"In #241 we had corrected that error messages show exactly below the question answer block with the error. Required questions right below, user friendly message for Consent to checked. With the last change those seem to have reverted back."* The fix required extracting `useSurveyResponseForm` (~250 lines) and refactoring both pages to consume it — exactly the work that should have happened at the moment of *introducing* the second surface, not as a *recovery* from the regression. Rule 15 ("Fix at the Right Abstraction Level") and the existing M-pattern at `architecture.md:448` both endorse extract-on-duplication, but I read them as *react-to-duplication* rules and didn't fire them at the *creation* event. The user's framing closed the loop: *"This is the first time we are introducing a new surface and we created a copy instead of DRY"*.

## What was learned

**Introducing the first instance of a second conceptual surface (page, route, renderer, host) for an operation that already has a first instance is itself the abstraction-level trigger.** Default to extract-first-host-pages-second in the same commit that introduces the second surface — not as a follow-up refactor and not as a recovery from regression. The triggering signal is "I'm about to author surface N+1 for an existing operation"; do not wait for the duplication to be visible in the diff before extracting.

## What the agent should have done

Two concrete behaviors:

1. **Before authoring the tokenized respondent page, run a 30-second extract-or-copy check**: list what the public page does (fetch survey, manage answers/consent/memberId, validate, POST, branch on response). For each item, mark whether the tokenized page needs the same behavior. If ≥3 items are shared, *extract first*, then write both pages on top of the shared module. In #378 every item except (memberId-field + POST body) was identical — the extraction was obvious at draft time.

2. **Re-read Rule 15 verbatim at the moment of authoring surface N+1 for an existing operation**: *"Repeated logic across pages → extract to a shared utility or hook"* — and treat "repeated logic" as a *prediction-time* condition (will this be repeated?) rather than a *recognition-time* condition (am I noticing this is repeated?). The forcing function is *naming what's about to be duplicated* before typing the first import statement of the new file.

Related L0 candidates: this is shape-adjacent to [[merit-over-ease-misfired-on-od-2]] and [[merit-over-ease-misfired-on-hook-extraction]] — all three share the root *"the rule lives in memory but doesn't fire at draft time because I didn't name the trigger condition explicitly in-turn."* The mitigation pattern is the same: paste the rule's deciding axis before the load-bearing decision.
