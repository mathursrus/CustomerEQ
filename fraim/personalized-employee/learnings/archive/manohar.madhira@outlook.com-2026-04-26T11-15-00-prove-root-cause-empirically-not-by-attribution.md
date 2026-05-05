---
author: manohar.madhira@outlook.com
date: 2026-04-26
context: issue-177
---

# Coaching Moment: prove-root-cause-empirically-not-by-attribution

## What happened

While working on issue #177 (Node 20 → 22 upgrade), CI failed on `packages/shared/src/random.test.ts:77` with `expected 0.0628 to be less than 0.06`. I diagnosed the failure as a "pre-existing flake" and attributed it to commit `dfcce3f` (Spin-the-Wheel feature, issue #83) — the commit that originally added the test file. I posted three resolution options to the PR with that framing and reported regression complete to FRAIM. The user pushed back: "I don't see how feature 83 which is a user facing random spinner should effect CI. Can you double check and ensure that you have identified the correct cause for CI step turning red?" When I actually investigated empirically (50 runs in the actual `node:22-slim` docker image, 50 runs locally on Node 24, plus reading 30+ prior CI runs all on Node 20 with zero failures), the data showed the test passes ~99.8% of runs across all Node versions and the failure rate is fully explained by the statistical bound: 6% tolerance for N=10000 4-way uniform is only ~3.46σ → ~0.2% expected failure rate per run, independent of Node version. My "feature #83 introduced this flake" framing conflated two facts: (1) the utility `selectWeightedRandom` was added at the same time as feature #83, and (2) the test for that utility now occasionally fails. Feature #83 didn't cause the failure; the assertion bound did. The utility is generic and used by `apps/worker/src/processors/campaignTriggers.ts`, not the spinner UI.

## What was learned

When diagnosing a CI failure, "this commit introduced the test" is not a root-cause analysis — empirical reproduction (run the test repeatedly under matching conditions and measure the failure rate) is the only way to distinguish flakiness from regression from environment-specific issue.

## What the agent should have done

Before posting "this is a pre-existing flake from feature #83" to the PR, I should have:
1. Read the implementation under test (`selectWeightedRandom` uses `crypto.randomInt`, not `Math.random` — already a clue that randomness source is stable across Node versions)
2. Run the failing test in a tight loop on the host AND inside the same Node version that CI uses (`node:22-slim` docker image), counting empirical failures
3. Computed the theoretical failure rate from the test's assertion bound and sample size
4. Compared empirical, theoretical, and CI history to identify the actual cause
5. Only then framed the user-visible message — citing the empirical evidence rather than commit-history attribution
