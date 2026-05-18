---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: next-build-against-running-dev-corrupts-cache

## What happened

Twice during Phase 12 walkthrough I ran `pnpm --filter @customerEQ/web build` for production validation (per L1 `feedback_validate_phase_must_run_build`) while `pnpm dev` was still running. Both times the dev server then served stale chunks on the next user navigation. The visible failure was a runtime ENOENT: *"Cannot find module './vendor-chunks/@clerk+shared@3.47.5_react-dom@18.3.1_react@18.3.1__react@18.3.1.js'"* with a stack pointing into `apps/web/.next/server/app/survey/[id]/r/[token]/page.js`. Root cause: `next build` (production) and `next dev` (development) share the same `apps/web/.next/` output directory. Running production build replaces dev's compiled vendor chunks with production-shaped ones whose hashes don't match what the dev server has loaded into memory. The recovery was the same each time: stop dev → wipe `apps/web/.next` → restart dev. Cost: ~10 minutes total user-test wait time across two cycles. The L1 rule that drove the misstep was `feedback_validate_phase_must_run_build` — which is correct *as a validation discipline* but doesn't say *when* to run the build. The intent is "before declaring done" — not "during user testing while dev is hot-reloading."

## What was learned

**Never run `next build` against the `.next/` directory of a running `next dev` server.** Either stop dev first, or use a separate output directory (`next build --output-dir .next-prod` if supported, or run the build in an isolated worktree). Validate-via-prod-build is a fine discipline only when it doesn't corrupt the dev server's chunk graph.

## What the agent should have done

1. **Before running `pnpm --filter @customerEQ/web build`**, check whether `pnpm dev` is currently running (any background task ID for `pnpm dev` is active, or any node process listens on the dev ports 3000/3002/4000). If yes, either:
   - Stop dev first, run build, then restart dev cleanly afterwards (heavyweight but safe), OR
   - Run the build in an isolated worktree (`git worktree add /tmp/build-check <branch>; cd /tmp/build-check; pnpm install --offline; pnpm --filter @customerEQ/web build`) so the dev server's `.next/` is untouched (lightweight; preferred when iterating).

2. **In Phase 12 hold-points specifically**, defer the production build validation until after the user signals walkthrough complete — the build is for *pre-push* validation, not *during-walkthrough* validation. The user-test cycle wants dev to be hot, not the production build artifacts to be fresh.

3. **Cache invariant documented in the dev recovery playbook for future agents**: If `next dev` is serving stale vendor chunks (ENOENT on `vendor-chunks/*.js` files), the recovery is *always* stop-dev → rm `.next` → restart. Don't try to patch around it.

Net-new operational learning. Not a rule misfire — a tool-interaction gap. Marginal L1 promotion case; mostly worth recording so the next dev-stack recovery is faster.
