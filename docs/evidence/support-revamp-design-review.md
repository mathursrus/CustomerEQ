# Support Platform Revamp — Consolidated Design Review

**Reviewer:** Claude (Opus 4.7, 1M context) via FRAIM `implementation-design-review` job
**Date:** 2026-05-14
**Reviewed against:** `git show cb962f7:docs/superpowers/specs/2026-05-13-support-platform-revamp-design.md` (324 lines)
**Reviewed scope:** All 4 slice PRs (#363 / #366 / #368 / #370) + unpushed follow-ups on branch `feature/issue-369-support-revamp-slice-4`
**Iteration:** 1 (first review)
**Decision: REQUEST CHANGES** — one critical defect blocks merge.

---

## Executive summary

The Support Platform Revamp is ~92% complete against the spec, well-architected, and substantively correct in the load-bearing AI orchestration / loyalty bridge / widget flows. **One critical defect** (Slack thread cross-brand leakage) must be fixed before any of the 4 PRs merge. Test coverage is roughly 70% of the spec's §8 matrix — most unit and integration tests landed, but several integration flows (anon-orchestration lifecycle, identified upgrade, tiered branching, timeout resolver, Slack inbound) and all 5 E2E flows are not yet present. BAML eval pass-bar enforcement is missing for `DraftSupportReply`.

Architecture compliance is strong — every locked decision in spec §2 + the evolve-in-place pattern in §3 is honored. Two deliberate divergences from spec exist (KB UI at `/admin/kb/sources/` instead of `/admin/support/knowledge/`, and `resolveConversation` duplicated across api/worker to break a workspace cycle) — both documented in commit messages and PR bodies.

---

## Critical findings (BLOCK merge)

### C1. Cross-brand Slack thread leakage
**File:** `apps/api/src/routes/webhooks-slack.ts:56-59`
**Risk:** Tenant isolation violation. An attacker controlling the Slack workspace for Brand A can craft a Slack Events payload with a `thread_ts` matching a `Message.slackTs` from Brand B's conversation, and a valid signature signed with Brand A's own secret. The handler will write the malicious message into Brand B's conversation because the lookup is keyed only on `slackTs`.

**Current code:**
```ts
const threadMsg = await fastify.prisma.message.findFirst({
  where: { slackTs: body.event.thread_ts },
  select: { conversationId: true },
})
if (threadMsg) {
  await fastify.prisma.message.create({
    data: { conversationId: threadMsg.conversationId, role: 'AGENT', ... }
  })
}
```

**Required fix:**
```ts
const threadMsg = await fastify.prisma.message.findFirst({
  where: { slackTs: body.event.thread_ts },
  select: {
    conversationId: true,
    conversation: { select: { brandId: true } },
  },
})
if (threadMsg && threadMsg.conversation.brandId !== brandIdHeader) {
  return reply.status(403).send({ error: 'Thread does not belong to this brand' })
}
if (threadMsg) { /* existing write */ }
```

**Spec reference:** §7 invariants — *"Every Conversation/Message/... carries brandId. Prisma middleware enforces tenant scoping."* The handler bypasses middleware because it queries by an unindexed cross-cutting field (`slackTs`).

**Test gap:** No existing integration test covers the cross-brand attack scenario. After fix, add a test seeded with messages on two brands sharing a contrived `slackTs` and verify rejection.

---

## Important findings (fix before merge or file as follow-up issues)

### I1. `Conversation.updatedAt` optimistic-concurrency check missing for agent collision
**Files:** `apps/api/src/routes/support-admin.ts` (PATCH conversation/message routes)
**Spec reference:** §7 — *"Optimistic concurrency on `Conversation.updatedAt`; second writer gets `409 STALE`, UI prompts refresh."*
**Status:** Not implemented. Two agents replying to the same conversation simultaneously will silently overwrite each other's status changes.
**Suggested fix:** Add an optional `ifUnmodifiedSince` / `expectedUpdatedAt` request field, compare against current row, return 409 on mismatch. Low-friction to add; would be a single-file change.

### I2. BAML eval pass-bar not enforced for `DraftSupportReply`
**File:** `packages/ai/baml_src/evals/support_reply.eval.ts`
**Spec reference:** §8 — *"`DraftSupportReply`: 20+ cases. Judge model checks: cited chunks used, no fabricated URLs/prices, brand-voice respected, refusal-when-no-coverage."*
**Status:** File contains only 3 `it()` blocks with hand-rolled assertions — no labeled-case array, no judge-scoring loop, no accuracy threshold check. By contrast `support_intent.eval.ts` has the proper structure (30 cases, ≥90% intent + ≥85% sensitivity enforced via `expect(...).toBeGreaterThanOrEqual`).
**Required fix:** Expand to a `cases: Array<{...}>` table with ≥20 entries, run each through a judge model (or assertion table), compute accuracy, enforce pass-bar in code so CI fails when the LLM regresses.

### I3. Slack signature verification re-stringifies parsed body
**File:** `apps/api/src/routes/webhooks-slack.ts` (call to `verifySlackSignature` with `JSON.stringify(request.body)`)
**Risk:** Slack's HMAC is computed over the raw HTTP body bytes. The handler stringifies Fastify's parsed object, which can produce different bytes (key ordering, whitespace, trailing-newline behavior) than what Slack sent. In tests this passes because the test sends the same canonical JSON, but a real Slack payload with non-canonical spacing would fail signature check OR (worse) succeed via type coercion in an unintended way.
**Required fix:** Use `@fastify/raw-body` (or similar) to preserve the raw body bytes on the request, then pass `request.rawBody` to `verifySlackSignature` instead of `JSON.stringify(request.body)`. Out of scope for the slice if you're OK with the test-only correctness for now, but document as a known production gap.

### I4. Test matrix coverage gaps (spec §8)
Missing integration tests:
- ❌ Full lifecycle, anonymous (post-orchestration → CSAT)
- ❌ Anonymous → identified upgrade mid-conversation
- ❌ Tiered autonomy branching (3-tier router integration test — only AUTO_REPLY happy path exists)
- ❌ Timeout resolver full lifecycle (processor unit-tested only)

Missing unit tests:
- ❌ Widget Web Component happy-dom test (theming, SSE rendering, CSAT click)

Missing E2E tests (all 5 per §8):
- Customer happy path · Customer escalation · Agent inbox · Widget theming preview · KB authoring

Missing perf gate:
- kbIngestion 50-page sitemap < 60s

**Suggested resolution:** File a follow-up issue "Support Platform — test coverage backfill" with these items. Not blocking merge of the existing PRs, but the spec was explicit about these tests and they should land before `main` is considered production-ready.

### I5. Spec-vs-impl path divergence (KB module)
**Spec §5:** `apps/api/src/routes/knowledge.ts` + `apps/web/src/app/(admin)/admin/support/knowledge/`
**Impl:** `apps/api/src/routes/kb-sources.ts` + `apps/web/src/app/(admin)/admin/kb/sources/`
**Rationale:** Recon during Slice 2 discovered Sid Mathur's pre-existing `/admin/kb/page.tsx` (935-line monolith). The slice 2 plan deliberately co-located new source pages alongside the existing module rather than fragmenting KB UI across `/admin/kb/` and `/admin/support/knowledge/`. Functionally complete; just diverged from the spec's naming convention.
**Suggested resolution:** Update the spec section §5 to document the actual paths (one-line edit). No code change needed.

### I6. `resolveConversation` duplicated between api and worker
**Files:** `apps/api/src/lib/resolveConversation.ts` + `apps/worker/src/lib/resolveConversation.ts`
**Rationale:** Slice 4 commit `e8fe53e` deliberately duplicated the chokepoint to break a circular workspace dep (api → worker existed from slice 1's inline shim; adding worker → api for the timeout classifier created a cycle). The duplication risk is real — semantic drift if one side changes.
**Suggested resolution:** Extract `resolveConversation` to `packages/ai/src/support/resolveConversation.ts` (already a downstream package both apps depend on) OR a new `packages/support-core/` package, eliminating the duplication and the dep cycle simultaneously. Estimated effort: 1-2 hours. File as follow-up.

---

## Minor findings (track but don't block)

### m1. `as any` and `as unknown as` casts (3 occurrences)
- `(request as any).clerkUserId` in `support-widget-config.ts` and `kb-sources.ts` — Fastify type doesn't include the Clerk-injected user ID. Consistent with pre-existing repo pattern but worth augmenting `FastifyRequest` declaration once.
- `member as unknown as MemberWithTier` in `supportOrchestration.ts` (`loadCustomer360`) — standard Prisma include-relation narrowing.

### m2. BAML eval CI integration
The 3 BAML eval files exist with `beforeAll` guards that fail loudly when `AZURE_OPENAI_API_KEY` is missing — correct policy. But `.github/workflows/ci.yml` only runs `pnpm test` (smoke + integration). No CI step calls `pnpm test:baml`. The evals have never run against a real LLM in CI. Add a job that runs `pnpm test:baml` with the Azure secret as a CI secret.

### m3. `EVENT_TO_TRIGGER_KEYS` mapping doesn't have its own test
The Slice 4 update extended `EVENT_TO_TRIGGER_KEYS` with `'cx.ticket_resolved' → ['cx.ticket_resolved']`, but the matching Campaign trigger key lookup path isn't covered by a dedicated test (the existing test only asserts the entry exists). The integration that actually fires loyalty event → campaign trigger relies on the existing loyalty processor's behavior, which we don't re-test. Acceptable trust-but-verify — production validation will catch regressions.

### m4. Spec + Slice 1 plan landed on `main` only
Both commits (`cb962f7` spec, `37625a0` slice 1 plan) are direct children of baseline `551deefe` on main. The slice-1 branch was created from `origin/main` *before* the spec was pushed, so the spec and slice-1 plan are not in the slice 4 working tree. PRs reference them via commit SHA. Process gap, not a code gap — but worth noting in a retrospective so future spec-then-implement cycles push the spec to origin before branching.

### m5. `embed/src/theme.ts` and `embed/src/api-client.ts` not split out
Spec §5 listed these as separate files; impl absorbed them into the single `ceq-support-chat.ts` bundle. Acceptable for IIFE bundling and avoids artificial file fragmentation — but worth a comment in the spec if you want it codified.

---

## Strengths

1. **Architecture decisions held under pressure.** Every locked decision in spec §2 made it into the implementation: tiered autonomy via `actionMode`, anonymous-first, KB chunk-level RAG, hybrid resolution detection, full design-system widget customization, evolve-in-place pattern. No scope creep into a new microservice or new framework.

2. **The hero loop actually closes.** Customer 👍 → CSATResponse + status RESOLVED → `cx.ticket_resolved` to loyaltyEvents queue → Campaign with `triggerType: 'cx.ticket_resolved'` fires (mapping added to `EVENT_TO_TRIGGER_KEYS`). This was the whole point of the slice and it's wired end-to-end.

3. **Tenant boundary enforcement is rigorous in the orchestrator.** pgvector retrieval filters by brandId; integration test in `support-orchestration.integration.test.ts` explicitly asserts brand A's orchestration never retrieves brand B's chunks.

4. **Memberid-gated loyalty emit.** `resolveConversation` correctly skips the `cx.ticket_resolved` emit when `memberId` is null — anonymous resolutions don't trigger phantom point awards.

5. **Per-conversationId ordering.** Redis `SETNX/PX/NX` lock with random UUID + try/finally release. Correct, test-covered, drains under contention.

6. **HNSW index drift handled per migration.** Every migration that touched `kb_chunks` includes the `DROP INDEX ... CREATE INDEX ... USING hnsw` recreate block with an explanatory comment. The Prisma `Unsupported(vector)` quirk is documented in the migrations themselves.

7. **CSAT idempotency is honest.** Unique constraint on `CSATResponse.conversationId`, second submit returns 200 with original rating, no double-emit of loyalty events.

8. **Anon-flow correctness.** Cookie `ceq_anon_id` with 365-day max-age + SameSite=Lax, `X-Brand-Id` header replaces Bearer, `anonAllowed` gate per `SupportWidgetConfig`. Bearer flow remains intact for legacy two-tag embeds.

9. **BAML retry policy correctly applied to both intent + reply + resolution** via the `ExponentialBackoff` retry policy in `clients.baml`. Spec said 1s initial; impl uses repo-standard 300ms. Acceptable variance.

10. **Bundle size discipline on the widget.** Web Component grew from 402 → ~880 lines (16.47 KB minified, 5.32 KB gzip) including all of slice 3 + slice 4 + the `window.CEQ` queue. Single IIFE file, no runtime deps.

---

## Decision and next steps

### Decision: REQUEST CHANGES

**Blocking (must fix before merge):**
1. **C1** — Slack thread cross-brand leakage fix (~30 minutes).

**Strongly suggested before merge:**
2. **I1** — Optimistic concurrency check on agent reply route. Or file an issue and document the known race.
3. **I3** — Use `request.rawBody` for Slack HMAC verification, not `JSON.stringify(request.body)`. Or document as known production gap.
4. Add an integration test for the C1 fix (cross-brand Slack thread injection rejected).

**File as follow-up issues (don't block):**
5. **I2** — Expand `DraftSupportReply` eval to 20+ cases with enforced pass-bar.
6. **I4** — Backfill missing test matrix items (anon lifecycle, identified upgrade, tiered routing, timeout integration, 5 E2E, sitemap perf gate, widget Web Component happy-dom).
7. **I6** — Collapse the duplicated `resolveConversation` by moving it into a shared package.
8. **m2** — Wire `pnpm test:baml` into CI with the Azure secret.

### Recommended merge order

1. Fix **C1** on the slice 4 branch (`feature/issue-369-support-revamp-slice-4`) — push to PR #370.
2. Optionally fix **I1** + **I3** on the same branch — push to PR #370.
3. Land PR #363 (Slice 1 — foundational) → PR #366 (Slice 2) → PR #368 (Slice 3) → PR #370 (Slice 4) in order.
4. File the 4 follow-up issues identified above.
5. Address spec **§5 path divergence** (I5) and process **m4** in the retrospective.

---

## Phase scorecard

| Phase | Status | Notes |
|---|---|---|
| 1. Issue + evidence loading | ✅ | Spec at `cb962f7`, 4 PRs + follow-ups identified |
| 2. RFC completeness check | ⚠ | 92% (78/85). Critical gaps: 0 (KB path divergence is documented, not a gap) |
| 3. Code review | ❌ | 9/10 targets compliant; **1 critical defect** (C1) |
| 4. Test matrix | ❌ | ~70% (23/33). DraftReply BAML pass-bar + 4 integration + 5 E2E + Web Component unit missing |
| 5. Common-error patterns | ✅ | 3 minor `as any` casts, no skipped tests, no hardcoded secrets, no stray console.log |
| 6. Validation gate | ✅ | build/typecheck/lint/smoke/integration all green; BAML evals env-blocked locally |
| 7. Architecture compliance | ✅ | All §2 decisions honored; 2 documented deliberate divergences |
| 8. Risk mitigation | ⚠ | Most §7 mitigations implemented; agent-collision optimistic lock missing (I1); Slack HMAC raw-body gap (I3) |
| **Overall** | **REQUEST CHANGES** | **1 critical + 3 important must be addressed before merge** |
