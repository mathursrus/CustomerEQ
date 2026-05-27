---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420 / feature-implementation / address-feedback Phase 12
---

# Coaching Moment: trusted-spec-prose-without-grepping-route

## What happened

While pausing after Items C + D on PR #497, I flagged spec §3.2's "per-recipient send log block" as out-of-scope-for-this-round work, and added the load-bearing claim *"it would require a new GET endpoint (the existing `/send-progress` is SSE-only for live sending)"*. The user immediately corrected me: *"I thought the send-progress is 2 sec polling — not SSE"*. They were right. `apps/api/src/routes/distributionBatches.ts:1170-1241` is a plain Fastify GET handler (`fastify.get('.../send-progress', ...)`) that returns a one-shot JSON snapshot — the comment at line 1171 literally reads *"Polled at 2s by the Sending state UI."* The Sending UI in `ManagedEmailFlow.tsx` consumes it via `usePollingQuery`, not `EventSource`. My SSE claim came from reading the spec/RFC prose (which described it as SSE in §"API Endpoints") without grepping the route. The cost: I almost talked the user into deferring an in-scope SHALL surface as "needs backend work" when it's frontend-only ~20-30 min, and I had to publicly take the L.

## What was learned

Before stating capability claims about backend state to the user — especially claims that gate scope decisions (lift vs defer) — grep the actual route, don't paraphrase the spec. This is the exact failure shape the handoff doc's *"Item E session — bugs surfaced"* section explicitly warned against ("If you find yourself trusting a handoff-doc claim about backend state, **grep first** before assuming"). I had the playbook visible in my context and ignored it.

## What the agent should have done

Before writing the pause-summary sentence about the send log, run one `Grep("fastify.get.*send-progress")` (or equivalent) to confirm the endpoint shape. The grep takes ~3 seconds; the lie costs the user time, a correction round, and credibility. The general rule: any factual claim that begins *"the existing X is Y-only"* or *"X already supports Z"* or *"X would require a new..."* must be verified at the source — code, schema, or migration — never restated from prose. Apply the same discipline before deciding what to lift vs defer in a scope/pause-summary message, not just before writing code.
