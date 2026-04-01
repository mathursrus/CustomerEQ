---
author: swavak@gmail.com
date: 2026-03-31
synthesized:
---

# Postmortem: Member Enrollment Technical Design — Issue #3

**Date**: 2026-03-31
**Duration**: Single session
**Objective**: Produce a complete, implementation-ready technical design (RFC) for the member enrollment flow, covering API changes, schema additions, BullMQ event pipeline, frontend pages, and architecture gap analysis.
**Outcome**: Success — RFC merged-ready at PR #77 with all open questions resolved via one feedback round.

---

## Executive Summary

The technical-design job completed successfully in one pass. A thorough codebase analysis in Phase 1 surfaced two significant gaps before the RFC was written: the auth plugin's inability to handle a new member's user-level Clerk JWT, and the absence of a `slug` field on any model for human-readable enrollment URLs. Both were documented as open questions in the RFC rather than guessed at, which led to a productive single feedback round that resolved both decisions cleanly. The final design is fully traced to all 21 spec requirements with one intentional deferral (SSO).

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: §4.4 Database Models (Member: emailOptIn/smsOptIn; Program: slug), §4.1 API Routes (new public program lookup endpoint), §4.2 Fastify Plugins (enrollment public route pattern)
**Changes Made**: Two new Member fields, one new Program field, one new public API endpoint, auth pattern clarification for new-member enrollment
**Rationale**: Required to close the gap between the existing skeleton implementation and the full spec requirements
**Updated in PR**: Yes — architecture doc updates deferred to address-feedback phase per job instructions; RFC documents all changes

---

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ Read full feature spec (`docs/feature-specs/3-member-enrollment.md`)
- ✅ Read architecture doc (`docs/architecture/architecture.md`)
- ✅ Read existing `apps/api/src/routes/members.ts` — found partial skeleton
- ✅ Read auth plugin — discovered user-level JWT gap for new member enrollment
- ✅ Read Prisma schema — confirmed Member model, found missing emailOptIn/smsOptIn
- ✅ Read worker, BullMQ queue, shared schemas — confirmed enrollment event type already handled

### Phase 2: design-authoring
- ✅ No existing design feedback file to address
- ✅ Classified ambiguities — no High uncertainty, no spike needed
- ✅ Wrote RFC at `docs/rfcs/3-member-enrollment.md` covering all spec requirements
- ✅ Applied `phase:design` label to issue
- ❌ Initial recommendation on enrollment URL (Option B: Brand.slug) was incorrect — overridden in feedback round

### Phase 3: architecture-gap-review
- ✅ Identified enrollment auth pattern as missing from architecture
- ✅ Identified emailOptIn/smsOptIn as missing from Member model description
- ✅ Identified Brand.slug absence as a design gap requiring decision
- ✅ Identified 409 breaking change as requiring confirmation
- ✅ All gaps documented in RFC Architecture Analysis section

### Phase 4: design-completeness-review
- ✅ Full traceability matrix: 21 requirements met, 1 deferred (SSO per spec OQ-2)
- ✅ Evidence file created at `docs/evidence/3-technical-design-evidence.md`

### Phase 5: design-submission
- ✅ Committed RFC + evidence, pushed branch, created PR #77
- ✅ Updated issue labels: `phase:design`, `status:needs-review`

### Phase 6: address-feedback
- ✅ Q1 (enrollment URL): User chose Option C — Program.slug globally unique
- ✅ Q2 (409 change): Confirmed acceptable
- ✅ RFC updated: schema, endpoints, frontend paths, architecture analysis all updated
- ✅ Evidence updated with decisions and rationale
- ✅ PR comment added summarizing resolved feedback

---

## Root Cause Analysis

### 1. Incorrect initial URL recommendation (Option B vs C)

**Problem**: The RFC initially recommended `Brand.slug` (Option B) for enrollment URLs, which was wrong given the multi-program use case.

**Root Cause**: The analysis correctly identified that `Brand` has no slug field, but the recommendation was made from a competitor-comparison angle ("all competitors use brand-level slugs") without fully thinking through the multi-program data model. The `Program` model was the right anchor — enrollment is always program-specific, not brand-specific.

**Impact**: Required one feedback round to correct. Low cost — the RFC structure made it easy to update.

**What would have prevented it**: Asking "can a brand have multiple active programs?" before recommending a slug anchor. The answer is explicitly yes in the architecture doc (Program model, multiple per Brand).

### 2. Auth plugin gap was non-obvious

**Problem**: The original spec assumed a `clerkToken`-based enrollment route, but the existing auth plugin's dev fallback (user sub → brand lookup by clerkOrgId) would still fail for new members with no org membership.

**Root Cause**: The auth plugin code path was not read until Phase 1 of this job. The feature spec was written without detailed knowledge of the auth plugin's implementation.

**Impact**: None — the gap was caught in Phase 1 before the RFC was written, and the public-route pattern (consistent with existing `/v1/public/*`) was the correct resolution.

---

## What Went Wrong

1. **Enrollment URL recommendation was incorrect**: Recommended Brand.slug (brand-level) when Program.slug (program-level) is the architecturally correct choice given that brands can have multiple programs. Required one feedback round to correct.

2. **Spec assumes Brand.slug without documenting it**: The feature spec uses `/{brandSlug}/enroll` as a given, but the Brand model has no slug field. This should have been caught during spec authoring (Issue #2 spec job). The technical design job is the right place to catch it, but earlier is better.

---

## What Went Right

1. **Deep codebase read before writing**: Reading the auth plugin, existing members route, worker, and Prisma schema before drafting the RFC surfaced all significant gaps upfront. This prevented designing against wrong assumptions.

2. **Open questions explicitly surfaced**: Both gaps (auth strategy, URL design) were clearly documented in the RFC as open questions rather than silently resolved with assumptions. This made the feedback round focused and fast.

3. **Single feedback round**: The RFC was complete enough that only two decisions needed user input, both resolved in one exchange.

4. **Worker reuse**: Recognizing that `processLoyaltyEvent` already handles any `triggerEvent` type including `enrollment` meant no worker changes were needed — the enrollment bonus pipeline was "free" given the existing architecture.

5. **Full traceability matrix**: Running the traceability check against all 21 spec requirements before submission caught nothing missing, which validated the RFC completeness.

---

## Lessons Learned

1. **Anchor slug fields at the correct model level**: When designing URL slugs, ask "what is the user actually navigating to?" — not "what do competitors use?" For enrollment, the answer is a specific program, not a brand. Slug anchoring should follow the entity that the URL action targets.

2. **Read auth plugin early for any new authenticated or semi-authenticated route**: Auth edge cases (new user, no org membership, public-but-verified routes) are non-obvious from the spec. Reading `apps/api/src/plugins/auth.ts` first prevents designing auth flows that can't work with the existing plugin.

3. **Check for slug/identifier fields on models before designing URLs**: Before proposing any human-readable URL, verify that the referenced model actually has a slug or identifier field in the Prisma schema. `Brand` had none; `Program` had none. This should be a standard checklist item in the architecture-gap-review phase.

4. **Multi-program brand use case is load-bearing**: CustomerEQ is explicitly designed for multi-program brands (geography, segment, benefit structure). Any design that works at the brand level but not the program level should be reconsidered — the program is the right granularity for most member-facing features.

---

## Agent Rule Updates Made to Avoid Recurrence

1. **URL slug design**: Before recommending a slug field, identify which model the URL action targets and verify that model has (or should have) a unique slug field in the Prisma schema.

2. **Auth plugin read-first**: For any new route involving authentication or partial authentication, read `apps/api/src/plugins/auth.ts` before drafting the design.

---

## Enforcement Updates Made to Avoid Recurrence

1. **Architecture gap review checklist item**: Add "verify slug/identifier fields exist on all URL-referenced models" as an explicit step in the architecture-gap-review phase when URL design is part of the RFC.

2. **Multi-program awareness**: When a brand-level decision is proposed, explicitly ask whether the decision works if the brand has N > 1 active programs of different types. If not, the program level is likely the right anchor.
