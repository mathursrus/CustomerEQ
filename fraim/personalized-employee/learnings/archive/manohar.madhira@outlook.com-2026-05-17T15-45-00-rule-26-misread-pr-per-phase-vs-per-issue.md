---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: rule-26-misread-pr-per-phase-vs-per-issue

## What happened

On #378 design phase, after completing the RFC and design-phase evidence, I created a new sub-branch `design/378-technical-design` off `feature/378-...` and opened **PR #407** (base = the feature branch) for "the design phase artifact." Spec PR #385 was already open on the feature branch. The reasoning I gave myself was Rule 26's wording — *"Each phase artifact ships in **one PR** containing the artifact + any architecture / evidence / test updates surfaced in that phase"* — which I read as "one PR per phase = three PRs per issue (spec / RFC / impl)." The user corrected: *"Why did the RFC create a new PR instead of a new commit on #385? We just had the discussion. #404 also fixed this confusion. So rebase to main, so that this doesn't repeat."* Two reveals: (1) Rule 26 was already reworded in PR #406 (merged 2026-05-17, hours before this session started) specifically to extinguish the "one PR per phase artifact" misread, and (2) my feature branch was cut **before** #406 merged, so the locally-checked-out `project_rules.md` still carried the old ambiguous wording. Even consulting Rule 26 in my working dir would have re-fired the misread. Three indirect signals in Rule 26 itself pointed at the correct reading (B = "all phase artifacts ship in *the* one PR per issue") that I missed: (i) the rule explicitly says *"one issue spans spec → RFC → impl → Phase 13"* (one issue, one PR, multiple phases); (ii) *"Sub-PRs within a single issue"* is framed as an exception, not the default; (iii) the `work-completion` job runs *one* merge cycle at the end (`resolution-merge → resolution-verification → resolution-cleanup`), not three. The fix: cherry-pick the two design commits onto the feature branch, rebase onto current main to pick up #406's reword, force-push (updates #385 in place), close #407 with a comment pointing at #385, delete the design sub-branch. P-HIGH 30.0 *"Fabricated 'chore-issue' framing to split phase artifacts across PRs"* (score 30) had already cataloged four recurrences of this same instinct — all Phase 13 retros split off. I extended the pattern to a new phase boundary (spec → RFC) without firing the memory.

## What was learned

When a project rule has been corrected on `main` and the feature branch was cut before the correction merged, the locally-checked-out rule text is stale — rebase the feature branch onto main BEFORE making any structurally load-bearing decision based on rule wording, so the corrected version (not the old misread-magnet) is the one being consulted.

## What the agent should have done

Four concrete behaviors, in order:

1. **At session start of any phase that will make a structural decision** (open a PR, name a branch, choose a worktree layout, decide whether to split artifacts), `git fetch origin && git log origin/main..HEAD -- fraim/personalized-employee/rules/project_rules.md` to see if the rule file has moved on main since the feature branch was cut. If yes, rebase onto main before doing the work. The cost is ~30 seconds; the cost of mis-applying a stale rule is a force-push + a PR cleanup cycle + erosion of trust.

2. **Read Rule 26 (and any rule cited as load-bearing for a structural choice) end-to-end before quoting it** — not just the bullet that matches my instinct. In Rule 26 specifically, the *"one issue spans spec → RFC → impl → Phase 13"* line and the `work-completion` merge-cycle paragraph were both contextual reads that resolved the ambiguity in the headline phrasing. I quoted only the ambiguous bullet and locked in my reading from that.

3. **When the P-HIGH 30.0 *"Fabricated 'chore-issue' framing"* memory enumerates a pattern, generalize it forward** — not just to the surfaces named in its examples (Phase 13 retros, coaching-moment captures). The pattern is "I want a clean diff so I'll split into a sub-PR"; the four cataloged surfaces (retros, coaching moments, post-merge regressions handled inline, ops artifacts) are examples, not the full domain. The next misuse will always be at a *new* phase boundary that the memory's examples didn't name explicitly. When my instinct says "this artifact deserves its own PR," the memory should fire and demand I quote the *current* rule wording verbatim from `main` before acting.

4. **When the user says "we just had the discussion," that is an instruction to look up the prior correction before responding** — they are pointing at a known precedent (here: #404 / #406) that I should already have on my desk. Asking "what discussion?" or proceeding from the in-session context would have wasted their time; running `gh issue list --search "rule 26"` or `git log main -- fraim/personalized-employee/rules/project_rules.md` is the right immediate move.

The umbrella rule: **a project rule fix that merged hours ago is on `main`; my feature branch's checkout is stale; rebase first, then read, then decide.** Without that sequencing, every fix to the project rules has a window in which it can be re-violated by every in-flight branch — exactly the failure shape the rule fix was authored to eliminate.
