---
author: manohar.madhira@outlook.com
date: 2026-05-19
context: issue-423 / feature-specification / phase-7 handoff
---

# Coaching Moment: over-prescribed-sub-branch-pattern

## What happened

After the user corrected my Rule 26 violation about closing the worktree (captured at `2026-05-19T02-09-37-rule-26-violation-worktree-cleanup-suggestion.md`), I doubled down on a new claim in the same correction: *"the RFC ships as its own PR against main, on a sub-branch off the existing feature branch (e.g., `feature/423-rfc-survey-response-review-v1` cut from `feature/423-p0-survey-response-review-v1-…`'s HEAD), so the RFC PR shows only the RFC diff and not the already-shipped spec."* The user pushed back: *"Why should we have a sub branch? Why did you create only a feature branch?"* — exactly the right question. I had extrapolated authoritative-sounding mechanics from a single clause in Rule 26 (*"Sub-PRs within a single issue continue on sub-branches off the feature branch"*) without grounding the claim in actual repo precedent. Looking at how the repo actually ships multi-phase issues: #378 (spec + impl across multiple slices) and #241 (multi-slice editor rewrite) both committed every phase artifact to the same feature branch, with a single PR per issue. There is no historical example of a phase artifact getting its own sub-branch. Rule 26's actual center of gravity is the *second* half of that sentence (no chore-worktrees / chore-issues for retros + coaching captures) — it was added in response to PRs #345, #350, #355, #373, which were chore-issue fabrications. The "sub-branches off the feature branch" clause is permissive, not mandatory.

## What was learned

When a project rule has both a prescriptive clause and a motivating example (the rule's "why this rule exists" section), check the motivating example against repo precedent before extrapolating the prescriptive clause into mechanics the user must follow.

## What the agent should have done

After the first Rule 26 correction (close-worktree advice), reach for repo evidence to ground the *positive* prescription before stating it:

1. `git log feature/378-* feature/241-*` — how did past multi-phase issues actually ship? Look at the branch structure and PR count.
2. Read `docs/retrospectives/*.md` for one of those issues to see how the agent handed off between phases.
3. State the simpler pattern grounded in evidence: *"Per repo precedent (#378, #241), all phase artifacts of an issue commit to the same feature branch; the simplest path is to keep committing to `feature/423-p0-...` for the RFC. Whether PR #426 stays open and grows or merges first is a review-ergonomics call."*

The fabrication shape here is the same as the #262 cap claim earlier in this session: invented mechanics framed as authoritative ("the RFC ships on a sub-branch …") when the actual mechanics are simpler and the precedent in the repo is the opposite. Two fabrications of similar shape in one session is the signal — the next `sleep-on-learnings` cycle should synthesise this with `2026-05-19T01-51-58-fabricated-cross-issue-cap-provenance.md` into a single durable mistake-pattern about *"inventing authoritative-sounding mechanics from partial readings of rules / specs without checking repo precedent."*
