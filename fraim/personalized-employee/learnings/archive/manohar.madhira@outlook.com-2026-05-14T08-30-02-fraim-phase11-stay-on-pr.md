---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336
---

# Coaching Moment: fraim-phase11-stay-on-pr

## What happened

After the user listed seven categories of defects + two runtime errors during Phase 11 manual verification of PR #364, I proposed splitting the fixes into three sequential PRs: "PR A: crashes + tab-state-loss + type-change guard. PR B: Questions tab Survey-Builder parity. PR C: Look & Feel preview polish + Draft/Paused differentiation. Confirm order, or tell me to merge B into A." The user corrected: *"Why different PRs - these are problems on an existing code we are working. Looks like you have missed the context again - we are in FRAIM feature implement Phase 11 - PR review. Since this is UX related I am doing manual verification as well. So you should correct and fix on the same PR, unless we discover issues unrelated to issue 336 we are working on."* I had treated each defect as if it were new scope warranting its own PR, instead of recognising them as defects on the in-flight PR's slice.

## What was learned

During FRAIM Phase 11 (`implement-submission`) or Phase 12 (`address-feedback`) manual verification on an open PR, every defect the reviewer surfaces is part of that PR's review cycle — fix on the same branch, push to the same PR. Splitting forces serial re-review and re-merge, leaves intermediate broken states on a branch already under review, and signals that the agent doesn't understand which FRAIM phase the work is in.

## What the agent should have done

Before responding to multi-item feedback on an open PR, read the most recent commit messages (`git log -5 --oneline`) to confirm the FRAIM phase (commits use `docs(#N): Phase X ...` style on this repo). When in Phase 11 / 12, present the response as *order of operations within this PR* — not *PRs A / B / C*. Only propose a separate PR if the defect is clearly unrelated to the issue (e.g. while verifying the survey editor the user spots an auth bug); even then, surface and ask before splitting. Restoring scope that should have been delivered ("you removed Survey-Builder capabilities") is not new scope — it's a gap in the existing PR.
