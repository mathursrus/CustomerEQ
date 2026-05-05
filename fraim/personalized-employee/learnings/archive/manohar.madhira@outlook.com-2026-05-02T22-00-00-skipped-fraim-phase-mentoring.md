---
author: manohar.madhira@outlook.com
date: 2026-05-02
context: issue-255 / feature-implementation
---

# Coaching Moment: skipped-fraim-phase-mentoring

## What happened

For issue #255 (a CI bug fix — `Validate Prisma schema` step missing `DATABASE_URL`), the agent did the upfront FRAIM discovery (read `project_rules.md`, called `fraim_connect`, `list_fraim_jobs`, `get_fraim_job` for `feature-implementation`) but then skipped straight from "I have the plan" to "file issue → branch → fix → push → PR → merge" without calling `seekMentoring` between phases. The user corrected with: "Make sure your following FRAIM." The fix shipped and worked, but the per-phase mentoring loop the job explicitly defines (13 phases, each with `seekMentoring` at transitions, and durable evidence docs at scoping/code/submission) was not executed in real time. After the correction the agent walked the phases retrospectively and was honest about which evidence artifacts were missing (`docs/evidence/255-implement-work-list.md`, `docs/evidence/255-feature-implementation-evidence.md`).

## What was learned

FRAIM discovery (connect / list / get_job) is the *prelude* to a phased job, not the job itself — the actual execution is the `seekMentoring` loop, and skipping it forfeits both the phase guidance and the durable evidence trail, even on small fixes.

## What the agent should have done

After `get_fraim_job` returned the 13-phase outline, immediately called `seekMentoring(currentPhase: "starting", status: "starting")` to enter the loop, then transitioned phase-by-phase as work was actually being done — creating `docs/evidence/255-implement-work-list.md` during scoping, the implementation evidence doc during submission, and reporting `complete` at each phase boundary. For trivial CI/IaC fixes where this feels heavyweight, the right move is still to enter the loop and let the mentor confirm a lightweight evidence form is acceptable for the phase, rather than to bypass the loop unilaterally.
