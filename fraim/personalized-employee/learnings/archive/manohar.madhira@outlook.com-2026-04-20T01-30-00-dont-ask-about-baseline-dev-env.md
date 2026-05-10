---
author: manohar.madhira@outlook.com
date: 2026-04-20
context: issue-157 / feature-implementation
---

# Coaching Moment: dont-ask-about-baseline-dev-env

## What happened

When kicking off implementation, the agent asked the user whether the local DB and dev server were reachable for integration/E2E tests. The user pushed back: "You already know that there is a local dev environment and dev server. Why are you asking me?" — a fair correction. The repo's project rules (#11 validation commands, #11a tests-must-never-skip), CLAUDE.md testing-rules section, and the open `.env.example` file all establish that a local dev environment and dev server exist. Asking again wasted a turn and treated the user as a configuration source instead of consulting the documented baseline.

## What was learned

In a project whose CLAUDE.md / project_rules / `.env.example` already establish a baseline dev environment, treat that baseline as given. Do not ask the user to re-confirm what the repo documentation already states.

## What the agent should have done

Before asking any setup question, check whether the repo's documentation already answers it:
1. CLAUDE.md test commands (`pnpm test:integration`, `pnpm test:e2e`) imply DB and dev server are part of the standard local environment.
2. `project_rules.md` rule #11 enumerates the four validation commands and rule #11a confirms tests fail (don't skip) when their dependencies are missing — meaning the dependencies are expected to be present in the contributor's environment.
3. `.env.example` exists with `DATABASE_URL` and similar placeholders — another signal that local dev runs against a real DB.

When all three signals point the same direction, just proceed and write the tests. If they later fail because the contributor's environment is misconfigured, that is the contributor's signal to fix their environment — not the agent's signal to have asked first.
