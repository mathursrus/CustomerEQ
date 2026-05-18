---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: rule-26-misread-in-self-written-handoff

## What happened

Second firing of the Rule 26 misread pattern in the same day. The first firing was captured at [[rule-26-misread-pr-per-phase-vs-per-issue]] (2026-05-17T15:45). This second firing happened because **my own prior-session handoff doc** at `docs/evidence/378-handoff-next-session.md` encoded Phase 13 as a post-merge step:

> "On 'merge': run `gh pr merge 385 --squash --delete-branch=false`, then the FRAIM `work-completion` job. Phase 13 retrospective per `feature-implementation` workflow → write to `docs/retrospectives/...`."

That sequence is wrong against L1 `feedback_one_pr_per_phase_artifact`, which says verbatim: *"Phase 13 retro + coaching-moment capture ride with parent issue's impl PR; never spawn a 'chore-issue' for them. Authoritative version is Rule 26."* And Rule 26 itself says verbatim: *"One PR for the whole issue, containing one commit per phase artifact as needed (spec, RFC, impl, evidence, retro, coaching-moment capture)... If a Phase 13 retro lands two days after the impl commit, it lands as another commit on the same `feature/{N}-...` branch and pushes to the same open PR. The PR closes (via `work-completion`) only after every phase artifact for the issue has landed on it."*

So Phase 13 lands **before** `work-completion` runs (work-completion is what merges and cleans up). My handoff doc inverted that ordering. When the resumed session reached the merge step, I followed the handoff doc rather than re-reading Rule 26. The user had to ask *"Don't you have to do the retrospective?"* to wake me up. The misfire shape is **trusting my own self-written prior summary over the authoritative project rule** — exactly the pattern called out in Rule 26's Priority Order clause 3: *"Unverified agent paraphrase of FRAIM — never authoritative."* My handoff doc is an unverified agent paraphrase of FRAIM; I treated it as authoritative.

## What was learned

**Self-written handoff docs / summaries / work-list pointers are agent paraphrases of FRAIM/project rules and cannot override the rule itself.** When resuming a session, the canonical sequence comes from re-fetching Rule 26 + `seekMentoring` for the next phase — not from the handoff doc's prose summary of what comes next. Handoff docs are *resumption pointers* (where am I in the workflow?) — not *workflow definitions*.

## What the agent should have done

1. **When writing the handoff doc** at the end of the prior session, quote Rule 26's "Phase 13 retro rides the parent PR" sentence verbatim and cite the file path (`fraim/personalized-employee/rules/project_rules.md`). Don't paraphrase the sequence — that's where the misread enters the loop.

2. **When resuming via the handoff doc**, before executing any phase-transition step, re-read the relevant rule from the original source (`fraim/personalized-employee/rules/project_rules.md` + `seekMentoring` for the next phase). The handoff doc tells me *what's pending*; the rule tells me *what to do*.

3. **When in doubt about phase ordering**, call `seekMentoring` with `status: "starting"` and let FRAIM tell me what comes next, rather than reading my own doc and acting on it.

Related L0 [[rule-26-misread-pr-per-phase-vs-per-issue]] (same pattern, 7h earlier, same issue). Two firings in one day means this needs L1 promotion with a concrete pre-merge checklist clause: *"before requesting merge, confirm Phase 13 retrospective + coaching-moment capture have landed on the same PR via `git log` on the feature branch; if Phase 13 has not run, run it before merge."*
