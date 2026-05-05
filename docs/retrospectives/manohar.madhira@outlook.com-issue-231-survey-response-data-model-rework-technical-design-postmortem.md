---
author: manohar.madhira@outlook.com
date: 2026-05-03
synthesized: 2026-05-04
---

# Postmortem: Survey response data model rework — technical design — Issue #231

**Date**: 2026-05-03
**Duration**: ~1 day (PR #259 from spec submission to RFC round-1 approval)
**Objective**: Translate the spec (R1-R17) into an implementable RFC; resolve the user's design question (`SURVEY_RESPONSE` vs `EMBEDDED_FORM` distinguishability); pick concrete technologies and patterns; close the loop on round-1 review feedback.
**Outcome**: Approved. RFC at `docs/rfcs/231-survey-response-data-model-rework.md`. Five commits on the design phase: `d143b99` (RFC draft) → `86cd005` (R18 audit-only signal capture, option B from chat) → `d61cbed` (Azure Maps IP-geo provider pick) → `70ad296` (round-1 feedback fixes). User signed off "Looks good. Proceed to next step."

## Executive Summary

The technical-design phase produced an implementable RFC covering schema migration, public-endpoint contract, channel-attribution rule, R18 audit-only enrollment-signal capture, Azure Maps IP-geo provider pick, and an Architecture Analysis section flagging 5 missing-from-architecture patterns + 3 stale-after-#231 diagrams. Round 1 review found 12 inline comments. The dominant correction was a naming-vs-detection inversion in the channel-attribution rule that required flipping the mapping across spec, RFC, and evidence in a single round. The walk-back was clean once caught (4 inline pushbacks made it unmissable). Coaching moment captured for future enum-design work.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: None *yet* — `docs/architecture/architecture.md` updates are scoped to the implementation PR per the FRAIM workflow's address-feedback phase rule. Captured as deferred items in the RFC's Architecture Analysis section.

**Changes To Land in Implementation PR**:
- §6 Design Patterns: add three entries (synchronous-fork-of-event-driven exception for auto-enroll; brand-default-with-survey-override storage hierarchy; server-detectable channel-attribution rule).
- §4 Member component: rewrite around polymorphic identifier (`externalId` canonical, `email`/`phone` PII sidecars, `enrolledVia` traceability).
- §5.1 Event Ingestion sequence diagram: fork annotation for survey-response auto-enrollment.
- §5.3 Webhook Ingestion sequence diagram: replace `email + brandId` lookup with `externalId + brandId`.

**Rationale**: The RFC introduces several patterns not currently documented and depends on others that will go stale once #231 lands. Architecture-doc surgery in a separate review round (the implementation PR) is cleaner than landing it speculatively now.

## Timeline of Events

### Phase 1: RFC drafting
- ✅ **Spike decision**: skipped — all surfaces low-uncertainty (Prisma upsert, Postgres expression-index, BullMQ enqueue, transactional migration with collision guard are all standard).
- ✅ **Channel attribution rule**: server-detectable via URL-query-vs-body identifier source. Original mapping committed: URL = `SURVEY_RESPONSE`, body = `EMBEDDED_FORM` — *inverted from the channel semantics, caught in round 1 review*.
- ✅ **Architecture Analysis section** added with three explicit buckets: Correctly Followed, Missing from Architecture, Incorrectly Followed.

### Phase 2: Mid-design adjustments from chat
- ✅ **R18 added** in response to user's moderate-POV ask about `Member.location`. Picked option B (audit-only via `LoyaltyEvent.payload.enrollmentSignals`, no schema change). Verified `LoyaltyEvent.payload Json?` exists at `schema.prisma:416` before claiming — L1 lesson firing correctly.
- ✅ **IP-geo provider picked**: Azure Maps Geolocation API. Rejected Cloudflare CF-IPCountry after verifying architecture.md §8 names Azure Front Door (not Cloudflare) as the CDN. MaxMind picked as the V1+ swap target with documented trigger conditions.

### Phase 3: Round 1 feedback
- ❌ **Channel-attribution mapping flipped**: 4 inline comments on lines 107, 125, 127, 283 said the same thing four different ways: "if customer knew the identity it would be embedded form not survey_response." The user's reading was consistent and correct; the agent's mapping was inverted.
- ❌ **Auto-enroll conflated with `responsePolicy`**: failure-modes table row read "responsePolicy = ONCE and a prior response exists | endpoint does not auto-enroll a new member." User flagged: "ResponsePolicy plays no role in auto-enroll process." Two orthogonal decisions had been collapsed into one row.
- ✅ **Architecture Analysis "Agreed" items** (7 comments): all 5 missing-from-architecture entries + 2 of the 3 stale-after-#231 diagrams confirmed for the implementation PR.

### Phase 4: Round 1 fixes (commit `70ad296`)
- ✅ Channel-attribution mapping flipped consistently across spec + RFC + evidence (full grep pass to catch every detection-bound reference).
- ✅ Failure-modes table split into two rows: member-existence check (independent of policy) + `responsePolicy = ONCE` enforcement (independent of auto-enroll).
- ✅ All 12 review threads got per-thread replies citing `70ad296`.
- ✅ User approved: "Looks good. Proceed to next step."

## Root Cause Analysis

### 1. **Primary Cause: Enum names described detection signal, not channel semantics**

**Problem**: The agent picked enum values `SURVEY_RESPONSE` and `EMBEDDED_FORM` and then mapped them to the detection paths by **trust framing** (URL-supplied = trusted = ?_RESPONSE) rather than by **channel semantics** (URL-supplied = host-app embedded = `EMBEDDED_FORM`).

**Impact**: Spec, RFC, evidence doc, and 4 example rows in Validation Plan all carried the inverted mapping. User caught it via 4 separate inline pushbacks on consecutive RFC sections — clear "stop and reconsider" signal. Round-1 fix touched 8 strings across 3 files.

### 2. **Contributing Factor: Auto-enroll logic conflated with response-policy enforcement**

**Problem**: Failure-modes table row read "`responsePolicy = ONCE` and a prior response exists | endpoint does not auto-enroll a new member..." — collapsing two orthogonal decisions (member-existence resolution + policy enforcement) into one composite description.

**Impact**: User pushback was direct: "ResponsePolicy plays no role in auto-enroll process." Fix required splitting the row in two and adding explicit framing that member resolution runs first and is purely member-existence-driven.

### 3. **Contributing Factor: Mid-design technology pick flow worked correctly**

The Azure Maps pick (and MaxMind-as-swap-target) flow read `architecture.md §8` and `CLAUDE.md` production-secrets policy before claiming, per the L1 lesson from yesterday's sleep-on-learnings. No correction needed — this was a "what went right" moment.

## What Went Wrong

1. **Channel-attribution naming inverted across the doc set.** Designed by trust signal, not by channel semantics. 4 inline pushbacks before the agent saw it; should have been 1.
2. **Auto-enroll conflated with policy enforcement in one prose row.** Two orthogonal decisions in one sentence is a documentation smell that the agent missed at draft time.

## What Went Right

1. **R18 design (audit-only via LoyaltyEvent.payload, no schema change)** correctly applied the `Brand.planTier` reversal pattern: don't add Member-level columns for unfinalized features. The user's pick of option B from a 4-option menu validated the framing.
2. **IP-geo provider pick read primary sources before claiming** — verified architecture.md §8 (Azure Front Door, not Cloudflare) and CLAUDE.md production-secrets policy before writing the recommendation. The L1 lesson from yesterday's sleep-on-learnings (`Asserted facts about file/config contents without reading the primary source first`) fired correctly here.
3. **Architecture Analysis section structure** (3 explicit buckets: Correctly Followed / Missing from Architecture / Incorrectly Followed) made gap discussion easy — user said "Agreed" 7 times in a row to architecture-gap candidates.
4. **Per-thread PR-thread replies** posted at resolution time, not just the feedback-file mark. User validated this in yesterday's coaching moment; today's round followed the new norm.
5. **Coaching moment captured at the moment of correction**, not deferred.

## What I Almost Did Wrong But Caught

1. **Near-miss: claiming `LoyaltyEvent.metadata` exists when it actually doesn't.** When writing R18, the agent's first instinct was to write "use existing `LoyaltyEvent.metadata`." Caught the doubt, ran a Grep against `schema.prisma`, found the actual column is `payload` (not `metadata`). Updated the RFC to cite `LoyaltyEvent.payload` at `schema.prisma:416`. Without that verification, the RFC would have referenced a nonexistent column.

## Where Past Learnings Actually Fired

1. **Pattern**: *Asserted facts about file / config / external-state contents without reading the primary source first* (L1 mistake-pattern, P-HIGH 8.0, synthesized today). Fired three times in this design phase — verified `LoyaltyEvent.payload` exists before claiming, verified architecture.md §8 names Front Door before rejecting Cloudflare, verified CLAUDE.md production-secrets pattern before specifying the AZURE_MAPS_KEY flow. Cost prevented: each could have been a round-1 correction.

2. **Pattern**: *Did not post per-thread replies on PR review comments when addressing feedback* (L1 mistake-pattern, P-MED 5.0, synthesized today). Fired correctly — 12 per-thread replies posted at resolution time in round 1, citing the resolving commit + a one-line summary per thread.

3. **Pattern**: *Single-question pushback, not a lecture, when approach needs correction* (L1 manager-coaching, P-HIGH 8.0). The 4 inline pushbacks on the channel-attribution flip ("Is this logic flipped or correct?", "member_id via URL query would mean embedded, correct?", "if customer knew the identity it would be embedded form", "Consistently SURVEY_RESPONSE and EMBEDDED_FORM seem to be flipped") were the same single-question shape applied 4 times — a hard "stop and reconsider" signal. Treated as such; round-1 fix flipped the mapping consistently rather than defending the original framing.

4. **Pattern**: *Reviewer reversals with one-line rationale resolve cleanly when accepted without re-arguing* (L1 validated-pattern). Comment #4 ("ResponsePolicy plays no role in auto-enroll process") was applied in `70ad296` by splitting the row into two — no defense of the original framing. The reversal itself was the design guidance.

## Lessons Learned

1. **Enum names should describe what the value semantically represents (channel/state/kind), not the detection signal that distinguishes them.** Today's coaching moment captures this. For future enum-design work: do a "name-only sanity check" — strip away implementation reasoning and read each enum value as a developer encountering it for the first time. If your immediate intuition about which detection produces which value disagrees with the documented mapping, the names or mapping is wrong; fix before submit.

2. **Two orthogonal decisions don't fit in one row.** When a failure-modes / behavior / policy table row reads as "X and Y → Z," check whether X and Y are truly co-dependent or just adjacent in time. Auto-enroll (member-existence) and `responsePolicy` enforcement (resolved-member policy check) are two separate decisions; one row collapsed them into a single composite description that misled the reviewer.

3. **Architecture Analysis with three buckets makes gap-discussion fast.** "Patterns Correctly Followed / Missing from Architecture / Incorrectly Followed" produced 7 unanimous "Agreed" responses in a row. The structure forces the agent to enumerate the universe of patterns, not just defend the chosen ones.

4. **Provider abstraction makes V0/V1 trade-offs concrete.** The IpGeoProvider interface lets us pick Azure Maps for V0 (low setup cost) and document MaxMind as the V1+ swap target with explicit trigger conditions. This pattern (interface + V0 impl + V1 swap target with trigger conditions) is broadly reusable for any "cheap-to-start, expensive-at-scale" tech choice.

## Agent Rule Updates Made to avoid recurrence

1. **No project-rule updates from this round** — none of the corrections rise to the convention-level. The channel-attribution naming lesson is captured at the agent-learnings layer (L0 coaching moment + future L1 entry after sleep-on-learnings).

## Enforcement Updates Made to avoid recurrence

1. **L0 coaching moment written**: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-03T20-30-00-channel-attribution-named-by-channel-not-trust.md`. Will be processed by the next `sleep-on-learnings` run.

2. **No tool / config / lint changes proposed** — the lesson is at the cognitive design layer (think about what the name semantically represents before writing the mapping). Tool-level enforcement isn't a fit.

3. **Architecture-doc updates queued** for the implementation PR's address-feedback phase: 5 new pattern entries + 3 stale-diagram fixes. Capturing them in this retrospective (and in `docs/evidence/231-technical-design-feedback.md`) so the implementation orchestrator picks them up without context loss.
