---
author: sid.mathur@gmail.com
date: 2026-03-24
synthesized:
---

# Postmortem: Technical Design — MVP Loyalty Platform — Issue #23

**Date**: 2026-03-24
**Duration**: Single session
**Objective**: Produce a complete technical RFC for the full CustomerEQ MVP (Phase 0 + issues #2–#9) covering data models, API contracts, queue architecture, webhook ingestion, analytics, frontend structure, test infrastructure, and CI — before any implementation begins.
**Outcome**: Success — RFC approved, no feedback rounds

## Executive Summary

Produced an 861-line technical RFC covering 9 architecture sections for all feature areas of the CustomerEQ MVP. The RFC resolves all 5 pre-identified ambiguities without requiring a spike, achieves 92/100 confidence, and maps every requirement (R0.x–R9.x) to a concrete implementation section. Approved in a single round with zero feedback.

## Architectural Impact

**Has Architectural Impact**: No

The RFC consumed the approved architecture document as input. No architectural decisions were changed or overridden during this design phase. Implementation decisions that differ from the RFC should generate an ADR in `docs/architecture/adr/`.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Action**: Read feature spec (`docs/feature-specs/23-mvp-loyalty-platform.md`) — all 35 requirements and 9 feature areas catalogued
- ✅ **Action**: Read architecture doc, data models (13 entities), use cases (20 UCs), project rules in parallel
- ✅ **Action**: Identified compliance controls C-01–C-05 (GDPR/CCPA) and S-01–S-04 (SOC2) requiring explicit RFC coverage

### Phase 2: design-authoring
- ✅ **Action**: Wrote §0 Monorepo Structure — Turborepo + pnpm workspace package layout + turbo.json pipeline
- ✅ **Action**: Wrote §1 Data Models — 11 Prisma models with index rationale per requirement
- ✅ **Action**: Wrote §2 API Endpoints — 19-route table with Fastify plugin architecture, event ingestion flow, redemption transaction
- ✅ **Action**: Wrote §3 BullMQ Queue Architecture — 3 queues, campaign trigger processor with dedup + budget cap + SLA measurement
- ✅ **Action**: Wrote §4 Prisma Middleware — `$extends`-based tenant scope enforcing brandId on all scoped models
- ✅ **Action**: Wrote §5 Webhook Ingestion — HMAC verification for Salesforce + HubSpot, payload normalizers
- ✅ **Action**: Wrote §6 Analytics Queries — raw SQL with composite index, ROI formula
- ✅ **Action**: Wrote §7 Frontend Structure — Next.js 15 App Router route groups + Clerk middleware
- ✅ **Action**: Wrote §8 Shared Test Infrastructure — 7 factories, 5 mocks, DB setup, helpers in `@customerEQ/config/test-utils`
- ✅ **Action**: Wrote §9 CI Pipeline — GitHub Actions with real Postgres 16 + Redis 7 services

### Phase 3: technical-spike
- ✅ **Action**: Assessed all 5 ambiguities — no spike required; all resolved via documentation review
- ✅ **Action**: Confirmed `$extends` over `$use` (Prisma 5+ deprecation), BullMQ priority direction (higher = sooner), HMAC format for both providers

### Phase 4: architecture-gap-review
- ✅ **Action**: Verified all 35 R-tags mapped to RFC sections in traceability matrix
- ✅ **Action**: Confirmed SLA measurement mechanism — `CampaignEvent.latencyMs = Date.now() - eventIngestedAt`
- ✅ **Action**: Added §Observability with 5 alert thresholds and DLQ strategy (missing from initial draft)

### Phase 5: design-completeness-review
- ✅ **Action**: Validated validation plan covers all 13 user scenarios end-to-end
- ✅ **Action**: Confirmed test matrix covers unit (7 files) + integration (8 files) + E2E (2 files)
- ✅ **Action**: Verified 7 risks documented with mitigations

### Phase 6: design-submission
- ✅ **Action**: Created evidence document `docs/evidence/23-design-evidence.md` with full traceability matrix
- ✅ **Action**: Committed and pushed 2 files to feature branch (commit 9ff049b)
- ✅ **Action**: Added PR comment to PR #25 with RFC summary

### Phase 7: address-feedback
- ✅ **Action**: PR approved with zero feedback rounds

## Root Cause Analysis

### 1. **Missing Observability Section in Initial Draft**
**Problem**: Initial RFC draft omitted structured logging format, alert thresholds, and DLQ strategy. These were added during architecture-gap-review.
**Impact**: Minor — caught before submission. Added §Observability covering Pino log schema, 5 Azure Application Insights alert thresholds, and nightly DLQ cron.
**Root Cause**: Observability is often treated as an implementation detail rather than a design decision. For an event-driven system with SLA commitments, observability needs to be designed upfront — especially the latency alert threshold (5 min = early warning at 1/3 of the 15-min SLA).

### 2. **Context Continuation After Compaction**
**Problem**: The previous session hit context limits mid-job. On resume, had to reconstruct job state from git log, file reads, and FRAIM seekMentoring.
**Impact**: Minor — recovery took ~3 tool calls. No work was lost; RFC was complete and correct.
**Root Cause**: Long single-session jobs (requirements-analysis through design-completeness-review in one pass) risk hitting context limits. The resume pattern (read git log → read RFC → connect FRAIM → call seekMentoring with starting status) is effective but not automatic.

## What Went Wrong

1. **Observability deferred from initial draft**: Should be a default section for any event-driven system with SLA requirements. Was caught in gap-review but adds one extra revision pass.
2. **Session compaction during job execution**: No work lost, but the cold-start resume added overhead. For very long design jobs, intermediate commits may help preserve state signals in git history.

## What Went Right

1. **Parallel document reads in requirements-analysis**: Reading spec, architecture, data models, use cases, and project rules simultaneously collapsed what could be 5 sequential reads into one round.
2. **No spike required**: All 5 ambiguities (Clerk JWT, BullMQ priority, Prisma `$extends`, Salesforce HMAC, HubSpot HMAC) were resolved via documentation review. Pre-approved tech stack pays off at design time.
3. **SLA mechanism made concrete**: `CampaignEvent.latencyMs = Date.now() - eventIngestedAt` is a testable, recordable number — not just a design assertion. The integration test can assert `latencyMs < 900_000` against a real BullMQ worker.
4. **Tenant scope via Prisma `$extends`**: Centralizing brandId enforcement in middleware rather than per-route means tenant leakage is impossible at the ORM level, not just at the API level.
5. **Test infrastructure as a package**: Putting factories, mocks, and DB setup in `packages/config/src/test-utils` means all apps share the same test primitives — no duplicated setup or inconsistent factories.
6. **Confidence score with residual breakdown**: A 92/100 score with explicit residual uncertainty (Clerk org edge cases, Salesforce payload variability) gives reviewers a calibrated signal rather than vague "high confidence."
7. **Zero feedback rounds**: RFC approved without revision — indicates requirements were fully addressed and design choices were well-reasoned.

## Lessons Learned

1. **Observability is a design artifact, not an implementation detail**: For any event-driven system with SLA commitments, include structured log schema, alert thresholds, and DLQ strategy in the RFC by default — not as a gap-review addition.
2. **Design confidence scores should be explicit and justified**: A numbered score (92/100) with a residual uncertainty breakdown is more useful to reviewers than narrative confidence language.
3. **Pre-approved tech stacks eliminate spike overhead**: All 5 ambiguities resolved without spikes because the architecture doc pre-approved the stack and patterns. Maintaining a live architecture doc with patterns pays consistent dividends.
4. **Session state can be recovered from git log + FRAIM seekMentoring**: On context compaction, the recovery sequence (git log → read artifact → fraim_connect → seekMentoring starting) reliably reconstructs job position.
5. **Shared test infrastructure package should be designed in the RFC**: Deferring test infrastructure design to implementation creates divergence between apps. Specifying `@customerEQ/config/test-utils` structure in the RFC ensures consistent test patterns from day one.

## Agent Rule Updates Made to avoid recurrence

1. **Observability-default rule for event-driven RFCs**: When writing an RFC for any event-driven or queue-based system, include an §Observability section as a required default (not optional). Section must cover: structured log schema, key alert thresholds with values, and DLQ/dead-letter handling strategy.
2. **SLA testability rule**: Any SLA requirement in the spec must be reflected in the RFC with a concrete measurement mechanism (field name, calculation, and integration test assertion) — not just a design note.

## Enforcement Updates Made to avoid recurrence

1. **RFC completeness checklist item — Observability**: Add to design-completeness-review: "Does the system use queues, events, or async processing? If yes, confirm §Observability section exists with log schema + alert thresholds + DLQ strategy."
2. **Context compaction recovery protocol**: Document that on session resume after compaction, the correct recovery sequence is: (1) `git log` to find last commit, (2) read key artifact, (3) `fraim_connect`, (4) `seekMentoring` with `status: "starting"` on the likely current phase.
