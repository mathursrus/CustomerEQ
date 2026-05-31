---
author: manohar.madhira@outlook.com
date: 2026-05-28
synthesized:
---

# Postmortem: URL defaults wrong across worker / dev page / OAuth / loyalty webhooks; email logo unsized; self-serve sent-count missing — Issue #540

**Date**: 2026-05-28
**Duration**: Single session (post-#531 merge), spanning initial filing → 3 user-review rounds → final scope-expanded PR
**Objective**: Fix three production bugs reported after #531 landed — broken survey-link host in email, unsized brand logo in Outlook, and `Survey Sent: N` excluding self-serve recipients.
**Outcome**: Success on the user-visible fix, but with two substantive corrections that the user caught before merge. The retrospective is dominated by the corrections, not the work that landed cleanly.

## Executive Summary

The initial PR fixed three symptoms correctly *as named* but missed two issues a reviewer with broader context would catch immediately: (1) the worker-side fix would have actively broken production because the worker isn't the dispatcher in inline mode (the API is), and (2) `app.customereq.example` was one instance of a class of wrong-host defaults — five more lived in `developer.ts`, `public.ts`, `oauth.ts`, and `loyaltyEvents.ts`. The user surfaced both gaps through three targeted questions; I should have run those audits myself before claiming the fix was done.

## Quick RCA Card

**What failed**: I treated the three reported findings as the boundary of the work and didn't (a) verify the runtime topology where the broken code actually runs in production, or (b) sweep for the class of bugs the user-visible symptom belonged to. Both are well-defined "before you call it fixed" steps.

**Impact**: Two near-misses. (1) If the PR had merged as originally written, the API process in `QUEUE_MODE=inline` would have thrown on every managed-email send — strictly worse than the placeholder bug, because the placeholder at least dispatched (with broken links) while the throw blocks the send entirely. (2) The Developer page would have continued to display `https://api.customerEQ.io` and `http://localhost:3000` indefinitely; the user would have hit those bugs separately later.

**What should have happened**: Before claiming F1 was fixed, I should have checked `az containerapp show -g customereq-prod -n customereq-worker --query "properties.template.containers[0].env"` AND the API container's env, traced the code path back to whichever process actually runs `dispatchManagedEmailSend` in prod (CLAUDE.md *explicitly says* the inline path invokes processor logic in-process from the API), and grepped the codebase for the URL-default anti-pattern `?? ['"]https?://` to find every instance of the class.

**What changes next time**: Two concrete steps added to my pre-submission checklist:
1. **Topology verification before backend fix**: when fixing a worker / API / shared-package file, confirm which process actually runs the code path in the target environment. For this repo specifically: `QUEUE_MODE=inline` means the API runs the processor; `QUEUE_MODE=redis` means the worker does. Always check both env vars before claiming a fix is sufficient.
2. **Class-sweep before declaring a fix complete**: when the user-visible symptom matches a class of bugs (URL default, env-var-with-bad-fallback, shape-inference roundtrip, etc.), grep the class across the codebase and audit findings before merging. The grep takes 30 seconds; the alternative is multiple PRs to fix the same class.

**Example**: F1 (`apps/worker/src/processors/managedEmailSend.ts:176`) initial fix set `NEXT_PUBLIC_FRONTEND_URL` on `customereq-worker` only. User asked: "When the mode is inline — customereq-worker is not involved. How would this resolve the P0?" Production `QUEUE_MODE=inline` confirmed; CLAUDE.md `### 3.2. API Layer` had the answer — I'd already read it during the #531 work.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: `docs/architecture/architecture.md` § "Cross-Cutting Patterns" — two updates:
1. **Extended** the existing #420 email-template entry with the `<img>` width-attribute requirement for Outlook desktop's Word renderer.
2. **Added** a new entry "Runtime-critical config — single in-repo source of truth + per-app declarative env vars, never silent placeholder" *(Issue #540)*. The original draft titled this "loud-fail at first use, never silent placeholder" but the user's Q3 pushed back: a known-correct default is the safer pattern when the codebase already knows the host. Final form captures: shared constant as fallback + per-deploy env-var override + warn log on drift. Anti-patterns explicitly named (placeholder hosts as passive security concern; localhost in prod defaults; hand-written `'https://customereq.wellnessatwork.me'` literals scattered across files).

**Changes Made**: Documented the new shared-constants source-of-truth pattern (`PUBLIC_FRONTEND_HOST` / `PUBLIC_FRONTEND_URL` / `PUBLIC_ADMIN_UI_URL` / `PUBLIC_API_URL`); the paired IaC requirement (set the env var on EVERY consuming container app); the lazy-resolver shape for testability; the demo-storefront exception (zero workspace deps — simulates a 3rd-party storefront, the deliberate non-coupling is documented inline); and the IaC tech debt callout (the deploy.yml mutation pattern needs declarative replacement — separate ticket).

**Rationale**: The reuse rule is the architectural insight. Any future code that needs the public host should consume the shared constant, set the matching env var declaratively on every consuming Container App, and never default to a placeholder. The next implementer should never have to re-discover this on a production incident.

**Updated in PR**: Yes — commits on `feature/540-...` branch on PR #541.

## Timeline of Events

### Phase 1: Initial 3-finding scope
- [done] User reported 3 production findings post-#531 merge (broken email links, logo unsized, sent-count missing).
- [done] Investigated each via Azure CLI + codebase grep.
- [done] Verified `customereq-worker` had no `NEXT_PUBLIC_FRONTEND_URL` env var → identified F1 root cause as the placeholder fallback at `managedEmailSend.ts:176`.
- [missed] Did NOT verify `customereq-api`'s env vars. Did NOT check `QUEUE_MODE` value.
- [done] Filed issue #540 with three findings.
- [done] Ran FRAIM `issue-preparation` → worktree at `/c/Github/mathursrus/CustomerEQ - Issue 540`, branch pushed.

### Phase 2: First implementation (initial PR)
- [done] `implement-scoping` work-list, 9-file scope.
- [done] `implement-repro` — 5 worker unit tests + 3 renderTemplate tests + 3 integration tests, all failing for the right reason pre-fix.
- [done] `implement-code` — extracted `resolveFrontendBaseUrl()` that throws on missing env; updated `<img>` template; added SELF_SERVE mint-time `sentCount` bump.
- [done] All targeted tests passing; typecheck + build green.
- [done] Phase-by-phase through validate / security-review / regression / quality / completeness / architecture-update / submission.
- [done] PR #541 opened as Draft; user signaled "proceed."

### Phase 3: User review round 1 — three corrections
- **Q1 (inline-mode gap)**: I had set the env var only on the worker. User flagged: "When the mode is inline — customereq-worker is not involved." Verified `az containerapp show` → both API and worker have `QUEUE_MODE=inline`, neither has `NEXT_PUBLIC_FRONTEND_URL` set. **My fix would have made the API process throw on every send post-deploy.** Strictly worse than the placeholder bug.
- **Q2 (where else is the URL wrong?)**: I initially grepped one URL at a time. User pushed back: "Why are you going URL by URL, instead of looking for all places where customereq is referred and matches a URL pattern?" Ran the comprehensive sweep — found 4 more wrong-host defaults (developer.ts × 2, public.ts, oauth.ts × 2, loyaltyEvents.ts).
- **Q3 (why throw instead of default?)**: User asked for the known-correct default to be the failover. Rationale aligned with the existing sender-domain fallback at `distributionBatches.ts:605` — which I had read during the analysis but had not pattern-matched onto. Switched resolver from throw to default + warn.

### Phase 4: Scope expansion (user-confirmed)
- [done] Added `PUBLIC_FRONTEND_HOST`, `PUBLIC_FRONTEND_URL`, `PUBLIC_ADMIN_UI_URL`, `PUBLIC_API_URL` to `packages/shared/src/constants.ts`.
- [done] Refactored 5 additional consumer files (developer.ts, public.ts, oauth.ts × 2 sites, loyaltyEvents.ts) plus the original 3 (distributionBatches.ts sender-domain, admin-brand-profile.ts SUPPORT_EMAIL_FALLBACK, managedEmailSend.ts).
- [done] Extended IaC: API gets 4 env vars (+ normalized `CEQ_ADMIN_UI_BASE_URL`), worker gets 2.
- [done] Filed follow-up issue #542 (bind custom API domain) per user's scope-A decision.
- [done] Documented the demo-storefront exception inline (zero workspace deps — intentional decoupling).
- [done] User asked to update issue + PR titles to match the revised scope — completed.

### Phase 5: Approval and continuation
- [done] User signaled "proceed."
- [in progress] Retrospective (this document).
- [pending] `work-completion` job.

## Root Cause Analysis

### 1. **Primary Cause — incomplete topology verification before claiming a fix**

**Problem**: I targeted the file path (`apps/worker/src/processors/managedEmailSend.ts`) and assumed the worker container was the dispatcher. I did not verify which process actually invokes `dispatchManagedEmailSend` in production. CLAUDE.md `§ 3.2 API Layer` and `§ 3.3 Worker Layer` make the inline-mode behavior explicit: in `QUEUE_MODE=inline`, the same processor logic runs in-process from the API via `apps/api/src/queues/bullmq.ts:scheduleInline`. I had READ this during the #531 work — but did not apply it.

**What drove it**: Convenience heuristic — "file lives in `apps/worker/`, so it's the worker." This conflates the *source location* with the *runtime location*. In a queue-mode-flexible architecture, the source can run in either process depending on mode. The validated-patterns entry from #531 work mentioned `pino`-structured logging at the worker, which reinforced the worker-as-dispatcher mental model without re-reading the inline-runtime carve-out.

**Corpus conflict**: None directly — no learning file endorsed "trust file path = trust runtime location." But the absence of a "verify runtime topology before backend fix" preference / mistake-pattern entry is what let me skip the step. This retrospective creates the raw signal for one.

**Impact**: Two-round PR cycle. Worse: had the user not asked Q1, post-deploy would have hit a hard outage (API throws on every send instead of placeholder-but-dispatching).

### 2. **Secondary Cause — went URL-by-URL instead of running the class sweep**

**Problem**: When the user asked "what other areas use the URL," I ran targeted greps for specific terms (`customereq.wellnessatwork.me`, then `customereq.io`, then `customereq-web`) instead of one comprehensive sweep across the URL-default class (`?? ['"]https?://` + `||\s*['"]https?://`). Took the user pushing back to course-correct.

**What drove it**: Optimizing for "fast specific answer" instead of "complete audit of the class." Each URL appears in the search results in <1 second, so the sequential approach FELT efficient. It wasn't — it missed `api.customerEQ.io` (the highest-visibility bug in the bunch, surfaced on every Developer-page load) because I didn't have that exact host in mind to grep for.

**Corpus conflict**: My **validated-pattern** `merit over ease` from prior work should have applied here — class-sweep is the merit choice even though it returns more results. I did not invoke it. The reasoning gap: I treated "merit over ease" as applying to design-choice decisions (which fix shape to pick) but not to investigation-method decisions (which grep to run). They're the same heuristic.

**Impact**: An additional review round. The user's question pattern (Q1 → Q2 → Q3) is the structural review pattern I should have applied to myself before claiming the fix was done.

### 3. **Tertiary cause — defaulted to "throw" when the existing pattern was "default + warn"**

**Problem**: First implementation made `resolveFrontendBaseUrl()` throw on missing env. User pushed back: we know the canonical host — why fail closed when we can fail safely? Switched to default + warn log, matching the existing sender-domain fallback at `distributionBatches.ts:605`.

**What drove it**: A bias toward "loud-fail" thinking, possibly carried over from "fail fast" testing patterns. I had READ the sender-domain fallback while writing the work-list — it's literally the closest neighbor in the same file — but did not pattern-match it onto my F1 design.

**Corpus conflict**: This one is closer to a real signal. The existing repo pattern (warn + canonical-default) was the established convention for this exact problem class; I introduced a divergent throw-pattern without justification. Future preference: when there's an existing pattern *in the same file* for the same problem class, match it unless I can articulate a specific reason to diverge.

**Impact**: User-visible course correction. Test assertions had to be rewritten (5 worker tests changed from "expects throw" to "expects default").

## What Went Wrong

1. **Failed to verify runtime topology before fixing.** F1 fix would have actively broken production. Caught by user Q1; my fault for not checking.

2. **Went URL-by-URL instead of class-sweep.** Found `api.customereq.io` only when user asked. Multiple review rounds.

3. **Defaulted to "throw" without matching existing repo convention.** Switched to default + warn after user feedback. Test rework required.

4. **Did not flag the IaC mutation-vs-declarative tech debt proactively.** User asked: "Why would we run ad-hoc commands on Azure container? Shouldn't they be through code somewhere on new build?" The repo has 7 inline `az containerapp update` mutations in `.github/workflows/deploy.yml`. I followed the existing pattern (correct for this PR) but should have flagged the tech debt up-front so the user wasn't surprised.

5. **Didn't verify @customerEQ/shared was rebuilt between source change and test run.** Lost one debugging cycle on stale dist. The monorepo's TypeScript-emitted dist files need an explicit `pnpm --filter @customerEQ/shared build` after constant changes; the consumers reload from the new dist on next run.

## What Went Right

1. **Strong test-first repro pattern.** All three findings had failing tests committed before the fix (5 + 3 + 3 = 11 new failing tests). Schema-layer / unit-layer / integration-layer coverage was honest about what each test asserted.

2. **Diagnosis was direct from production evidence.** Azure CLI + container env-var queries surfaced the `customereq-worker has no NEXT_PUBLIC_FRONTEND_URL set` finding in one round. The `redis_unavailable` log line from #531 work was reused as evidence for `QUEUE_MODE=inline`.

3. **Demo-storefront exception was correctly identified.** When I refactored the three demo-storefront page files to import `PUBLIC_FRONTEND_URL`, I noticed `apps/demo-storefront/package.json` has zero workspace deps. Reverted with an inline-comment justification rather than forcing the dep. The demo simulates a 3rd-party storefront integration — coupling it would defeat the simulation.

4. **Follow-up issue (#542) filed with proper scope.** Custom-domain binding is real work (DNS + cert + OAuth re-registration) that warrants its own ticket. The follow-up issue lists acceptance criteria for the custom domain, the env-var updates downstream, and the OAuth coordination requirement.

5. **Architecture doc entry survived the user feedback round.** Initial entry title was "loud-fail at first use" → final form is "single in-repo source of truth + per-app declarative env vars, never silent placeholder." The user's Q3 directly shaped the final reusable pattern; documenting it means the next implementer inherits the *correct* version.

## What I Almost Did Wrong But Caught

1. **Almost shipped the demo-storefront refactor.** Initial pass added `import { PUBLIC_FRONTEND_URL } from '@customerEQ/shared'` to three demo-storefront files. Caught when reading `apps/demo-storefront/package.json` — saw the empty `dependencies` block and the `@customerEQ/config` workspace dep only in `devDependencies` (test config). Reverted with inline comments. If I had shipped it, the build would have broken (missing workspace dep) or — worse — introduced a coupling that contradicts the demo's design intent.

2. **Almost left CEQ_ADMIN_UI_BASE_URL pointing at the legacy Azure FQDN.** The env var was set in prod to `https://customereq-web.salmonsea-4eb14bdc.eastus.azurecontainerapps.io`. After consolidating to `PUBLIC_ADMIN_UI_URL`, I realized the OAuth admin-UI redirect should use the friendly URL since the web container accepts both. Added `CEQ_ADMIN_UI_BASE_URL=https://customereq.wellnessatwork.me` to the API IaC step so the env value matches the new code default.

## Where Past Learnings Actually Fired

1. **`Draft PR until work-completion`** — fired correctly. PR #541 opened as `--draft`. After scope expansion, stayed Draft. Will flip to Ready in work-completion phase.

2. **`Validate phase must run build`** — fired. Ran `pnpm turbo run build --concurrency=1` after each scope expansion. Caught no issues, but confirmed the lint pass for the web app every time.

3. **`Don't build against live dev server`** — fired by inference. I never started `pnpm dev`; ran tests in isolation only.

4. **`One PR per issue (Rule 26)`** — fired during the scope-expansion discussion. The user asked to fold F4-F9 into #540 (not file new issues) — confirmed alignment with Rule 26. Filed #542 as a *separate* follow-up because it has its own ACs (DNS + cert + OAuth coordination), not because it shares the #540 issue surface.

5. **`Copy .env from main worktree`** — fired via `prep-issue.sh` automation. The 4 env files were copied automatically before `pnpm install`.

6. **`merit over ease`** — fired during the fix-shape decision (chose shared constants + IaC step over inline literal patches), but **did not** fire during the investigation-method decision (sequential greps vs comprehensive sweep). Calling that out as a refinement signal for future synthesis: the heuristic applies to BOTH the design and the investigation.

## Lessons Learned

1. **"Where does this code actually run in production?" is a non-negotiable pre-fix check.** When a backend fix changes runtime behavior (worker URL, throw-on-missing, etc.), verify the runtime topology against the target environment BEFORE claiming the fix is sufficient. For this repo specifically: always check `QUEUE_MODE` on the relevant Container Apps and trace the code path through `apps/api/src/queues/bullmq.ts:scheduleInline` if inline.

2. **When fixing one instance of a class of bugs, sweep the class.** For URL defaults: `?? ['"]https?://` + `||\s*['"]https?://` greps surface every site in 1 query. For env-var fallback patterns, shape-inference roundtrips, denormalized-counter increments — same pattern. The 30-second sweep replaces multiple PR rounds.

3. **Match existing patterns in the same file before introducing new ones.** The sender-domain fallback at `distributionBatches.ts:605` was the working convention for this exact problem class. Diverging from it (throw vs default+warn) without rationale was the wrong call. Future preference: when there's a precedent within 5 lines of where I'm working, match it unless I can articulate a specific reason to diverge.

4. **Flag tech-debt patterns proactively when following them.** I correctly followed the existing `az containerapp update --set-env-vars` pattern in `deploy.yml`. But the user reasonably asked "why is this mutation-based instead of declarative?" I should have flagged the IaC tech debt up-front — naming what I was doing AND what the right long-term answer is — so the user wasn't put in the position of asking.

5. **`@customerEQ/shared` needs an explicit rebuild between source change and consumer test.** The monorepo's `dist/` doesn't auto-rebuild on source change. Add to my routine: any change to `packages/shared/src/**` triggers `pnpm --filter @customerEQ/shared build` before running consumer tests.

6. **The user's question pattern (Q1: gap? Q2: where else? Q3: why this approach?) is the structural review I should pre-apply.** Before declaring a fix complete: (Q1) does this work in every runtime topology this code path lives in? (Q2) what other instances of this class exist in the codebase? (Q3) is the chosen approach matching existing convention, or am I diverging without rationale? Three minutes of self-review pre-empts multiple PR rounds.

## Agent Rule Updates Made to avoid recurrence

1. **Architecture pattern entry**: "Runtime-critical config — single in-repo source of truth + per-app declarative env vars, never silent placeholder" (`docs/architecture/architecture.md`). Documents the resolver shape, the paired IaC requirement, the anti-patterns (placeholder hosts, localhost-in-prod, scattered literals), and the demo-storefront exception.

2. **No FRAIM rule files modified for this issue.** The lessons above are candidates for `sleep-on-learnings` to synthesize. Most-actionable candidates for synthesis: the runtime-topology-check and the class-sweep heuristic.

## Enforcement Updates Made to avoid recurrence

1. **Filed chore #542** (custom API domain binding) so the temporary legacy-FQDN `PUBLIC_API_URL` doesn't become permanent by inertia.

2. **Architecture-doc anti-pattern callout** names "placeholder hosts as passive security concern" and "hand-written `'https://customereq.wellnessatwork.me'` literals scattered across files" — both are searchable strings the next code reviewer can grep for.

3. **Integration + unit test coverage** for the new constants: schema-level tests assert derivation invariants (`PUBLIC_FRONTEND_URL === https://${PUBLIC_FRONTEND_HOST}`), regex tests assert `PUBLIC_API_URL` is well-formed AND not the previously-broken placeholder. Any future regression that reintroduces the placeholder would fail these tests.

4. **IaC step expansion** captures both API and worker — future env-var additions will go in the same step pattern, and the inline comments document the QUEUE_MODE rationale so the next implementer sees why both containers are configured.
