---
reviewContext:
  subjectType: repository
  subjectLabel: CustomerEQ
  reviewRef: fraim-review-2026-04-28
  scopeSummary: FRAIM code-quality review of the CustomerEQ monorepo covering build and type gates, architectural duplication, maintainability hotspots, and configuration hygiene.
  repoIdentifier: github.com/mathursrus/CustomerEQ
  branchRef: main
  sourceInventory:
    - apps/api/src/queues/bullmq.ts
    - apps/api/src/routes/public.ts
    - apps/api/src/routes/surveys.ts
    - apps/worker/src/processors/webhookDelivery.ts
    - apps/web/src/app/api/mcp/route.ts
quality:
  composite: 5.8
  grade: C
  dimensions:
    typeSafety:
      score: 8.0
      rationale: TypeScript coverage is active and the monorepo typecheck passes, but the code still uses targeted `any` escapes and broad value casting in key request paths.
    errorHandling:
      score: 5.6
      rationale: The code generally catches and logs async queue failures, but failure handling is uneven and low-level adapter code still leans on permissive escape hatches rather than explicit control paths.
    architecture:
      score: 3.8
      rationale: Core workflows are implemented in parallel API and worker codepaths, creating multiple sources of truth for the same behavior.
    maintainability:
      score: 4.9
      rationale: Several modules are oversized enough to slow review and make safe change isolation difficult, even though basic build and lint gates pass.
  coaching: Extract the duplicated survey submission and queue processor logic into shared domain services so both API and worker execution paths call one source of truth.
---

# Code Quality Report

## Executive Summary

CustomerEQ currently earns an overall **C** for code quality. The operational gates checked during this review are mostly healthy after dependency synchronization: `pnpm build`, `pnpm typecheck`, and `pnpm lint` all complete successfully, with lint reporting six warnings in the web package. The limiting factor is maintainability rather than basic correctness.

The strongest negative pattern is duplicated execution logic across API fast paths and worker processors. Survey submission, webhook delivery, feedback clustering, loyalty event processing, and campaign trigger evaluation are each implemented in more than one place. That duplication has already produced oversized files, inconsistent helper behavior, and a larger review surface for every change.

## Review Context

This report follows the FRAIM `code-quality-assessment` job on April 28, 2026. The FRAIM scripted evaluator was invoked from Windows via `pnpm dlx tsx ~/.fraim/scripts/evaluate-code-quality.ts`, but its downstream shell helper failed with a Bash syntax error, so build, type, lint, and deep code inspection findings were collected manually for the final report.

Repository state reviewed:
- Branch: `main`
- Build gate: `pnpm build` passed
- Type gate: `pnpm typecheck` passed
- Lint gate: `pnpm lint` passed with six warnings

## Dimension Scorecard

| Dimension | Score | Rationale |
| --- | --- | --- |
| Type Safety | B | `pnpm typecheck` passes across the monorepo, which indicates the current TS surface is coherent. Quality is held back by repeated `any` escapes in [`apps/web/src/app/api/mcp/route.ts`](../../apps/web/src/app/api/mcp/route.ts) and broad JSON/value casting in route handlers. |
| Linting & Style | B- | `pnpm lint` passes, but the web package still carries five `no-explicit-any` warnings in the MCP route and one stale `eslint-disable` in `LoopMonitor.tsx`. The codebase is enforcing style, but not closing the loop on avoidable exceptions. |
| Architecture Alignment | D | Core workflows are duplicated across route handlers, inline queue implementations, and worker processors instead of being expressed once and reused. That weakens separation of concerns and makes behavior drift likely during feature work. |
| Maintainability | D | Several files are beyond normal reviewable size, including `analytics.ts` (1388 lines), `bullmq.ts` (1062 lines), and the admin integrations page (992 lines). Those modules combine unrelated responsibilities and materially slow safe modification. |
| Configuration Hygiene | C- | Important operational defaults still live in route and processor modules, including public API base URLs, cooldown windows, and wildcard CORS behavior. These are manageable today but raise the cost of environment changes and policy hardening. |

## Evidence Highlights

1. **Duplicated survey submission pipeline**
   [`apps/api/src/routes/public.ts`](../../apps/api/src/routes/public.ts) lines 194-345 and [`apps/api/src/routes/surveys.ts`](../../apps/api/src/routes/surveys.ts) lines 226-344 both implement event mapping, response persistence, incentive events, sentiment enqueuing, promoter logic, and alert evaluation. The public and authenticated paths should share one orchestration layer.

2. **Duplicated campaign trigger predicate**
   [`apps/api/src/routes/events.ts`](../../apps/api/src/routes/events.ts) lines 6-47 and [`apps/worker/src/processors/campaignTriggers.ts`](../../apps/worker/src/processors/campaignTriggers.ts) lines 13-58 each define `evaluateTriggerCondition`. The implementations are similar but not identical, which means future rule changes can diverge by execution path.

3. **Duplicated queue processor implementations**
   [`apps/api/src/queues/bullmq.ts`](../../apps/api/src/queues/bullmq.ts) contains inline implementations for loyalty events (lines 122-176), feedback clustering (lines 276-369), and webhook delivery (lines 1006-1050), while equivalent worker processors live under `apps/worker/src/processors/`. This is the clearest sign of architecture drift in the repo.

4. **Oversized review hotspots**
   The largest files reviewed were `apps/api/src/routes/analytics.ts` (1388 lines), `apps/api/src/queues/bullmq.ts` (1062 lines), `apps/web/src/app/(admin)/admin/integrations/page.tsx` (992 lines), `apps/api/src/routes/public.ts` (623 lines), and `apps/api/src/routes/surveys.ts` (588 lines). These sizes are high enough that defects are more likely to survive review.

5. **Hardcoded operational values**
   [`apps/api/src/routes/public.ts`](../../apps/api/src/routes/public.ts) lines 8-9 default `API_BASE_URL` inside the route layer, [`apps/worker/src/processors/loyaltyEvents.ts`](../../apps/worker/src/processors/loyaltyEvents.ts) lines 26-27 hardcode a 30-day cooldown and localhost base URL fallback, and [`apps/api/src/auth/clerk-identity-provider.ts`](../../apps/api/src/auth/clerk-identity-provider.ts) line 48 hardcodes the Clerk frontend endpoint. These should live in centralized configuration or shared constants.

6. **Lint debt concentrated in MCP route**
   [`apps/web/src/app/api/mcp/route.ts`](../../apps/web/src/app/api/mcp/route.ts) line 23 sets wildcard CORS, and lines 109-118 use repeated `any` casts to reach low-level MCP server internals. This passed lint only as warnings, but it is a concentrated quality and future-maintenance risk.

## Top Gaps / Risks

1. The same business logic exists in more than one runtime path, so bug fixes and product changes can silently land in only one of them.
2. Large multi-responsibility files reduce review quality and increase regression risk whenever queue, analytics, or survey behavior changes.
3. Route-layer and processor-layer hardcoded defaults make environment behavior less explicit and harder to audit.
4. The FRAIM automated code-quality helper is not currently Windows-compatible, which reduces repeatability for local review runs on this machine.

## Coaching Plan

1. Extract one shared domain service for survey response submission and make both `public.ts` and `surveys.ts` call it.
2. Move `evaluateTriggerCondition` into a shared package and import it from both the API and worker runtimes.
3. Choose one source of truth for queue job behavior: either call worker processors from the API fast path through shared helpers or remove the inline queue implementations from `bullmq.ts`.
4. Break `analytics.ts`, `bullmq.ts`, and the integrations admin page into narrower modules with explicit boundaries by feature.
5. Centralize operational constants and environment defaults in shared configuration rather than embedding them inside route and processor files.
6. Replace the `any` escape hatch in the web MCP route with typed adapter code or a constrained wrapper around the low-level server.

## Source Inventory

- `apps/api/src/queues/bullmq.ts`
- `apps/api/src/routes/public.ts`
- `apps/api/src/routes/surveys.ts`
- `apps/worker/src/processors/webhookDelivery.ts`
- `apps/web/src/app/api/mcp/route.ts`
