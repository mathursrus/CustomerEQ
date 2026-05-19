---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336
---

# Coaching Moment: copy-env-from-main-worktree

## What happened

At the start of the session the user asked me to start the local dev so they could manually test. I ran `pnpm dev` in the issue-336 worktree (alongside the main `CustomerEQ` checkout) and reported "Dev is up: web :3000, api :4000." When the user asked "Do we not need APIs and docker to be up? Is everything needed for testing up?", I went to verify and found that `apps/api` and `apps/worker` had crashed at startup with `Environment variable not found: DATABASE_URL` — `apps/api/.env` and `apps/web/.env` weren't present in this fresh git worktree (they're gitignored). The user replied: *"This is a consistent miss you make during prep. You need to copy those from the main worktree."* They had to point this out before any verification could begin, costing an avoidable round trip.

## What was learned

When the working directory is a git worktree alongside a primary checkout (e.g. `CustomerEQ - Issue 336` next to `CustomerEQ`), the gitignored `.env` files (root `.env`, `apps/*/.env`, `apps/*/.env.local`) live only in the primary checkout and are missing in the fresh worktree. Starting `pnpm dev` without copying them produces a "looks healthy" output (web binds :3000) while the API and worker silently fail on database init — the first API call surfaces the failure but the dev startup log doesn't.

## What the agent should have done

As part of "start local dev in a worktree" prep, before running `pnpm dev`:

1. Detect the main worktree path with `git worktree list`.
2. For each `.env` / `.env.local` that exists in the main worktree under root and `apps/*/`, copy it into the current worktree at the same path.
3. Don't fall back to `.env.example` — it lacks the locally-configured Clerk keys and other secrets the user has set up in main.
4. Only then start `pnpm dev`, and verify `apps/api` doesn't log `Fatal error during startup` before declaring the server ready.
