---
author: manohar.madhira@outlook.com
date: 2026-05-28
synthesized:
---

# Postmortem: Switch Member Identifier Kind — Slice 1 (Customer ID → Email) — feature-specification — Issue #524

**Date**: 2026-05-28
**Duration**: One session, four feedback rounds
**Objective**: Produce the feature spec + UI mock for Slice 1 (`CUSTOMER_ID → EMAIL`) of #524, the deferred follow-on to #231 that lets a brand switch its member identifier method after members exist.
**Outcome**: success — approved by the user; advancing to `technical-design`. Final head `a8341c2` on PR #525 (Draft).

## Executive Summary

The spec went out as 27 R-statements with a high-fidelity 8-scene mock and an inferred GDPR/CCPA compliance section, anchored to existing project patterns (`SurveyImportBatch` progress shape, `usePollingQuery`, the 277 org-settings design system). It then took four review rounds to reach approved state — two of which surfaced load-bearing gaps in my initial design (data-aware Step 1, and the brand-side cutover lifecycle) that I had not anticipated. The final spec has 37 R-statements (R0 + R1–R29 + R30–R37) with a Resolved-Decisions section in place of Open Questions.

## Quick RCA Card

**What failed**: Initial spec missed two load-bearing concerns — (a) that existing `Member.email` may already supply the mapping (forcing an upload was busywork), and (b) the brand-side cutover (host integrations still using the old key after the kind flip).
**Impact**: Two extra review rounds (Round 1, Round 2) before the spec was reviewable for finer details (Rounds 3–4).
**What should have happened**: In context-gathering, I should have enumerated (i) every existing data column that could supply mapping inputs, and (ii) every external actor that emits the identifier and would need a cutover path after the flip — *before* designing the wizard.
**What changes next time**: Two captured coaching moments now codify these — `enumerate-existing-data-as-mapping-source` and `design-for-brand-side-cutover-not-just-system-catchup`. Apply both as explicit Phase 1 checks for any data-migration / contract-flip spec.
**Example**: Scene 2's original "you'll provide the email for each member" assumed an empty `Member.email`; a `CUSTOMER_ID` brand using managed-email sends would already have it populated.

## Architectural Impact

**Has Architectural Impact**: No (for the spec phase itself).

The spec specifies behavior that will land in subsequent phases (technical-design + impl). Architecture-doc updates are the technical-design phase's job once the schema choices (migration batch model, grace-window storage, audit shape extensions) are finalized.

## Timeline of Events

### Phase 1: context-gathering
- [done] Read project rules, FRAIM job catalog, RFC #231 (origin of the locked model), schema + `resolveOrEnrollMember` + admin-brand-profile + `MemberIdentificationSection`.
- [done] Identified `usePollingQuery` and `SurveyImportBatch` as reusable patterns.
- [missed] Did **not** enumerate `Member.email`-population state as an input-source variation → drove the Round 1 miss.
- [missed] Did **not** enumerate external-actor (brand integrations) cutover needs → drove the Round 2 miss.

### Phase 2: spec-drafting
- [done] R1–R27 covering entry, mapping intake, validation, confirmation, execution, catch-up, completion/failure, audit/compliance/isolation.
- [done] 8-scene HTML mock in the org-settings design system.
- [done] Compliance Requirements (GDPR/CCPA inferred), Validation Plan, Alternatives.

### Phase 3: competitor-analysis
- [done] Sourced Smile.io + Yotpo + Annex Cloud research (5 citations); identified 3 differentiation pillars.
- [done] Flagged `fraim/config.json competitors` for user approval instead of unilateral commit.

### Phase 4: spec-completeness-review
- [done] Mock rendered in browser; verified 10/10 issue ACs map to R-statements.

### Phase 5: spec-submission
- [done] Draft PR #525 (per Rule 27); evidence + PR comment + labels.

### Phase 6: address-feedback
- [done] **Round 1** — Data-aware Step 1 (Scene 2A fast path / Scene 2B partial / none). Added R28, R29; modified R4.
- [done] **Round 2** — Brand-side cutover lifecycle: impact preview (R30) + grace window (R31–R34) + R35 expiry + R37 pre-expiry warning. Added Scenes 7B/7Bw/7C.
- [done] **Round 3** — 11 inline PR comments addressed: R0 engine-level, R29 dual-ref, R13/R25 audit, R30 ordering, R31 simplification, R34 simple-action, R37 added. Open Questions → Resolved Decisions.
- [done] **Round 4** — R28 override path = R4/R5/R6–R12 flow; renamed "Upload override CSV" → "Edit mapping before migrating."

## Root Cause Analysis

### 1. **Primary Cause** (Round 1 miss — data-source enumeration)
**Problem**: Designed the wizard with "admin always uploads a CSV" as the only mapping source, ignoring that `Member.email` may already be populated for some/all members on a `CUSTOMER_ID` brand.
**What drove it**: I treated the schema's `Member.email` as a sidecar to be *populated by* the migration, not as a potential *source of* the migration. No corpus entry endorsed this; it was a reasoning gap: in context-gathering, I mapped what produced the identifier but not what other columns might already carry the target identifier's data.
**Corpus conflict**: none. (The `validated-patterns` file has no entry endorsing "always force a fresh upload"; this was a fresh miss.)
**Impact**: Round 1 — added R28, R29; modified R4; new Scenes 2A/2B.

### 2. **Primary Cause** (Round 2 miss — external-actor cutover)
**Problem**: Designed only the *system-side* dual-key catch-up (R19/R20) during the re-key window; missed that brand integrations (embedded survey URLs, `/v1/events` posts, distribution CSVs, webhooks) still emit the old identifier and need a grace window + cutover-tracking surface after the kind flip.
**What drove it**: I scoped "catch-up" narrowly to "data the system has not yet re-keyed" rather than "everything still arriving on the old contract." No corpus entry endorsed this scoping; again a reasoning gap — I optimized for internal database consistency without modeling the external actors that feed it.
**Corpus conflict**: none. The codebase actually has a parallel example (Issue #420 managed email sends rely on `Member.email`, which is exactly the integration the brand would need to update) — I read that during context but didn't generalize to "what other integrations touch the identifier?"
**Impact**: Round 2 — added R30–R37; new Scenes 7B/7Bw/7C; lifecycle subsection.

### 3. **Contributing Factor** (over-applied FRAIM re-validation loop)
**Problem**: Called `seekMentoring(status="failure")` after Round 1 to "trigger re-validation," which looped the workflow back through `spec-drafting → competitor-analysis → completeness-review` for what was a small additive scope refinement. Wasted ~3 phase calls before getting back to `address-feedback`.
**What drove it**: I read Phase 6 Step 6 ("If you addressed feedback and need re-validation: status=failure") too literally, without weighing whether the change actually invalidated earlier phases.
**Corpus conflict**: none directly; this is a workflow-tool literalism, not a corpus issue.
**Impact**: Minor — workflow noise but no incorrect work; corrected myself in Round 2 (stayed in `address-feedback` and waited for the user's signal). Recorded the correction in chat for transparency.

## What Went Wrong

1. **Round 1 miss** — see RCA #1.
2. **Round 2 miss** — see RCA #2.
3. **`seekMentoring(status="failure")` over-application** — see RCA #3.

## What Went Right

1. **R-style with one behavior per line + Given/When/Then ACs** — user explicitly noted this made review easy and the document short. This is the "Spec prose is not a deliverable" project memory in action; keep doing it.
2. **Anchored every claim to existing repo patterns** — `usePollingQuery`, `SurveyImportBatch`, the 277 org-settings design system, the consent-mode attestation pattern, the existing `brand.profile.update` audit. No new infrastructure proposed where reuse was possible.
3. **Sourced competitor analysis** — 5 citations with accessed dates; no fabricated claims. Surfaced a real differentiation (identifier kind as first-class + catch-up window) honestly.
4. **High-fidelity HTML mock in the surface's actual design system** — borrowed CSS from `277-organization-settings.html` so the mock visually matches where the feature lives; reviewed by `usePollingQuery` standards from architecture.md.
5. **Inline PR replies, one per thread** — the 11-comment Round 3 was addressable thread-by-thread without ambiguity.
6. **Kept `main` clean throughout** — every commit on the feature branch; `git status` clean on main after each round.
7. **Captured two coaching moments while the context was fresh** — `enumerate-existing-data-as-mapping-source` and `design-for-brand-side-cutover-not-just-system-catchup`. These are durable.

## What I Almost Did Wrong But Caught

1. **Near-miss: `gh pr create` without `--draft`.** Almost ran the auto-create flow blindly; caught Rule 27 ("PRs open as Draft until work-completion") before pushing. Created with `--draft`.
2. **Near-miss: writing the coaching moment in the main worktree.** Wrote the first coaching moment to the main repo's `fraim/personalized-employee/learnings/raw/` directory; caught immediately ("we don't commit on main"), moved it to the issue worktree before committing.
3. **Near-miss: leaving competitor-config edit unilateral.** The competitor-analysis phase says I "MUST" propose adding new competitors to `fraim/config.json`. Almost edited the file directly; caught the "no-unilateral-config" preference and deferred to user approval, flagging in the spec instead.

## Where Past Learnings Actually Fired

1. **Pattern**: `Spec prose is not a deliverable` — every visible mock affordance got an R-number; compound R-statements got split (e.g., R34 explicitly separates the panel surface from the extend action and the audit logging). User confirmed the result in Round 4: short, easy to review.
2. **Pattern**: `Always open HTML mocks` — read the 277 org-settings mock end-to-end before designing the new mock, and the 262 import-flow mock for the upload/progress patterns. Borrowed exact CSS variables so the visual language matched.
3. **Pattern**: `Mock filename matches spec` — used `524-switch-member-identifier-kind.html` (mirroring the spec stem) instead of the deprecated `524-view.html` default.
4. **Pattern**: `Copy .env from main worktree` — verified `.env` files were present in the issue worktree post `prep-issue.sh` (the script now does it automatically); confirmed `pnpm build` worked.
5. **Pattern**: `Check PR comments before merge` (and FRAIM Phase 11 stay-on-PR) — when 11 inline comments landed, addressed each on the same PR thread-by-thread instead of splitting.
6. **Pattern**: `Draft PR until work-completion` — PR opened with `--draft` and stayed Draft across all four feedback rounds.

## Lessons Learned

1. **For any data-migration spec, enumerate every existing column that could supply mapping inputs *before* designing the intake UX.** "Where will the new identifier values come from?" has multiple answers including "from a column we already have."
2. **For any contract-flip spec (schema change, identifier shape, auth scheme), enumerate every external actor that emits the old contract *before* designing the cutover.** "Internal consistency" is necessary but never sufficient.
3. **Architectural intents belong in explicit R-statements (e.g., R0 direction-agnostic engine), not buried in scope-note prose.** Reviewers cannot pin tests to prose.
4. **When a deadline drives a behavior change, design the lead-up warning surface too.** R37 emerged from this — without it, the grace expiry is a cliff.
5. **`seekMentoring(status="failure")` is for the rare case where the change invalidates earlier phases (e.g., new compliance regulation forces a re-read of the regulation, or a wholesale scope shift).** For additive refinements, stay in the current phase and wait for the user's signal.

## Agent Rule Updates Made to avoid recurrence

1. **Captured coaching moments (durable, will be synthesized by `sleep-on-learnings`)**:
   - `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-28T06-18-25-enumerate-existing-data-as-mapping-source.md`
   - `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-28T06-39-52-design-for-brand-side-cutover-not-just-system-catchup.md`
2. **No new FRAIM rule changes proposed** — the two misses were reasoning gaps, not rule violations. The coaching moments cover prevention.

## Enforcement Updates Made to avoid recurrence

1. **Coaching moments are L0 signals; synthesis happens in `sleep-on-learnings`.** I'll run that job next time it makes sense (per FRAIM's "36 unprocessed signals pending" warning that the agent already surfaces).
2. **No process/script changes warranted** — the FRAIM workflow + project rules + memory entries did their job once they fired. The misses were inside the work itself, not in the surrounding process.
