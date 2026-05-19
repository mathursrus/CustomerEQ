---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: merit-over-ease-misfired-on-hook-extraction

## What happened

Second firing of `feedback_merit_over_ease` in the same issue (#378). When the user asked *"why are there two renderers in the first place? shouldn't you just resolve the member ID and pass it on the default Survey Renderer?"*, I correctly explained why server-side token→member-id resolution would violate the #378 identity contract (NFR-S4 PII non-disclosure, 4-state token semantics, atomic single-use semantics, batch attribution). That analysis was sound. But I then *recommended deferring the hook extraction itself to a follow-up issue*, citing Rule 26 ("one PR per issue") as if it were a budget constraint that argued for "minimize scope per PR." That framing was wrong on merit: #378 *introduced* the second surface, so it owns the duplication it created. The user pushed back invoking the L1 entry directly: *"Why shouldn't it be in 378. This is the first time we are introducing a new surface and we created a copy instead of DRY (Do not repeat yourself paradigm in coding)."* I had L1 `feedback_merit_over_ease` loaded into the session context. Same loaded-but-didn't-fire mode as the prior L0 [[merit-over-ease-misfired-on-od-2]] (2026-05-17T17:00) — same issue, same day, same shape. The L0 from earlier today explicitly says *"L1 rules I have in memory don't fire at draft time because I'm not naming the deciding axis explicitly before recommending"* — and that prediction held. I made the same mistake again 5 hours later despite having the L0 written down. The cost: one user turn to invoke the memory back at me, then a course correction. The signal: **L0 → L1 promotion has not yet happened, but even if it had, the L1 rule alone isn't load-bearing**. The rule needs a *pre-flight trigger condition* baked in, not just a rule statement, otherwise it loses to immediate-reaction instinct every time.

## What was learned

**`feedback_merit_over_ease` fires twice in the same issue means the L1 rule needs a pre-flight prompt clause, not just a description.** The clause should be: *"Before recommending follow-up issue / defer / split into another PR, name the long-term-best blocker that justifies the deferral, in the same recommendation. Absence of a named blocker = retract the deferral."* This is a structural addition to the rule, not a behavioural one — the rule should force the agent to write the blocker explicitly or recant.

## What the agent should have done

1. **Before typing "let me defer this to a follow-up issue,"** name the long-term-best alternative and the *specific blocker* that prevents it being done now. If the blocker is "diff size," "scope," "review surface," "ease," or "drop-in swap" — retract the deferral. If the blocker is concrete (e.g., "this requires a database migration that needs its own coordination window" or "this requires a permission RBAC layer that doesn't exist yet"), proceed with the deferral and cite the blocker in the issue body. In #378 the actual long-term-best was *extract now*, and the cited "blocker" (Rule 26) was a misread — Rule 26 is a *topology* rule (all phase artifacts ride one PR), not a *budget* rule. Naming the blocker would have surfaced the misread before the user had to.

2. **When the same rule fires twice in the same session**, that is itself a signal — log it as a coaching moment in real time and call out the repeat to the user, not just in the retro. The user shouldn't have to invoke the memory back at me twice in one issue. If I notice "I've made this misfire before, in this issue, today," that should fire a *suspend-and-reread* reflex on the rule before the second misfire lands.

Related: [[merit-over-ease-misfired-on-od-2]] (first firing, same issue, 5h earlier). Both share the umbrella with [[extract-on-second-surface-introduction]] and [[rule-26-misread-handoff-doc]] — *L1 rules lose to immediate-reaction instinct unless named in-turn at the load-bearing decision*.
