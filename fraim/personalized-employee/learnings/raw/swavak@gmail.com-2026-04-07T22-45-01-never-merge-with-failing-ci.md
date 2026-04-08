---
author: swavak@gmail.com
date: 2026-04-07
context: issue-79
---

# Coaching Moment: never-merge-with-failing-ci

## What happened

PR #112 (feat(#79)) was merged to main even though the CI "Build, Lint, Test" check had failed. The failure was a TypeScript error — `WINDOW_DAYS` was a stale reference left over from a rename during the implement-quality phase. Because the merge went through with red CI, the broken code reached main, the Azure deploy pipeline failed, and the live site never picked up the #79 feature. The user noticed the feature was missing from production and the agent had to diagnose the broken deploy pipeline and ship a follow-up fix.

## What was learned

A failing CI build is a hard gate — never merge a PR when the build check is red, regardless of how minor the suspected cause.

## What the agent should have done

Before merging PR #112, check the CI status. On seeing the build failure, fix the TypeScript error first, push the fix to the branch, wait for CI to go green, then merge.
