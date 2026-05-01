---
author: manohar.madhira@outlook.com
date: 2026-05-01
context: issue-170-pr2-retrospective
---

# Coaching Moment: options-with-and-without-sunk-cost

## What happened

During the Issue #170 spec re-segmentation conversation, the user asked whether the current "Own application / Static site / Multiple applications" picker was the right segmentation. The agent first proposed a "light reframe" (Option A) that kept the existing three-bucket structure, repurposed #172 as a SaaS-connector hub, and preserved the Prisma enum / sub-issues — explicitly framed as the lower-cost path because "PR #197 shipped the enum, sub-issues #171/#172/#173 exist." The user then asked, "If we don't worry about sunk cost, what would you suggest?" — and at that prompt the agent committed to the JTBD-based segmentation (winback / listen / reward tracks), which was a substantively different and arguably better recommendation. On reviewing the resulting retrospective PR #222, the user left an inline comment on the "Almost Did Wrong But Caught" entry: *"This is a key learning moment. When presenting options, we should consider both 'with sunk cost' and without sunk cost."* The point is that the agent should have presented both frames side-by-side from the start, not buried the clean-slate answer behind a follow-up prompt.

## What was learned

When recommending a path forward on a strategic or design question, present both the "with sunk cost" recommendation and the "without sunk cost / clean slate" recommendation upfront in the same response, with the cost of the pivot named explicitly — let the user choose the frame, don't choose it for them.

## What the agent should have done

Structured the initial recommendation as two parallel options with explicit framing:

> **Option A — respecting sunk cost:** keep three buckets, rename + reframe #172 as SaaS-connector hub. Cost: ~60-100 lines of spec edits, no enum migration, no sub-issue churn.
>
> **Option B — clean slate:** re-segment by JTBD (winback / listen / reward). Cost: enum rename migration, all three sub-issues re-scoped or replaced, larger spec rewrite.
>
> **The choice between them is whether the sunk cost is worth preserving.** I lean toward [X] because [tradeoff], but this is genuinely your call.

That framing surfaces both candidate recommendations, names the deciding tradeoff, and lets the user pick frame and answer in one shot. It also avoids the failure mode of the agent silently weighting "minimize change" higher than "right answer" without telling the user.
