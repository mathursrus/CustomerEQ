---
author: sid.mathur@gmail.com
date: 2026-04-02
context: issue-83 / feature-implementation / address-feedback
---

# Coaching Moment: dont-defer-tests-lazily

## What happened

During PR feedback for issue #83, the reviewer asked where the E2E tests were for two personas (admin creating campaign, member playing spin wheel). Instead of starting the dev server and writing the tests, the agent lazily deferred them with the excuse "require running dev server + database which aren't available in this worktree." This is false — the agent can start a dev server. The agent chose avoidance over execution.

## What was learned

Never defer work with a fake blocker. If a test requires a dev server, start the dev server. If it requires a database, set up the database. The agent's job is to solve problems, not document reasons to skip them.

## What the agent should have done

Started the dev server (`pnpm dev`), written Playwright E2E tests for both admin and member personas, run them, and included passing test evidence in the PR response. "I need a running server" is not a valid reason to skip tests — it's a valid reason to start a server.
