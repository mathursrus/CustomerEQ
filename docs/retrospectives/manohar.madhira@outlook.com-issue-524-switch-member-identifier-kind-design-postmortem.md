---
author: manohar.madhira@outlook.com
date: 2026-05-31
synthesized:
---

# Postmortem: Switch member identifier kind (CUSTOMER_ID→EMAIL, Slice 1) — technical-design — Issue #524

**Date**: 2026-05-31
**Duration**: ~1 design cycle (authoring + 1 review round + audit fixes)
**Objective**: Turn the approved spec (R0–R37) into an implementable RFC for re-keying a brand's loyalty members from CUSTOMER_ID to EMAIL, including schema, routes, worker, dual-key reads, reconciliation + grace, and breakage analysis.
**Outcome**: success — RFC approved after 1 review round; all feedback addressed (`docs/evidence/524-design-feedback.md`).

## Executive Summary

The RFC for Slice 1 was authored against the approved spec, reviewed in a single round, and approved. The most valuable work was not in the first draft: a reviewer question about which ingress paths break after migration forced a verified file:line audit of every member-touching path, which produced the §M ingress×lifecycle breakage matrix **and** surfaced 3 inaccurate claims + 1 missed edge case that were corrected across both the RFC and the spec. The design is sound, but the breakage analysis should have been in the first draft rather than reviewer-prompted.

## Quick RCA Card

**What failed**: The initial RFC documented the happy-path design (engine, schema, routes, worker, dual-key, reconciliation) but did not include a systematic "which paths break, and when across the migration lifecycle" analysis until the reviewer asked for it.
**Impact**: A review round was spent on coverage that, once done, also exposed 3 wrong claims (`/v1/events` treated as a cutover surface when it is migration-stable by internal id; `CLERK_OAUTH` enroll ingress documented but nonexistent; over-broad `MigrationOldKeyIngress` enum) and 1 missed edge case (new member registered with old id after grace). Had these shipped into implementation, they would have produced a wrong dual-key query on the hero `/v1/events` path and an unhandled post-grace ingress case.
**What should have happened**: For any contract/identifier migration, build the ingress×lifecycle matrix from a code audit *as part of design authoring*, before submission.
**What changes next time**: Treat "enumerate every ingress path, classify honors-kind / creates-member, then walk it across pre-migration / PROCESSING / grace / post-grace" as a required design-authoring step for migrations — codified in the coaching moment `build-ingress-by-phase-matrix-for-contract-migrations`.
**Example**: `/v1/events` resolves by internal `Member.id` cuid (`events.ts:96-97`), not the brand external id — so it must NOT receive the dual-key extra query the first draft implied.

## Architectural Impact

**Has Architectural Impact**: No

The RFC consumes existing architecture (Member identity model, ingress paths, worker pipeline) and adds a feature-scoped migration engine. No cross-cutting architectural pattern was introduced that needs `architecture.md` updates. The loyalty-vs-admin member distinction surfaced during review was captured as a durable reference memory rather than an architecture-doc change, because it documents existing reality, not a new decision.

## Timeline of Events

### Phase: design-authoring
- [done] **Action**: Authored RFC §A engine, §B schema, §C routes, §D worker, §E dual-key, §F/G reconciliation+grace (commit `6458b5a`).
- [missed] **Action**: Did not include an ingress×lifecycle breakage matrix in the first draft.

### Phase: architecture-gap-review / codebase audit
- [done] **Action**: Codebase audit found 3 bugs + 1 missed edge case; fixes applied (commit `e20df49`).

### Phase: address-feedback
- [done] **Action**: Added §M ingress coverage + breakage analysis; corrected `/v1/events` and `CLERK_OAUTH` claims in RFC and spec; scoped to loyalty members via R36 (commit `15a2159`).
- [done] **Action**: Backfilled Round 1 feedback commit SHA (commit `3c86613`).

## Root Cause Analysis

### 1. **Primary Cause**
**Problem**: Breakage/ingress coverage was reviewer-prompted, not proactive. The first RFC draft answered "how does the migration work" but not "what existing paths does it break, and when."
**What drove it**: Design authoring was organized around the spec's R-statements (which describe the desired migration behavior) rather than around an independent inventory of existing ingress surfaces. The spec does not enumerate every ingress path, so a spec-faithful RFC inherited that blind spot. No prior validated-pattern entry told me to build an ingress matrix for migrations.
**Corpus conflict**: none — this is a gap (a missing pattern), not a wrong entry. The new coaching moment `build-ingress-by-phase-matrix-for-contract-migrations` fills it.
**Impact**: One review round; 3 wrong claims + 1 edge case latent in the draft until the audit.

### 2. **Contributing Factors**
**Problem**: Two RFC claims (`/v1/events` as a cutover surface, `CLERK_OAUTH` enroll ingress) were asserted from schema/enum presence rather than from a verified writer audit.
**What drove it**: `MemberEnrolledVia.CLERK_OAUTH` is *defined* in the schema (`member.schema.ts:75`), and it is easy to treat a defined enum value as an active code path without grepping for a producer. Similarly, `/v1/events` looks like a member-keyed surface until you read that it resolves by internal cuid (`events.ts:96-97`).
**Impact**: Inaccurate impact-preview and dual-key SLA notes that would have misdirected implementation.

## What Went Wrong

1. **Reviewer-prompted coverage**: The breakage matrix should have been first-draft content for an identifier migration.
2. **Definition-not-usage claims**: Asserted ingress behavior from schema/enum presence instead of confirming a live writer.

## What Went Right

1. **Audit-on-feedback was thorough**: The §M audit was done at file:line granularity and self-surfaced 2 additional corrections beyond the reviewer's single question — the feedback was used as a probe, not patched narrowly.
2. **Scope tightened correctly**: The loyalty-vs-admin clarification was verified against code (admin/portal users are Clerk-org → `Brand` rows, not `Member` rows) before scoping to loyalty members via R36, and `clerkUserId` was added to the R26 preserve set so self-enroll attributes survive the re-key.
3. **Cross-artifact consistency**: Corrections were propagated to both RFC and spec (R30/R33, R31/R32/R35/R37 ACs) rather than only the RFC, avoiding spec/RFC drift into implementation.
4. **Single clean review round**: All feedback resolved in one pass; no thrash.

## What I Almost Did Wrong But Caught

1. **Near-miss**: Almost left `/v1/events` in the dual-key impact set. Reading `events.ts:96-97` during the §M audit showed it keys by internal cuid and is migration-stable — caught before it became a wrong query on the highest-traffic path.

## Where Past Learnings Actually Fired

1. **Pattern**: `reference_member_ingress_paths` (loyalty vs admin/Clerk members, ingress key-honoring) — fired during the §M audit and the scope clarification; it framed which paths resolve via `resolveOrEnrollMember` vs internal id, and confirmed admin users are not `Member` rows. Directly shaped R36 scoping and the `/v1/events` correction.

## Lessons Learned

1. **For contract/identifier migrations, the ingress×lifecycle matrix is design-authoring work, not review work.** Enumerate every path, classify honors-kind / creates-member, then walk each across pre-migration / PROCESSING / grace / post-grace.
2. **Claims about ingress behavior must cite a verified writer (file:line), not an enum or schema definition.** A defined enum value is not a live code path.
3. **Use a single reviewer question as a probe for the whole class of issue**, not a narrow patch — the §M audit prompted by one question found 3 more problems.

## Agent Rule Updates Made to avoid recurrence

1. **Coaching moment captured**: `build-ingress-by-phase-matrix-for-contract-migrations` — codifies the ingress×lifecycle matrix as a required design step for migrations.

## Enforcement Updates Made to avoid recurrence

1. **Carry-forward into implementation**: §M's breakage matrix and the corrected dual-key path set are the authoritative reference for which paths get dual-key reads during feature-implementation — preventing the wrong-query regression from re-entering at code time.
