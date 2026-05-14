---
author: ghoshsanjoy@gmail.com
date: 2026-05-14
context: issue-357 (Support Platform Revamp — consolidated design review of Slices 1–4)
job: implementation-design-review
synthesized:
---

# Postmortem — Support Platform Revamp Design Review

## Summary
Ran a consolidated FRAIM `implementation-design-review` against the 4-slice Support Platform Revamp (PRs #363/#366/#368/#370 + local follow-up commits). Decision: REQUEST CHANGES — 1 critical defect (Slack thread cross-brand leakage), 6 important findings, 5 minor. The 3 fixes the user approved (C1 + I1 + I3) landed locally with passing regression tests. The remaining 3 important issues + 2 minor are documented as follow-ups.

## What went well
- **Architecture held under pressure.** Every locked decision in spec §2 was preserved through 4 slices of execution. No service extraction, no framework drift, no scope creep on the core hero loop. The "evolve in place" mandate held.
- **Tenant boundary enforcement in the orchestrator is rigorous.** The pgvector retrieval is brandId-filtered and there's an explicit integration test that asserts no cross-brand chunk bleed. That same discipline almost held everywhere — but missed the Slack webhook, surfaced by this review.
- **The single chokepoint pattern (`resolveConversation`) works.** All three resolution paths (agent / AI_TIMEOUT / CSAT) converge on one function. Memberid-gated loyalty emit is correctly enforced in one place; anon resolutions correctly skip. The duplication between api/worker is documented and tested on both sides.
- **HNSW index drift was caught and patterned.** Every migration that touched `kb_chunks` includes the explicit `DROP INDEX ... CREATE INDEX ... USING hnsw` block with an explanatory comment. Future migrators don't have to re-discover the gotcha.
- **The review itself stayed evidence-based.** Phase 3 surfaced the Slack cross-brand defect by reading actual code, not by trusting the PR body or commit message. Phase 6 validation gate re-ran live (~422 tests across 34 files).

## What went poorly
- **Spec + Slice-1 plan landed on `main` only.** Commits `cb962f7` (spec) and `37625a0` (slice 1 plan) are direct children of baseline `551deefe` but only on local `main`. The slice-1 branch was created from `origin/main` *before* the spec was pushed. Implementation-side branches therefore don't carry the spec they implement. Process gap; would have caused confusion in any cross-team review.
- **Subagent false negatives in Phase 2 completeness check.** The completeness subagent missed `apps/api/test/integration/webhooks-slack.integration.test.ts` and `apps/api/test/integration/support-widget-config.integration.test.ts` — claimed they were missing when they exist. Spot-check with `ls apps/api/test/integration/` caught both. Without verification, the test-matrix score would have been understated.
- **Cross-brand Slack defect (C1) was a real production-grade vulnerability.** Inside the orchestrator we filter by brandId rigorously. Inside the webhook handler, the thread-reply lookup was keyed by `slackTs` alone — a global Slack identifier — without brand scoping. The fix is two lines; the omission would have been a CVSS-medium tenant-isolation breach in production. Caught by code review, not by tests.
- **DraftSupportReply BAML eval shipped with 3 cases, not 20+.** The spec was unambiguous. The slice 1 plan even called it out. The implementer (me) wrote 3 substantive `it()` blocks and did not push back when it failed to expand to the spec'd 20-case judge-scored evaluation. Took the cheap path.
- **HMAC over re-stringified body is a silent footgun.** The slice 4 plan acknowledged this gap and explicitly deferred raw-body work to a follow-up. That deferral was a real risk — in production, any Slack payload with non-canonical JSON whitespace would fail signature verification. Test suite passed because the test client sends canonical JSON. Production would have caught this the hard way.

## Root cause analysis
**Why was the Slack tenant boundary missed?** Two contributing factors:
1. The route was written under the framing "verify the signature, then do the work" — once signature verification passed, the assumption was that the request was trusted *for that brand*. The implicit invariant was that a brand can't sign on behalf of another brand. True in spirit, but `slackTs` is a global ID that lives outside the signature scope, so the trust didn't carry across to the database lookup.
2. The Slack `team_id → brand_id` mapping was explicitly deferred (documented as a known limitation in the slice 4 PR body). The fallback was "require `X-Brand-Id` header." That fallback's blast radius wasn't fully reasoned through — `X-Brand-Id` proves *which* brand is calling but not *which* brand's data they're allowed to touch.

**Why was the rawBody HMAC gap acknowledged but shipped anyway?** Pressure to land the slice. The deferral was honest ("known production gap") but the deferral path didn't include a tracking issue, so it would have remained known-only-to-me indefinitely.

**Why was the spec branched-off-from?** I created the slice-1 branch with `git switch -c feature/issue-357-... origin/main` BEFORE pushing the spec commit to `origin`. The branch base captured the pre-spec state. Each subsequent slice stacked on that, so all 4 slices live without the spec in their tree.

## Key learnings
1. **Any lookup by a globally-unique-but-not-brand-scoped ID is a tenant-boundary review point.** Slack `thread_ts`, OAuth state, Stripe webhook IDs, vendor reference numbers — these all bypass Prisma middleware's `brandId` enforcement because the middleware can't synthesize a brand filter from a foreign-system ID. Anything matching this pattern needs an explicit "lookup-then-verify-brand" two-step.
2. **HMAC verification on a parsed body is always wrong, even if tests pass.** Raw body capture is the only correct pattern. The scoped `removeAllContentTypeParsers + addContentTypeParser({parseAs: 'string'})` pattern in Fastify v5 is clean and encapsulated — usable for Stripe, GitHub, Slack, anything else.
3. **Subagent completeness reports are starting points, not endings.** They miss things — especially when grep patterns don't quite cover the file naming convention used. Spot-checks are cheap (`ls apps/api/test/integration/` took 1 second and corrected the score by 2 test files).
4. **Deferred items need tracking issues, not just code comments.** "Deferred to follow-up" without a filed issue is just "forgotten."
5. **Spec branching: push the spec to origin BEFORE creating implementation branches.** Otherwise the spec lives off-tree from the work that implements it, and any reviewer reading the branch can't find the design doc.
6. **The optimistic-lock pattern is cheap to add.** ~15 LOC change to a route + 4-case test file + an optional Zod field. Should be the default for any agent-collision-prone resource (conversations, cases, alerts, anything with a multi-agent dashboard).

## Prevention measures
1. **Add a "tenant-boundary review" entry to the FRAIM Phase 3 code-review skill.** Specifically: enumerate every Prisma query that does NOT include `brandId` in its `where`, and justify each one. The Slack route would have failed this filter.
2. **Add a `@fastify/raw-body` pattern reference to the repo's `CLAUDE.md`** so the next webhook integration starts with the scoped content-type parser instead of `JSON.stringify(request.body)`.
3. **For deferred review items, always file a GitHub issue** — even a 3-line one. "Deferred to follow-up" without a tracking ID is invisible. Treat the issue as part of the review deliverable.
4. **Spec-then-implement loop checkpoint**: push the spec to origin BEFORE running `git switch -c feature/issue-N-…`. Add as a step in the FRAIM `feature-specification` job's hand-off to `feature-implementation`.
5. **For BAML eval discipline**: if a spec mandates ≥N labeled cases with a judge-scored pass-bar, the eval file's `cases` array should have a `if (cases.length < N) throw new Error(...)` guard (same pattern as `support_resolution.eval.ts`). Then "I'll expand later" can't ship.
6. **Phase 2 of `implementation-design-review` should require the agent to `ls` the test directories** rather than rely on grep. The cost is trivial and the false-negative rate drops.

## Decisions made during execution
- **Consolidate review across 4 slices vs per-slice** → consolidated. Single report easier to read; cross-slice issues (path divergence, duplicated `resolveConversation`) only visible in a consolidated view anyway.
- **Include unpushed follow-ups in review scope** → yes, to capture the full state of disk.
- **Fix C1 + I1 + I3 in this session vs defer** → fix now per user direction. C1 was a security defect; deferring would have been irresponsible.
- **Add C1 regression test** → yes. The two-line code fix is easy to mis-revert in a refactor; the test locks the invariant.
- **Don't push** → respected user's standing instruction. All commits local.

## Quality summary
| Dimension | Result |
|---|---|
| Spec coverage | 92% (78/85) before fixes |
| Code correctness | 1 critical → fixed; 9/10 targets clean before fixes |
| Test coverage vs spec §8 | ~70% (23/33) before fixes; +2 tests after fixes |
| Architecture compliance | ✅ all locked decisions honored |
| Risk mitigation | 2 gaps → fixed (I1 + I3); rest were already in place |
| Validation gates | All green (build/typecheck/lint/smoke/integration 422/422) |
