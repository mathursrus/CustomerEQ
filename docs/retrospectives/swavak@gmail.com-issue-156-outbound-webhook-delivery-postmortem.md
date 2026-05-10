---
author: swavak@gmail.com
date: 2026-04-21
synthesized: 2026-05-08
---

# Postmortem: Outbound Webhook Delivery for Alert Events - Issue #156

**Date**: 2026-04-21
**Duration**: Single session
**Objective**: Produce a technical design (RFC) for an outbound webhook delivery system that fires signed JSON payloads to customer-configured endpoints on case lifecycle events.
**Outcome**: Success — RFC approved after 1 round of feedback. PR #159 open and ready for implementation.

## Executive Summary

Technical design completed for the outbound webhook delivery feature. The RFC covers two new Prisma models, a new BullMQ queue, a repeating SLA breach checker, HMAC-SHA256 signing, admin UI, and a 15-row traceability matrix with all requirements met. One round of feedback resolved: credential encryption was elevated from a deferred TODO to a hard pre-onboarding gate, and the architecture doc was updated accordingly.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/architecture.md` §6 (Design Patterns)
**Changes Made**: Added "Credential Encryption at Rest" pattern entry and expanded the "Signature-Verified Webhooks" entry to cover the outbound signing pattern.
**Rationale**: The RFC introduced two patterns not previously documented — outbound webhook signing and a hard gate for credential encryption at rest. The architecture doc needed to reflect both before implementation begins.
**Updated in PR**: Yes — committed in the feedback-address round on branch `feature/issue-156-outbound-webhook-delivery`.

## Timeline of Events

### Phase 1: Requirements Analysis
- ✅ **Loaded context**: Read `alertEvaluation.ts`, `cases.ts`, `schema.prisma`, architecture doc
- ✅ **Confirmed `slaBreachedAt` column already exists** on `CaseFollowUp` — no new column needed for overdue dedup
- ✅ **Filed GitHub issue #156** with full acceptance criteria before starting design

### Phase 2: Design Authoring
- ✅ **Wrote RFC** `docs/rfcs/156-outbound-webhook-delivery.md` — data models, API, payload shape, signing, worker, admin UI, risks, validation plan, test matrix
- ✅ **No spike needed** — all technology (BullMQ, HMAC, Fastify, Prisma) proven in codebase

### Phase 3: Architecture Gap Review
- ✅ **Identified 4 gaps** — outbound delivery flow, BullMQ repeating jobs, credential encryption, route table entry
- ✅ **Documented in RFC** under Architecture Analysis section

### Phase 4: Design Completeness
- ✅ **Traceability matrix: 15/15 met** — no unmet rows

### Phase 5: Submission + Feedback
- ✅ **PR #159 created**, comment posted
- ✅ **Round 1 feedback**: "update documentation and mark gap #3 for completion before customer onboarding"
- ✅ **Addressed**: RFC risks and architecture doc both updated to make credential encryption a hard gate

## Root Cause Analysis

### 1. Primary Cause (of feedback round)
**Problem**: Gap #3 (credential encryption) was initially framed as a "for MVP, store plaintext with a TODO" — a soft deferral. This was not strong enough given the security implications of exposed webhook secrets.
**Impact**: Required one feedback round to correct. Easily resolved but could have been caught at design time.

### 2. Contributing Factors
**Problem**: No explicit project policy existed for when a security dependency (like #53) is a hard gate vs. a follow-on. The framing defaulted to lenient.
**Impact**: Led to the under-specification of the risk. Now documented in the architecture doc to prevent recurrence on future features that store sensitive credentials.

## What Went Wrong

1. **Credential encryption framed as deferred**: The initial RFC said "for MVP, store in plaintext with a TODO" — appropriate for internal dev but not for customer-facing readiness. The right framing was always "hard gate before onboarding."

## What Went Right

1. **Jumped straight to technical design**: No feature spec was needed — product discussion provided sufficient clarity. This saved time without sacrificing quality.
2. **`slaBreachedAt` confirmed before designing**: Grepping the schema before designing the overdue dedup mechanism caught that the column already existed — avoided proposing a redundant migration.
3. **BullMQ repeating job for `case.overdue`**: Correctly identified that SLA breach detection needed a proactive repeating job rather than relying on read-time computation, which would be unreliable.
4. **Related issues surfaced upfront**: Issues #51, #45, and #53 were identified before writing the RFC — shaped the design (credential encryption dependency, downstream Zendesk integration path).

## What I Almost Did Wrong But Caught

1. **Proposing a `slaBreachedAt` column that already exists**: Before writing the RFC I grepped the schema and found it was already there. Had I not checked, the migration would have conflicted.
2. **Route naming ambiguity**: Nearly used `/v1/integrations/webhooks` for the outbound endpoints (matching the inbound pattern). Caught that these are semantically distinct resources and used `/v1/webhooks` instead, flagging the naming difference as a documentation gap.

## Where Past Learnings Actually Fired

1. **"Read codebase before designing"** — Read `alertEvaluation.ts` and `cases.ts` to confirm exact hook points before specifying them in the RFC. This prevented speculative hook placement.
2. **"Check branch scope before committing"** — Only staged the two new files (`docs/rfcs/`, `docs/evidence/`) when committing, leaving pre-existing modified files (from other issues) unstaged.

## Lessons Learned

1. **Security dependencies on credential storage are always hard gates before customer onboarding** — never frame them as "deferred TODOs for MVP." Any field that, if leaked, gives an attacker access to a customer's external system is a pre-onboarding gate by definition.
2. **When introducing a new pattern, update the architecture doc in the same PR** — outbound webhook delivery and the BullMQ repeating job pattern were both new; the arch doc update should have been in the initial commit, not the feedback round.

## Agent Rule Updates Made to Avoid Recurrence

1. **Credential storage = pre-onboarding gate**: When designing a feature that stores webhook URLs, API tokens, or signing secrets, classify credential encryption as a hard gate in the risks table by default — not a deferred TODO.
2. **Architecture doc update in initial RFC commit**: If an RFC introduces a pattern not yet in the architecture doc, add the arch doc update to the same commit as the RFC — not as a feedback-round fix.

## Enforcement Updates Made to Avoid Recurrence

1. **Add "credential fields?" check to architecture gap review**: When reviewing an RFC, explicitly check whether any new model fields store sensitive external credentials — if yes, verify the risks table classifies encryption as a pre-onboarding hard gate.
