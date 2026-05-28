---
author: manohar.madhira@outlook.com
date: 2026-05-28
synthesized:
---

# Postmortem: Managed-email Send fails "Unprocessable Entity" for a registered member — Issue #531

**Date**: 2026-05-28
**Duration**: Single session
**Objective**: Diagnose and fix the production failure when an operator sent a managed email to a registered member from the FRAIM organization (survey "Are you FRAMING It?"). Symptom: bare "Send failed Unprocessable Entity" with no actionable detail.
**Outcome**: Success. Root cause identified from production logs (Audience-builder paste-roundtrip drops rows when brand `memberIdentifierKind` disagrees with member `externalId` shape → `AUDIENCE_EMPTY` → Fastify default error formatter strips `err.message`). Fix shipped via PR #532 (Draft, ready to flip). Companion chore filed as #529 for the Fastify error-handler unification.

## Executive Summary

A production-blocking P0 was diagnosed from the Azure Container Apps log line (`reqId: req-1x`, `code: AUDIENCE_EMPTY`) in one round of log queries, root-cause-traced through the audience-builder client + the brand-kind-aware paste parser, fixed with a small additive extension to `CustomListAudience` (the UI now ships `memberIds[]` directly so the parser is bypassed for UI-resolved rows), and shipped through every FRAIM phase up to `address-feedback`. The fix was non-invasive (5 source files, +60 LOC net), backward-compatible, and accompanied by 4 new integration tests that exercise the exact production configuration.

## Quick RCA Card

**What failed**: The audience-builder serialized selected rows' `externalId` strings into a paste body the server re-parsed with brand-kind-aware shape inference. When `Brand.memberIdentifierKind` disagreed with the member's `externalId` shape, every row was silently dropped → `AUDIENCE_EMPTY` (HTTP 422). Web client surfaced this as bare "Unprocessable Entity" because Fastify's default error formatter drops `err.message`.

**Impact**: Every managed-email send to a member whose stored `externalId` shape didn't match the brand's identifier kind failed with no actionable feedback. Production-blocking; first noticed against the FRAIM brand.

**What should have happened**: UI-resolved selections should ride on `memberIds[]` and be looked up server-side by `Member.id` directly. Shape-inference parsers should apply to typed input only.

**What changes next time**: Two structural changes already landed:
1. `CustomListAudience` gained an additive `memberIds: z.array(z.string()).max(10_000).optional()` field; audience-builder UI splits selectableRows into `memberIds` (have `r.memberId`) vs `identifiers` (typed-only auto-enroll rows). Server resolves memberIds by `Member.id` brand-scoped, bypassing the paste parser entirely.
2. Architecture doc gained the reuse rule "UI-resolved audience selections ship `memberIds[]`, not paste strings" so any future audience-picking UI inherits the contract.

**Example**: Production log `req-1x` at 2026-05-28 18:31:52 UTC, brand `cmp5ud2x2001xw7h2xhgfniru`, survey `cmp9xjc7l000gw8hcxxhrqvqv` — operator searched for "Sid" (resultCount=5, the member is real), then POST `/v1/surveys/.../distribution-batches` returned 422 `AUDIENCE_EMPTY` with stack trace at `distributionBatches.js:464:29`.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/architecture.md` § Cross-Cutting Patterns — appended one entry: "UI-resolved audience selections ship `memberIds[]`, not paste strings" *(Issue #531)*. Placed adjacent to the related #420 patterns (backward-compatible POST extension via discriminator; two-gate suppression model) so the audience-builder cluster reads in one place.

**Changes Made**: Documented the new UI/server contract for audience-picking surfaces — UI sends pre-resolved `Member.id`s for rows it sourced from server-authoritative search/preview; the server resolves those by `Member.id` (brand-scoped, alive-only) and bypasses shape inference. Shape-inference parsers (`parsePasteBody` / `parseCsvBody`) are explicitly preserved for genuinely typed operator input.

**Rationale**: This is a reusable pattern, not a one-off fix. Any future surface that lets an operator pick from server-authoritative member resolution (CRM segments, A/B-test cohorts, batch ops) should follow the same wire shape. Without the architecture-doc entry, the next implementer would invent the round-trip again.

**Updated in PR**: Yes — commit `6c6f073` on `feature/531-...` on PR #532.

## Timeline of Events

### Phase 1: Diagnosis
- [done] Read user report (URL + symptom)
- [done] Located error string in `apps/web/.../ManagedEmailFlow.tsx:367` — the web client reads `err.error` from the response body
- [done] Hypothesized two paths in `distributionBatches.ts` where Fastify default-formats a thrown error with `statusCode: 422` to body `{statusCode, error: "Unprocessable Entity", message}` — losing the message via the client's `err.error` read
- [done] Re-authenticated Azure CLI (sub: Azure subscription 1, tenant ad354a76) per user direction
- [done] Pulled 200 lines of `customereq-api` container logs; grepped for the POST that returned 422; got the exact stack trace and `code: "AUDIENCE_EMPTY"` confirmation on the first query
- [done] Traced the failure mechanism client → server: audience-builder `submitAudience` serializes the row's `externalId` into a paste body; server's `parsePasteBody` calls `inferIdentifierKind` (EMAIL_RE first, then E164, then bare-token); brand-kind mismatch drops the row to `unmatched`; resolver returns 0 members; transaction throws AUDIENCE_EMPTY
- [done] Identified the second-bug: Fastify default formatter strips `message` from the response body the client uses

### Phase 2: Issue filing (per user request)
- [done] Filed chore #529 (Fastify `setErrorHandler` normalization) covering the message-loss problem across all 15 throw sites in `apps/api/src/`
- [done] Filed P0 bug #531 with the full diagnosis, proposed fix, and acceptance criteria

### Phase 3: FRAIM issue-preparation
- [done] `prep-issue.sh 531` — created isolated worktree, branch, copied env files (4), installed deps (cache hit), built (full turbo cache hit), pushed branch
- [done] `npx fraim workspace-config validate` reported schema-mismatch warnings on pre-existing CustomerEQ config keys (project.domain, customizations.*); non-blocking per FRAIM allowing me to mark workspace-verification complete with a documented evidence note

### Phase 4: FRAIM feature-implementation (10 phases through implement-architecture-update)
- [done] `implement-scoping` — wrote `531-implement-work-list.md` (9 files, fix shape, validation plan, risk register, test traceability)
- [done] `implement-repro` — 5 schema unit tests + 1 audience-builder unit test + 4 integration tests, all failing for the right reason pre-fix
- [done] `implement-tests` — same set; no additional coverage needed
- [done] `implement-code` — `CustomListAudience.memberIds` schema field; `resolveCustomList` new resolution path; AudienceBuilder split; types update. Existing AudienceBuilder test updated to match the new contract (was asserting `identifiers` contains alice's email; post-fix asserts `memberIds === ['m-alice']`)
- [done] `implement-validate` — schema unit + audience-builder unit + 21/21 integration all green; user authorized deferral of manual UI to post-merge spot check ("I don't have MemberID enabled orgs in the local environment")
- [done] `implement-security-review` — 0 findings; auth/crypto firewall not touched; PII posture net-positive (UI stops shipping raw `externalId` for resolved rows; opaque `Member.id` CUID instead)
- [done] `implement-regression` — smoke 13/13, integration 21/21, typecheck 20/20, build 12/12
- [done] `implement-quality` — caught QC-1 (triple duplication of 8-field member select after my change added the 3rd instance); extracted `AUDIENCE_MEMBER_SELECT` constant; re-ran tests still 21/21
- [done] `implement-completeness-review` — 8/8 feature-req commitments Met, 5/5 technical-design commitments Met, all feedback ADDRESSED
- [done] `implement-architecture-update` — appended reuse pattern to `docs/architecture/architecture.md`
- [done] `implement-submission` — pushed 3 commits, draft PR #532 created and commented with phase summary
- [done] `address-feedback` — user signaled "Run work-completion" — explicit Rule 25a proceed signal

## Root Cause Analysis

### 1. **Primary Cause**

**Problem**: The audience-builder client was designed to round-trip its selections through a brand-kind-aware paste parser even when the canonical `Member.id` was already in hand from the server. The parser correctly rejected entries whose inferred shape disagreed with `Brand.memberIdentifierKind`, but applied this validation to UI-resolved rows where it shouldn't have. Result: silent row-drop → `AUDIENCE_EMPTY` → bare "Unprocessable Entity" surfaced to the operator.

**What drove it**: A historical convenience decision in the #420 audience-builder implementation. The designer wanted one server-side resolution path (`mode: 'custom_list'` paste body) instead of two (resolved + typed). Serializing the selected `externalId`s into a paste body meant one fewer code path on the server. The cost — re-applying brand-kind shape inference to data the server itself produced — was not surfaced as a risk in the #420 spec, RFC, or review. The brand-kind/externalId-shape disagreement was a latent invariant the original code assumed didn't exist (and in the original demo brand it didn't — EMAIL brand with email externalIds matched).

**Corpus conflict**: None directly. The `merit-over-ease` preference would have argued against the round-trip if it had been surfaced as a design choice. The bug came from a convenience that wasn't called out as a trade-off at design time, so no rule existed to flag it.

**Impact**: Production-blocking P0 for any brand whose `memberIdentifierKind` and member `externalId` shapes diverged. FRAIM org was the first hit; any future CUSTOMER_ID-keyed brand with email-shaped externalIds (very common — operators paste emails into a "Customer ID" column all the time) would have hit this. Plus the secondary bug — bare "Unprocessable Entity" — made the failure unactionable.

### 2. **Contributing Factors**

**Problem**: Fastify's default error formatter strips `err.message` from the response body, leaving `error` set to the HTTP phrase ("Unprocessable Entity"). The web client at `ManagedEmailFlow.tsx:367` reads `err.error` (the standard pattern across our codebase's `{error, code}` convention) and surfaces it directly. Result: the actual reason ("Audience is empty") and the code (`AUDIENCE_EMPTY`) never reach the operator.

**What drove it**: The codebase has two co-existing error-response shapes — `reply.status(N).send({error, code})` (used by most routes) and `throw err with statusCode` (used by ~15 throw sites). The latter falls through to Fastify's default formatter. No `fastify.setErrorHandler` exists to normalize the two. The mismatch has been latent across the codebase since the routes were written. This made the P0 worse by hiding the actual cause from the operator and from past observers (this is the second time the bare-"Unprocessable Entity" symptom has wasted operator time — per #529 filing).

**Corpus conflict**: None. This is a missing structural piece (the error handler) rather than a corpus-driven mistake.

**Impact**: Every `throw err` with `statusCode` produces an inactionable error surface to web clients. Filed as chore #529 for separate landing per Rule 21/26.

## What Went Wrong

1. **Triple-duplicated member select created before quality phase caught it**: When I added the new pre-resolved memberIds path to `resolveCustomList`, I wrote a 3rd copy of the 8-field `select: { id, externalId, email, firstName, lastName, erased, consentGivenAt, unsubscribedSurveysAt }` block. I should have noticed during implement-code that I was at the threshold where extraction pays. Caught and fixed in implement-quality (QC-1), but it should have been a single commit, not two-phase remediation.

2. **Docker assumed running**: I tried `docker compose up -d postgres` without checking if the container was already present from a previous worktree — got a container-name conflict. Cost: ~20 seconds. Trivial, but worth flagging because it's an avoidable round-trip.

## What Went Right

1. **Diagnosis was a single Azure CLI round-trip**: Pulling the API container logs and grepping for the failing reqId surfaced the exact error message + stack trace + bounded code in one query. The pino-structured logging on `customereq-api` made this immediate — without `level`/`event`/`code` JSON fields, this would have been multiple guess-and-check rounds.

2. **Test factory supported the production configuration directly**: `createBrand({ memberIdentifierKind: 'CUSTOMER_ID' })` + `createMember({ externalId: 'sid@example.com', email: 'sid@example.com' })` reproduced the exact production failure in 5 lines of test code. The factories were already shaped right.

3. **The fix shape was decided on merit, not ease**: I considered (a) a new top-level audience mode (`member_ids`), (b) extending `custom_list` with optional `memberIds`, and (c) a smaller patch. The work-list section 2 captured the trade-offs and the rationale for (b). Per `merit-over-ease`, the additive backward-compatible extension was the long-term-best answer (CSV upload + raw paste still benefit from shape inference; UI just doesn't pretend to be paste any more).

4. **Pre-existing flake noticed but not chased**: `apps/api/src/plugins/redis.test.ts` failed under full-suite parallel load. I verified it passed in isolation on both `main` and this branch before continuing — didn't waste a phase trying to fix an unrelated flake. Per `precision-debugging` guardrail.

5. **Architecture pattern captured for reuse**: Future audience-picking UI surfaces get the contract free. The `docs/architecture/architecture.md` entry pairs *what* (memberIds for resolved, identifiers for typed) with *why* (production-failure rationale) so the next implementer doesn't have to rediscover the lesson.

## What I Almost Did Wrong But Caught

1. **Almost split AC4 into its own follow-up issue**: Manual UI repro was a hold-point I couldn't satisfy locally (no CUSTOMER_ID brand). I almost proposed deferring to a separate "post-merge verification" issue. Caught it via the memory `One PR per issue (Rule 26)` — manual verification is a phase artifact of #531, not a new issue. Captured it as an explicit user-authorized deferral within the evidence doc instead, which is the right shape.

2. **Almost extracted a `MEMBER_IDS_CAP` constant**: The schema cap `memberIds.max(10_000)` matches `PASTE_ENTRIES_CAP = 10_000`. I considered hoisting to a shared constant. Caught that they're caps for different input shapes (UI-resolved member-id list vs typed paste rows) and conflating them would hide intent if the paste cap ever changed independently. Kept them as two literals with a comment explaining the intentional symmetry.

## Where Past Learnings Actually Fired

1. **`Validate phase must run build`** — fired correctly. I ran `pnpm turbo run typecheck --concurrency=1` AND `pnpm turbo run build --concurrency=1` (not just typecheck). The `--concurrency=1` flag came from observing the BAML race the first time and was retained for every subsequent build. The full build caught the `apps/web` lint behavior that typecheck alone would miss.

2. **`Copy .env from main worktree`** — fired via the script itself; `prep-issue.sh` copied 4 `.env` files automatically before `pnpm install`, preventing the Prisma postinstall failure mode the memory was written about. Belt-and-braces against the still-open FRAIM CLI bug.

3. **`Don't build against live dev server`** — fired by inference. I never started `pnpm dev`, so this never tripped. The constraint was respected without active mediation.

4. **`Draft PR until work-completion` + `work-completion auto-merges on ready`** — fired correctly. PR #532 opened as `--draft`, stayed Draft through all the implementation phases. Will flip to Ready in the work-completion job.

5. **`Merit over ease`** — fired during fix-shape selection (see "What Went Right #3"). Rejected the smallest-diff option in favor of the architecturally-correct additive contract extension.

6. **`No internal refs on customer pages`** — fired during review of the UI changes. No issue numbers, PR links, or `(#531)` text leaked into any rendered UI string. The only `#531` references are in code comments and commit messages, which is correct.

## Lessons Learned

1. **Round-tripping client-resolved data through a server-side parser is a contract anti-pattern.** If the server already has the canonical identifier (DB primary key), the client should send it directly and the server should resolve by that primary key — not re-derive the resolution from a free-text representation. This applies broadly: search results → bulk action, autocomplete → form submit, picker → workflow step.

2. **Fastify default error formatting is hostile to typed web clients.** Routes that `throw err` with `statusCode` produce a different response shape than routes that `reply.status(N).send({error, code})`. Web clients read `err.error` expecting a meaningful reason; the default formatter puts the HTTP phrase there and tucks the reason into `err.message`. The fix is a single `setErrorHandler` (filed as chore #529).

3. **`pino`-structured logging makes production diagnosis a single query.** The bounded `code` field on AUDIENCE_EMPTY was the difference between "we know what failed in one shot" and "we have to instrument and wait for the next repro." Any future server-side throw should attach `{statusCode, code}` to the Error object — the cost is one line, the savings are an entire repro cycle.

4. **Test-factory parity with production configurations is load-bearing.** The fact that `createBrand({ memberIdentifierKind: 'CUSTOMER_ID' })` and `createMember({ externalId: 'sid@example.com' })` worked first try meant I could write the failing repro test in 5 minutes. Conversely, when a factory doesn't support a production configuration (no FRAIM-like local brand), manual UI repro becomes the only path — and that's a friction we hit on this fix (AC4 deferred to post-merge).

5. **The 3-instance rule for DRY extraction is the right threshold.** Two duplicate `select` blocks were below the cost line of extraction. The 3rd instance (which my fix added) was over the line. The implement-quality phase caught it; the next time I introduce a 3rd instance of anything, I should extract during implement-code, not wait for quality.

## Agent Rule Updates Made to avoid recurrence

1. **Architecture pattern entry**: "UI-resolved audience selections ship `memberIds[]`, not paste strings" — added to `docs/architecture/architecture.md` so the contract is discoverable by any future audience-picking UI implementer.

2. **No rule files modified for this issue.** The lessons above are candidates for `sleep-on-learnings` to synthesize into preferences / mistake patterns; I deliberately did not pre-empt that synthesis here.

## Enforcement Updates Made to avoid recurrence

1. **Filed chore #529 (Fastify `setErrorHandler`)**: structural fix for the bare-"Unprocessable Entity" symptom across all 15 `throw err` sites in `apps/api/src/`. Lands separately per Rule 21/26.

2. **Integration test for the exact production configuration**: `apps/api/test/integration/distributionBatches.test.ts` › `POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)` exercises the failing configuration with a brand-scoped factory. Any future regression that re-introduces shape-inference for UI-resolved rows would fail this test loudly.

3. **DRY extraction landed in the same PR as the bug fix**: `AUDIENCE_MEMBER_SELECT` constant. Future audience-resolution paths inherit the same shape automatically.
