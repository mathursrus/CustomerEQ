---
author: manohar.madhira@outlook.com
date: 2026-04-27
synthesized:
---

# Postmortem: Onboarding & First-Run Experience (technical design) — Issue #170

**Date**: 2026-04-27
**Duration**: Multi-session (RFC authored 2026-04-26; 2 review rounds across 2026-04-26 → 2026-04-27)
**Objective**: Author the technical design (RFC) for the shared onboarding spine — pinning OD-1..OD-5 from the merged spec, specifying schemas, the 11-method `IdentityProvider` interface, API surface, instrumentation matrix, GDPR cascade, and validation plan
**Outcome**: Success — RFC and evidence committed to PR #196, two review rounds (Round 1: spike on IdentityProvider abstraction; Round 2: 4 decision points resolved including 1 reviewer reversal). Awaiting merge approval.

## Executive Summary

Authored `docs/rfcs/170-onboarding-first-run.md` (~700 lines) and `docs/evidence/170-technical-design-evidence.md` (26-row traceability matrix). The RFC pins all five open architectural decisions from the spec phase, defines three new Prisma models (`OnboardingState`, `OnboardingActivationEvent`, supporting fields on `Brand`/`ApiKey`), specifies a single-source-of-truth `IdentityProvider` interface enforced by ESLint `no-restricted-imports`, and documents the failure-mode/retry/GDPR matrices.

Two review rounds: Round 1 added a spike that surfaced two real interface-shape issues (`completeOAuth` wrong shape for Clerk-mediated OAuth; `createUserWithOrg`'s hidden 3-call partial-failure mode). Round 2 converted the open "Decisions for the reviewer" into RESOLVED dispositions — three accepted defaults plus one clean reversal (`Brand.planTier` placeholder removed entirely after reviewer guidance that unfinalized features should not get schema columns).

## Architectural Impact

**Has Architectural Impact**: Yes (proposed; updates land in implementation PR per FRAIM convention)

**Sections proposed for update in the implementation PR**:
- `docs/architecture/architecture.md` — new ADR 0004 covering OD-4 (activation funnel storage) + OD-5 (IdentityProvider abstraction). After Round 2, the optional ADR 0005 was dropped per reviewer guidance ("One ADR is fine").
- Multi-tenant data-model section — add `OnboardingState`, `OnboardingActivationEvent`, and the `Brand` field additions.
- Patterns section — document IdentityProvider abstraction + ESLint `no-restricted-imports` enforcement.

**Updated in PR**: Will be — implementation PR (not this design PR) per FRAIM's address-feedback / implementation phase split.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ Re-read the merged feature spec (`docs/feature-specs/170-onboarding-first-run.md`, 664 lines on disk via PR #187 squash) to anchor the RFC against pinned spec text.
- ✅ Loaded ADRs 0001–0003 plus `fraim/personalized-employee/rules/project_rules.md`.
- ✅ Pulled #189 (team-management) and #190 (brand-settings) for cross-issue dependency context.
- ✅ Identified the 5 open architectural decisions (OD-1..OD-5) at spec lines 438/444/450/456/462 as the RFC's core deliverable.

### Phase 2: design-authoring
- ✅ Fetched the RFC template; identified ambiguities (none rated high uncertainty at the time).
- ⚠️ **Decided no spike needed** — recorded the rationale, but the IdentityProvider abstraction confidence row was rated "high" without verification. This call was reversed in Round 1 review (see Phase 7).
- ✅ Authored the full RFC: Customer/Problem; OD pins; Prisma schemas; 12-method `IdentityProvider` interface (later reduced to 11 after spike); 9 API endpoints with Zod schemas; instrumentation matrix; path-specific dashboard CTA dispatch; GDPR cascade; failure-mode/retry table; compliance controls; 19-scenario validation plan; test matrix; 10 risks; architecture-doc updates.

### Phase 3: technical-spike
- ⚠️ **Skipped initially with rationale**. Subsequently run during Phase 7 Round 1 at the reviewer's prompt.

### Phase 4: architecture-gap-review
- ✅ Three-bucket classification appended to the RFC (8 correctly followed / 3 missing / 0 incorrectly followed).

### Phase 5: design-completeness-review
- ✅ Authored `docs/evidence/170-technical-design-evidence.md` with the 26-row traceability matrix mapping every spec requirement, sub-issue contract (#171/#172/#173), user constraint, and reviewer-comment landing to RFC sections. All 26 rows ✅ Met.

### Phase 6: design-submission
- ✅ Committed and pushed (`df216ff`) on the existing `feature/170-epic-onboarding-first-run-experience` branch (reused after PR #187 squash-merged into main; branch reset to origin/main first).
- ✅ Opened PR #196.
- ✅ Posted evidence-link comment on the PR.

### Phase 7: address-feedback (2 rounds)

**Round 1** — 1 review comment (`docs/rfcs/170-onboarding-first-run.md` line 450, IdentityProvider abstraction confidence row):
- Reviewer: *"Do we need a Spike to verify?"*
- Ran a documentation-and-codebase spike against Clerk SDK docs + `apps/api/src/plugins/auth.ts` + `scripts/onboard-org.mjs`.
- **Findings**:
  - `parseWebhook` ✅ clean
  - `updateOrgName` ✅ clean
  - `createUserWithOrg` ⚠️ internally 3 Clerk API calls (createUser/findUserByEmail + createOrganization + addOrgMember) with hidden partial-failure mode → kept the interface; documented the internal-cleanup contract inline + new failure-mode row in §10
  - `completeOAuth({ code, state })` 🔴 wrong shape for Clerk's mediated OAuth — Clerk owns the callback; the app reads session, never receives code+state → **removed** from the interface; replaced with existing `getSession` + new `getUser(userId)`
- RFC updated: §3.1 interface, §4 API surface (removed `/api/auth/oauth/:provider/callback` row; clarified `/api/auth/signup/finish` to use `getUser` + `createOrgForUser`), §10 (3 new failure-mode rows), Spike Findings populated. Confidence revised 85 → 90.
- Commit `f007d0f`, replied to inline thread, posted summary comment.

**Round 2** — 4 review comments on the "Decisions for the reviewer" section (RFC lines 654–657):
- Decision #1 (single vs. phased migration) — Reviewer: "Agreed". RFC unchanged.
- Decision #2 (`Brand.planTier: String?` placeholder vs. omit) — **Reversal**. Reviewer: *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."* Removed `planTier String?` from §2.1 Brand schema; rewrote rationale paragraph; updated §2.5 migration list, §13 out-of-scope (UX-only slot, no schema field), Risks #7 (severity Med → Low, no migration to drop).
- Decision #3 (ADR scope, one vs. two) — Reviewer: "One ADR is fine". ADR 0004 covers both OD-4 and OD-5; optional ADR 0005 dropped from architecture-updates plan.
- Decision #4 (worker direct emission of `first_action_triggered`) — Reviewer: "Agreed". RFC unchanged.
- "Decisions for the reviewer" section converted to RESOLVED dispositions with reviewer quotes.
- Commit `1420b44`, replied to all 4 inline threads, posted summary comment.

### Phase 8: retrospective
- ✅ This document.

## Root Cause Analysis

### 1. **Confidence "high" without verification on the IdentityProvider abstraction**

**Problem**: The RFC's Confidence Level table rated the IdentityProvider abstraction "high" based on a desk-review of the interface shape — no codebase scan against the Clerk SDK's actual call shapes, no doc re-read against the canonical authentication flow.

**Impact**: One reviewer round (Round 1) added that would have been avoided by spending ~30 minutes on a spike before submission. The cost was low because the reviewer's pushback was clean ("Do we need a Spike?"), and the spike itself was cheap. But shipping the original interface unverified would have been days of integration rework once the implementation PR started, because `completeOAuth({code, state})` is fundamentally the wrong handshake model for Clerk and would have leaked through every callsite.

### 2. **Recommended a placeholder schema column for an unfinalized feature**

**Problem**: Decision #2 in the original "Decisions for the reviewer" section recommended adding `Brand.planTier: String?` as a "future-proof" placeholder, framed with `← recommended`. The reasoning at design time was forward-compatibility with the pricing-strategy job. The reviewer's reversal was correct: the placeholder pre-committed the schema to a string-shaped tier when the actual pricing model could be enum / FK / multi-row, and would have required a follow-up migration to drop or repurpose.

**Impact**: One additional commit (`1420b44`) to remove the field and update 4 dependent RFC sections. The cost was low because the reversal came in Round 2 with a clear one-line rationale, but the underlying anti-pattern (placeholder schema for unfinalized features) is worth memorializing. Captured durably in `project_pricing_not_finalized.md` (point #6).

## What Went Wrong

1. **Overconfident "high" rating on a not-yet-implemented integration interface** (RCA 1). Caught by reviewer's single-question pushback; cost was one round.
2. **Schema placeholder for unfinalized feature** (RCA 2). Caught by reviewer reversal in Round 2; cost was one round.

## What Went Right

1. **FRAIM-first discipline**: Started with `mcp__fraim__list_fraim_jobs` → `get_fraim_job` for `technical-design`; followed phases via `seekMentoring`. No plan mode, no Explore agents launched ahead of FRAIM context. The branch was reused cleanly after PR #187's squash (reset to origin/main first to drop redundant local-only spec commits).
2. **Decision-set framing got one-round resolutions**: All four "Decisions for the reviewer" used the validated `← recommended` + one-line tradeoff format. Three came back as accepted defaults ("Agreed" / "One ADR is fine"); one was reversed cleanly with a one-line rationale. Zero clarification rounds needed on any decision.
3. **Spike (when finally run) used the right level of verification**: Documentation-and-codebase audit, no PoC. The 30-minute audit found two real interface-shape issues that a PoC would have surfaced more slowly. Worth recording as a validated pattern: not every spike needs a runnable PoC; doc + callsite reads are often the right level for "does this interface match how the SDK actually works?" questions.
4. **Reviewer reversal accepted cleanly without re-arguing**: When the reviewer reversed Decision #2, applied the change across all dependent sections in a single commit and updated the durable memory `project_pricing_not_finalized.md` to capture the principle. Did not defend the original recommendation or ask for clarification — the rationale was clear.
5. **Traceability matrix caught reviewer-comment-landing gaps**: The 26-row matrix in `170-technical-design-evidence.md` includes 5 rows specifically for spec-phase Round 2 reviewer comments that needed to be honored in the RFC. Without the matrix, the OAuth-button preservation, theme-continuity FK, and #189/#190 dependency rows could have been missed.
6. **Three-bucket architecture-gap classification**: 8 correctly followed / 3 missing / 0 incorrectly followed. The bucket structure forces enumeration of the universe of patterns, not just the ones that pass — produced concrete recommendations the reviewer could approve in one round.
7. **Push + PR + thread-replies + summary-comment is now a clean handoff pattern**: Both rounds followed the same shape — commit → push → reply to each inline thread with where the change landed → top-level summary comment with a change-summary table. No reviewer follow-up "where did X land?" questions.

## What I Almost Did Wrong But Caught

1. **Almost wrote a planTier defense rather than a clean reversal**: When the reviewer reversed Decision #2, the first instinct was to argue for the placeholder ("but it preserves forward compat without committing to a specific shape..."). Caught it because the reviewer's rationale was clean and durable: *"Plan tier or method is unknown at this time. So I won't design for it yet."* Reversal beats argument when the user holds context (pricing model) the agent doesn't.
2. **Almost missed updating the durable memory after the reversal**: After applying the 5 RFC edits for Decision #2, almost stopped at the commit. Caught it because the reversal pattern ("don't add schema for unfinalized features") generalizes beyond pricing — added point #6 to `project_pricing_not_finalized.md` so the principle survives future sessions.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_before_plan_mode.md`**: First message of the session ("reuse the branch for 170 and start technical design") — read project rules, called `get_fraim_job` for `technical-design`, followed phases. No plan mode, no Explore agents until phases needed them.
2. **`feedback_push_pr_always_merge_with_review.md`**: Pushed both round commits without pausing for approval; awaited explicit approval before any merge action.
3. **`feedback_user_does_not_manually_close.md`**: Issue #170 stays open until merge; did not propose a manual close.
4. **`project_pricing_not_finalized.md`**: Originally fired during Round 2 *recommendation* — the agent flagged Step 0 plan UI as out-of-scope correctly but recommended a `planTier` placeholder column anyway. The reviewer reversal triggered an *update* to this memory (point #6) capturing the schema-field-specific guidance.
5. **`feedback_audit_mock_vs_spec_at_every_round.md`**: RFC is text-only with no associated mocks for the technical-design phase, so the rule applied trivially (no mock changes needed). Verified the absence rather than assuming.
6. **Validated-patterns "Open decisions framed with `← recommended` get one-round answers"**: Adopted for the four "Decisions for the reviewer". Three of four resolved as accepted defaults in one round; the fourth reversed cleanly with a one-line rationale.
7. **Validated-patterns "Honest 'is X synced?' answer triggers a real audit"**: When the reviewer asked the spike question, ran a real documentation-and-codebase audit rather than reflexively answering "high confidence is correct" — surfaced the two real interface-shape issues.
8. **Validated-patterns "Three-bucket architecture-gap classification"**: Used for the architecture-gap-review section; produced concrete patterns missing entries that the implementation PR can act on.

## Lessons Learned

1. **Confidence "high" on a not-yet-implemented external integration is overconfident unless the row cites the verifying artifact.** The IdentityProvider row was rated "high" based on the interface shape looking reasonable, not on a verification pass. Fixed-shape rule for future RFCs: any "high confidence" row on a new SDK abstraction must cite either a PoC, a documentation re-read, or a callsite review as the verifying artifact. The cost of running the spike up-front is ~30 minutes; the cost of shipping a wrong-shape interface is days of integration rework.

2. **Don't add placeholder schema columns for unfinalized features.** Even when framed as "forward-compat," a placeholder pre-commits the schema to a specific shape (string vs. enum vs. FK) and creates a follow-up migration burden. The pricing-strategy job will land schema and UI together when the model is known. UX-only placeholder slots in mocks are fine; persistent columns are not. Captured in `project_pricing_not_finalized.md` point #6.

3. **Reviewer reversals with a clear rationale resolve cleanly when accepted across all dependent sections in a single commit.** Decision #2 touched 5 sections of the RFC (§2.1, §2.5, §13, Risks #7, the Decisions section itself) plus the durable memory. Applying the reversal in one commit (`1420b44`) with all dependent sections updated produced a clean handoff. Defending the original recommendation would have cost a round and a half-baked compromise.

4. **Documentation-and-codebase spikes are sufficient for "does this interface match the SDK?" questions.** Reserve PoCs for "does it perform under load?" / "does it integrate at all?" questions. The Round 1 spike took 30 minutes against estimated 2-4 hours for a PoC, and surfaced the same findings.

5. **"Decisions for the reviewer" section at RFC bottom is now a durable RFC pattern.** Three of four decisions in this set resolved as accepted defaults in one round; one reversed cleanly. Same pattern shipped clean on issue #2 (2 ODs), #170 spec (5 ODs), #177 (3 PR-body decisions). Adopt as the default decision-resolution format for any RFC with 2+ open architectural decisions.

6. **Phase advance vs. merge authorization are different signals.** "Looks good. Proceed to next phase" advances the phase but does not authorize a merge. "Merge with Main" / "merge and close" authorizes the merge. Match the action to the words exactly.

## Agent Rule Updates Made to avoid recurrence

1. **Updated `project_pricing_not_finalized.md`** — added point #6 specifically prohibiting placeholder schema fields for unfinalized features. Captures the durable principle from the Decision #2 reversal.
2. **L1 retrospective entries** — added new pending-review entries to mistake-patterns (overconfident "high" rating; placeholder schema column), validated-patterns (doc-only spike sufficiency; clean reversal acceptance), and manager-coaching ("proceed to next phase" ≠ merge authorization).

## Enforcement Updates Made to avoid recurrence

1. **None automated.** The two new mistake patterns (overconfident "high" rating, placeholder schema for unfinalized features) are judgment-call patterns that don't lend themselves to automated CI checks. The L1 retrospective entries plus the updated memory are the durable enforcement mechanism.
