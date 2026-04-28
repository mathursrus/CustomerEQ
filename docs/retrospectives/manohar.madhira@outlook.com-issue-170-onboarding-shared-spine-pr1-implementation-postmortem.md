---
author: manohar.madhira@outlook.com
date: 2026-04-27
synthesized:
---

# Postmortem: Onboarding Shared Spine — PR 1/6 Implementation — Issue #170

**Date**: 2026-04-27
**Duration**: Single multi-session day (FRAIM `feature-implementation` Phases 1, 3–13 across one calendar day; Phase 13 closes at this writing)
**Objective**: Land the foundation slice of the #170 onboarding shared spine — Prisma schema additions + single migration, the `IdentityProvider` interface + `ClerkIdentityProvider` impl + ESLint enforcement, ADR 0004, and architecture-doc updates. Self-contained PR with no user-visible behavior; PRs 2–6 build on top.
**Outcome**: Success — PR #197 opened, one reviewer feedback round, all 3 comments addressed. Commit `af3785d` ready for re-review and merge. One follow-up issue filed (#198 for `survey_themes` schema-vs-migrations drift surfaced during test-plan run).

## Executive Summary

PR 1 of a user-approved 6-PR slicing of issue #170. Shipped:

- 3 new Prisma enums (`OrgSizeCategory`, `UseCasePath`, `OnboardingStep`) + `APPLICATION` value on `ExternalSourceType`
- `Brand` field additions (`siteDomain`, `logoUrl`, `defaultThemeId`, `sizeCategory`)
- `ApiKey.externalSignalSourceId` FK
- 2 new models — `OnboardingState` (1:1) and `OnboardingActivationEvent` (append-only)
- Single migration with idempotent backfill
- 13-method `IdentityProvider` interface (was 14 in initial draft; `signInUser` removed in Round 1 per reviewer choice)
- `ClerkIdentityProvider` implementation with the documented cleanup contract on `createUserWithOrg`, svix-based `parseWebhook` (rawBody contract surfaced and fixed during security review), and Clerk-mediated OAuth
- Fastify decoration via `apps/api/src/plugins/identityProvider.ts`
- ESLint `no-restricted-imports` rule scoped to `apps/api/src/**/*.ts` with single override for the impl file; refactored `auth.ts` and `members.ts` off direct `@clerk/*` imports
- ADR 0004 consolidating OD-4 (funnel) + OD-5 (abstraction); architecture.md updated with plugin + model rows + ADR table entry
- Full evidence package (`docs/evidence/170-feature-implementation-evidence.md`) including security review section, both traceability matrices, regression/quality reports, and phase-completion log

The PR was approved on Round 1 with 3 substantive comments — one PR-level decision (`signInUser` interface fate + drift-fix issue filing) and two inline `no-console` warnings on the orphan-cleanup logs. All 3 addressed in commit `af3785d`. Two follow-up surface areas were captured for future PRs: per-route `returnTo` validation (PR 3, SEC-170-002) and `emitActivationStep` metadata key allowlist (PR 4, SEC-170-003).

## Architectural Impact

**Has Architectural Impact**: Yes. Already landed in this PR per the FRAIM `implement-architecture-update` phase.

**Sections updated** (in this PR):

- `docs/architecture/architecture.md` §4.2 (Fastify Plugins) — `auth` row now reads "delegates to `fastify.identityProvider.getSession()`"; new `identityProvider` decorator row added.
- `docs/architecture/architecture.md` §4.4 (Database Models) — `OnboardingState` and `OnboardingActivationEvent` rows added.
- `docs/architecture/architecture.md` §11 (ADR table) — ADR 0004 row added with link to the file.
- `docs/architecture/adr/0004-onboarding-activation-funnel-and-identity-provider.md` (new) — consolidates OD-4 + OD-5 per PR #196 Round 2 reviewer guidance.

**Updated in PR**: Yes — landed in PR #197 itself (commits `2a41a62` and `af3785d`).

## Timeline of Events

### Phase 1: implement-scoping
- ✅ Re-read RFC + work-list inputs.
- ✅ Authored `docs/evidence/170-implement-work-list.md` with file-by-file enumeration (~65 file modifications enumerated).
- ✅ **Phase Splitting Candidate triggered** at >15-file threshold; surfaced 4 decisions to user with `← recommended` defaults; user approved 6-PR slicing (option 1 in the recommendation set with both PR 2 and PR 3 split into API-only + UI-only) plus `keep Clerk catch-all`, `flat API routes`, and `bundle ADR 0004 + arch.md updates with PR 1`.

### Phase 3: implement-tests
- ✅ Authored `apps/api/src/auth/identity-provider.ts` (interface, originally 14 methods).
- ✅ Authored `apps/api/src/auth/clerk-identity-provider.test.ts` (~30 unit tests covering happy paths, partial-failure cleanup, OAuth, parseWebhook signature verification, missing-headers, getUser found/not-found, all wrapper methods).
- ✅ Rewrote `apps/api/src/plugins/auth.test.ts` to mock the abstraction instead of `@clerk/backend` directly.

### Phase 4: implement-code
- ✅ `packages/database/prisma/schema.prisma` updated with all schema additions.
- ✅ `packages/database/prisma/migrations/20260427000000_onboarding_first_run/migration.sql` authored with single migration + idempotent backfill (`ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS`).
- ✅ `apps/api/src/auth/clerk-identity-provider.ts` — full impl using `createClerkClient` + `Webhook` (svix); 3-step `createUserWithOrg` cleanup contract.
- ✅ `apps/api/src/plugins/identityProvider.ts` — Fastify wiring decorating `fastify.identityProvider`.
- ✅ `apps/api/src/plugins/auth.ts` refactored to call `fastify.identityProvider.getSession`; `apps/api/src/routes/members.ts` similar refactor on the optional Clerk-token verification path. Both files now have zero direct `@clerk/*` imports.
- ✅ `eslint.config.js` — added `no-restricted-imports` rule scoped to `apps/api/src/**/*.ts` with override for `clerk-identity-provider.ts`.
- ✅ `apps/api/package.json` — added `svix ^1.31.0`.
- ✅ ADR 0004 + `docs/architecture/architecture.md` updates.

### Phase 5: implement-validate
- ✅ `pnpm build` (turbo) — 10/10 packages clean.
- ✅ `pnpm --filter @customerEQ/api typecheck` — 0 errors.
- ✅ `pnpm lint` — 0 errors; 2 `no-console` warnings on the orphan-cleanup paths in `clerk-identity-provider.ts` (these later got flagged in Round 1 review and fixed via injected logger).
- ✅ `pnpm --filter @customerEQ/api test:smoke` — 310/310 across 28 files.
- ⚠️ One smoke-test failure on first run: `apps/api/src/plugins/auth.test.ts > authPlugin > valid session > returns 401 when session has no orgId (new-user-without-org case)`. Caused by the dev fallback (`NODE_ENV !== 'production'` → tenantKey = userId) reaching the brand-not-found branch instead of the no-org branch. Fixed by setting `NODE_ENV='production'` inside the test for the production-path assertion + adding a separate test for the dev-fallback path.

### Phase 6: implement-security-review
- ✅ Diff-based scan classified `api` + `data-pipeline` surfaces. Ran `owasp-api-top-10-review` + `secrets-in-code-check` + `privacy-and-pii-review`.
- 🔴 **SEC-170-001 (High, fixed in PR 1)** — `parseWebhook` re-stringified the parsed body (`JSON.stringify(rawRequest.body)`) before feeding to `svix.verify`. Svix verifies the exact signed bytes; re-stringified parsed JSON has different bytes (key order, whitespace) — legitimate webhooks would 401. Tightened the interface from `Pick<FastifyRequest, 'headers' | 'body'>` to `{ headers, rawBody: string }`; impl uses raw body directly; 4 test fixtures updated. Validation re-run after fix: typecheck + 310/310 tests pass.
- ⚠️ **SEC-170-002 (Medium, deferred to PR 3)** — `beginOAuth` doesn't validate `returnTo`. Defense-in-depth route-level validation belongs in PR 3.
- ⚠️ **SEC-170-003 (Low, deferred to PR 4)** — `OnboardingActivationEvent.metadata` is unbounded JSON. Helper allowlist in PR 4.
- ✅ **SEC-170-004 (Informational, accepted)** — dev placeholder webhook secret is dev-scoped behind a production throw.
- ✅ Security Review section appended to `docs/evidence/170-feature-implementation-evidence.md` with the full structured report.

### Phase 7: implement-regression
- ⚠️ First full-repo `pnpm test:smoke` run: `@customerEQ/ai` package failed with a Windows file-permission flake during BAML parallel client generation (`os error 5`).
- ✅ Re-ran `@customerEQ/ai` in isolation: 35/35 tests pass.
- ✅ Re-ran full-repo `pnpm test:smoke`: 14/14 packages pass on retry. Classified Environment Issue (BAML's parallel-build temp-file race), not introduced by PR 1.

### Phase 8: implement-quality
- ✅ Hardcoded values: pass (defaults env-overridable; placeholder secret already security-reviewed).
- ✅ Duplicate code: pass (cleanup blocks in `createUserWithOrg` vs. `createOrgForUser` differ by shape — abstraction would be premature at N=2 per project rule #15 either-direction).
- ✅ File sizes: `clerk-identity-provider.ts` ~280 lines / 1 class; under the 500-line / 5-export limit.
- ✅ Architecture standards: clean layer isolation; DI via Fastify decoration; no AI/deterministic blending.
- ✅ UI baseline: N/A (no UI in PR 1).

### Phase 9: implement-completeness-review
- ✅ Feature-requirement traceability matrix (9 spec rows) appended to evidence — PR 1 foundation rows Met; user-observable rows deferred to PRs 2–6 with explicit pointers to the work list.
- ✅ Technical-design traceability matrix (21 RFC rows) appended — all in-scope rows Met; deferred rows explicitly listed.
- ✅ 4 deviations documented at this point: `SurveyTheme` vs RFC's "Theme" naming, `ExternalSourceType` vs RFC's "ExternalSignalSourceType", interface size 14 (work list previously said 11), `parseWebhook` contract tightened from FastifyRequest to rawBody string per SEC-170-001.

### Phase 10: implement-architecture-update
- ✅ No-op (ADR 0004 + arch.md updates already landed in Phase 4).

### Phase 11: implement-submission
- ✅ Commit `80f8563` pushed; PR #197 opened against `main`.
- ✅ Posted top-level evidence-link comment on the PR.
- ⚠️ Initial PR body did not have a clearly-marked "Decisions for the reviewer" block — the `signInUser` decision was buried in the "Deviations surfaced" paragraph. User flagged this ("I don't see where I should confirm the signInUser decision"). Updated the PR body via `gh pr edit` to add a `## Decisions for the reviewer` section with three numbered options + `← recommended`. The reviewer responded within minutes with "go with a)".

### Phase 12: address-feedback (Round 1)
Three substantive feedback items received:

1. **Top-level comment** (4327983046): "For signedInUser - go with a). For SurveyThemes drift, file a separate drift-fix issue." Two distinct decisions in one comment.
2. **Inline review comment** (3148047241, line 72): "CI warns that console statement is unexpected."
3. **Inline review comment** (3148052740, line 96): "CI warns that console statement is unexpected. What is the best way to flag this error?"

Resolution shipped in commit `af3785d`:

- (a) `signInUser` removed from interface + impl + tests; interface now 13 methods; ADR 0004 interface listing updated with rationale.
- (b) Filed [issue #198](https://github.com/mathursrus/CustomerEQ/issues/198) — pre-existing schema-vs-migrations drift on `survey_themes` (surfaced earlier during the test-plan run when `prisma migrate dev` rejected the FK on the shadow DB).
- (c) `console.error` orphan-cleanup logs replaced with an injected logger. Constructor now requires `logger: { error(obj, msg): void }`; the Fastify plugin passes `fastify.log`; tests pass a `vi.fn()`-shaped mock; the existing orphan-cleanup test extended in-place to assert `logger.error` was called with the expected metadata.

Validation post-fix: typecheck pass, lint **0 errors / 0 warnings** (was 2 warnings on this file), tests **308/308** (was 310; −2 for removed `signInUser` cases).

Reviewer approval: "Good to proceed to next step."

### Phase 13: retrospective
- ✅ This document.

## Root Cause Analysis

Three root-cause-style insights from PR 1, in order of cost-to-the-team:

### 1. **Decisions for the reviewer were initially buried in a deviation paragraph instead of surfaced as a numbered options block**

**Problem**: The first PR-body draft (`feat(#170 PR 1/6): …`) mentioned the `signInUser` runtime gap inside a 5-bullet "Deviations surfaced" paragraph: *"`signInUser` impl uses a forced cast over the Clerk SDK; @clerk/backend doesn't expose password sign-in. … **PR 2 decision**: replace with admin-API session create OR remove from interface entirely (recommended …)."* User reasonably asked "I don't see where I should confirm the signInUser decision" — the prose form didn't make it obvious that a reviewer action was needed.

**Impact**: One extra round-trip — user had to ask, agent had to add a `## Decisions for the reviewer` section via `gh pr edit`. Cost was small (~5 minutes). Reviewer answered the moment the structured block was visible.

**Why this happened**: The validated-pattern memory `Decision-points-at-PR-body-bottom format for fast review` is in L1 body. It fired correctly for the implementation-scoping phase (4 pre-execution decisions surfaced as a numbered block; user answered all in one chat turn — that flow worked perfectly). But when authoring the PR body itself, the deviation note seemed sufficient to me, so I didn't reach for the structured-decisions format. The two contexts looked superficially different; the underlying need was the same.

**Lesson**: Any time the PR body contains a phrase like "PR 2 decision:", "decide later", "needs reviewer input", or "X or Y" — that's a structured-decisions trigger. Surface as a numbered block at the bottom with explicit `← recommended` defaults. Even one decision is worth its own block; reviewer scan-reads PR bodies and the prose form is invisible.

### 2. **Pre-existing schema-vs-migrations drift on `SurveyTheme` was undetected until the reviewer ran the test plan**

**Problem**: `SurveyTheme` is in `schema.prisma` and used by `routes/themes.ts` + `routes/surveys.ts` + `apps/web/src/app/survey/[id]/page.tsx`, but no migration ever creates the `survey_themes` table. PR 1's migration tried to add a `Brand.defaultThemeId → SurveyTheme.id` FK constraint; `prisma migrate dev` against a fresh shadow DB rejected the migration with `P1014: The underlying table for model survey_themes does not exist`.

**Impact**: One extra commit (`90a4aee`) to drop the FK from PR 1; one follow-up issue (#198) filed; the `Brand.defaultThemeId String?` column ships without referential integrity in PR 1. Real total cost was small because the workaround is mechanical, but the discovery happened during the reviewer's test-plan run rather than before submission.

**Why this happened**: My Phase 5 validation gate ran `pnpm build / typecheck / lint / test:smoke` — none of those exercise migrations against a fresh DB. I noted in the PR body "*Migration applies on next `pnpm prisma migrate dev` against a running DB*" but didn't actually run it myself. The drift had been latent in the repo for a while; PR 1 was the first migration to reference `survey_themes` from the FK direction, so it was the first to surface the problem.

**Lesson for future PRs in this slice**: when a PR adds a Prisma migration, the validation gate must include `prisma migrate dev` against a real (Docker-backed) DB before submission, not just the static checks. The `pnpm test:integration` and `pnpm test:e2e` scripts already imply DB connectivity; migrations are a strict prerequisite. **Action**: add to the work list as a pre-submission checkbox for any PR with a migration delta.

### 3. **Confidence "high" on the `signInUser` runtime path despite a known forced-cast**

**Problem**: The PR 1 impl used `(this.client as unknown as { signIns: { create: ... } }).signIns.create(...)` — a forced cast that bypasses TypeScript type checking. Tests passed via mocks because the mock satisfies the cast shape. But `@clerk/backend` doesn't actually expose a `signIns.create` admin method (sign-in is browser-driven via Clerk.js). At real runtime, `this.client.signIns` is undefined and the call would throw.

I flagged this in the PR body's "Deviations surfaced" section: *"Tests pass via mocks but runtime would fail. PR 2 decision: replace with admin-API session create OR remove from interface entirely (recommended)."*

**Impact**: Reviewer chose option (a) — remove. PR 1 would have shipped a broken interface method had they not. Cost: small (Round 1 fix removed the method cleanly), but an example of "tested via mocks ≠ tested in production".

**Why this happened**: The interface was authored in Phase 3 (test-driven) where `signInUser` made sense as a method (sign-in is a normal account-lifecycle operation). The implementation gap surfaced in Phase 4 when I tried to write the impl and discovered the SDK doesn't support it. At that point, the right move would have been to remove the method from the interface immediately. I instead used a forced cast, made the tests pass, and surfaced the decision in the PR body — pushing the resolution to the reviewer.

**Lesson**: when the impl phase reveals that an interface method can't be cleanly implemented, fix the interface in the same phase rather than shipping a forced cast and deferring the decision. The pattern "tests pass via mocks; runtime would fail" is a self-flag — same family as the SEC-170-001 (parseWebhook) finding which I caught and fixed during security review. The signInUser case I should have caught and fixed during implement-code.

**Related validated pattern that did NOT fire**: validated-patterns L1 body has "Marked design confidence high without verification" listed as a mistake pattern (from #170 RFC retrospective, score 8.0). It captured the spike-needed pattern for design phases. In implementation, an analogous failure mode is "mocked test ≠ runtime". Should be captured as its own mistake pattern entry.

## What Went Wrong

1. **PR-body decisions buried in prose** (RCA 1) — caught by a single user question; cost was 5 minutes.
2. **Migration not actually applied during my own validation** (RCA 2) — drift surfaced during reviewer's test-plan run. Cost was 1 extra commit + 1 follow-up issue.
3. **`signInUser` shipped with a forced cast that masks a real runtime bug** (RCA 3) — caught by reviewer choosing option (a) in Round 1. Cost was 1 commit to remove + interface size delta.

## What Went Right

1. **6-PR slicing decision** — surfaced in Phase 1 with `← recommended` numbered options at the >15-file Phase Splitting Candidate threshold. User approved a refinement (split BOTH auth and onboarding-admin into API/UI pairs → 6 PRs instead of my recommended 4) in a single chat turn. Each PR is now reviewable in one sitting; the dependency chain is linear; PR 1's foundation is genuinely self-contained with no user-visible behavior.
2. **Phase 6 security review caught SEC-170-001 before submission** — `parseWebhook` re-stringifying parsed body would have shipped a broken webhook signature contract. Tightening the interface to take `rawBody: string` was a clean fix; the contract documentation makes it obvious to PR 2 that the route handler must use Fastify `addContentTypeParser` to capture raw body. Real-world cost avoided: would have been days of debugging "valid Clerk webhooks 401-ing intermittently after deploy".
3. **ESLint structural enforcement of the abstraction boundary works** — the test-plan spot-check (item 3) confirmed: stray `import { foo } from '@clerk/backend'` in `apps/api/src/server.ts` errored with the exact configured message. With the rule active, the abstraction can't erode silently. Refactored `auth.ts` and `members.ts` off direct `@clerk/*` imports as the practical proof during Phase 4.
4. **Round 1 review converged in one round** — 3 comments, 1 push (`af3785d`), 0 follow-up rounds. The decision-points-at-PR-body-bottom format (after the user's nudge) got a one-line "go with a)" answer; the inline `console` warnings had a clean structural fix (inject the logger). All three were resolvable without re-architecting.
5. **Filing #198 proactively for `survey_themes` drift** — validated-patterns L1 body has *"Filing backlog issues proactively for deferred work"* (score 5.0). Fired correctly: at decision time (reviewer said "file a separate drift-fix issue"), I filed it the same commit as the Round 1 fixes rather than letting it become orally-tracked work.
6. **FRAIM phase progression was clean across 11 phases** — Phase 1, then 3-13 in sequence. Each `seekMentoring` `complete` produced the next phase's instructions; no phase failures requiring rollback. The systematic phasing made the multi-day work navigable when sub-issues (security finding, drift discovery, decisions-format clarification) interrupted the linear path.

## What I Almost Did Wrong But Caught

1. **Almost shipped `parseWebhook` with the parsed-body bug** — caught by Phase 6 security review. The implementation looked superficially correct (passed all unit tests via mocks); the bug only triggers at real runtime when svix verifies bytes that differ from what Clerk signed. Fixed in PR 1 before opening; PR 2's webhook route handler will now correctly use `addContentTypeParser` per the documented contract.
2. **Almost merged the round-1 fix without updating ADR 0004** — interface listing in the ADR still showed `signInUser` after I removed the method from the code. Caught while drafting the round-1 commit message; updated ADR with a comment block documenting the rationale for the absence. The traceability matrix and work-list checkbox were updated in the same commit.
3. **Almost claimed migration validation in the PR body without running `prisma migrate dev` myself** — wrote "*Migration applies on next `pnpm prisma migrate dev` against a running DB*" — passive voice + future tense. Reviewer ran it during the test plan and surfaced the SurveyTheme drift. **Should have run it myself before submission.** Captured as RCA 2 / lesson-for-PR-2-onward.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_before_plan_mode.md`** + L1 preferences `FRAIM discovery flow before any non-trivial action` — fired at the very start. Connected to FRAIM, called `get_fraim_job` for `feature-implementation`, walked phases via `seekMentoring` from #28 onward. No plan-mode entry, no Explore agents launched ahead of FRAIM context.
2. **L1 validated-patterns `Open decisions framed with ← recommended get one-round answers`** — fired at Phase 1 (4 pre-execution decisions resolved in 1 chat turn) and again at the implement-scoping output (6-PR slicing approval in 1 message). DID NOT fire when I authored the PR body — surfaced as RCA 1.
3. **L1 validated-patterns `Multiple feedback memories firing correctly within a single session`** — 6+ memories fired across PR 1: FRAIM-first, push-PR-default, user-doesn't-manually-close, recommended-defaults, single-question-pushback (reviewer's "best way to flag" question), audit-mock-vs-spec-at-every-round (no mocks in PR 1, but the principle of cross-checking applied to the schema-vs-migrations check during test plan).
4. **L1 mistake-patterns `Marked design confidence high without verification`** — captured from #170 RFC retrospective. Fired correctly at Phase 6 (security review caught the parseWebhook bug before submission) but DID NOT fire on `signInUser` despite the forced cast being analogous. Lesson: extend to "tests pass via mocks ≠ tested in production" as a sibling pattern.
5. **L1 validated-patterns `Filing backlog issues proactively for deferred work`** — fired correctly at Round 1 (filed #198 in the same commit as the round-1 fixes, not deferred to a future session).
6. **L1 manager-coaching `'Looks good. Proceed to next phase' = phase advance approval, not a merge instruction`** — captured from #170 RFC. Fired correctly at the user's "Good to proceed to next step" — interpreted as Phase 12→13 advance, not as a merge authorization. PR #197 stays unmerged pending explicit user direction.
7. **Project rule R21 (one issue per branch)** — fired during the SurveyTheme drift discovery. Resisted the urge to bundle the drift fix into PR 1; filed #198 as a separate issue + branch. Workaround in PR 1 (drop the FK; keep the column; document the deferral in code comment + commit message + PR comment).

## Lessons Learned

1. **PR-body "Decisions for the reviewer" is mandatory whenever a PR has any decision a reviewer must make** — even one. The prose form of "PR 2 decision: …" inside a deviation paragraph is invisible. Fixed-shape rule: search the PR-body draft for phrases like "PR N decision:", "X or Y", "decide later", "needs reviewer input"; if any match, the PR has a decisions block belonging at the bottom.

2. **Migration validation requires actual `prisma migrate dev` against a real DB** — static checks (build / typecheck / lint / test:smoke) don't exercise migrations. For any PR with a migration delta, the validation gate must include `pnpm prisma migrate dev` against a Docker-backed DB before submission. Adding to PR 4's checklist (the next PR with a migration delta).

3. **Forced casts in production code are a code smell — when the SDK can't satisfy the interface, fix the interface, not the cast** — the `signInUser` forced cast made tests pass but masked a real runtime bug. Applies symmetrically to any future SDK abstraction work: if the impl phase reveals a method can't be cleanly implemented, redesign the interface in the same phase rather than shipping a cast and deferring.

4. **Logger injection > module-level singletons for testability and structural correctness** — `console.error` triggered ESLint warnings AND coupled the impl to a global; the injected `logger: { error(obj, msg): void }` (Pino-shaped) is testable (`vi.fn()`-mockable) AND structurally clean. The pattern generalizes — any future provider abstraction (e.g., a future analytics-provider abstraction) should take its logger via constructor.

5. **Filing follow-up issues at the moment a deferral is decided beats remembering to file later** — #198 filed in the same commit as the round-1 fixes per reviewer-confirmed scope; if I'd waited "until I get to PR 2", the drift would still be latent and rediscovered.

6. **Multi-PR slices need explicit "do not delete the work list" treatment in retrospectives** — Phase 13's cleanup says delete the standing work list; for a 6-PR slice, the work list lives across all 6 and shouldn't be deleted until PR 6's retrospective. Documented this deviation explicitly.

## Agent Rule Updates Made to avoid recurrence

1. **L1 mistake-patterns** — adding pending entry: "Tests pass via mocks ≠ tested in production (forced casts mask runtime bugs)". Score 8.0 (P-HIGH; high impact, sibling of "high confidence without verification" pattern). Will appear in next end-of-day-debrief synthesis.
2. **L1 mistake-patterns** — adding pending entry: "Migration not validated against a real DB before PR submission". Score 5.0 (P-MED; mechanical to catch with `pnpm prisma migrate dev` in the validation gate).
3. **L1 validated-patterns** — adding pending entry: "Decisions-block-at-PR-body-bottom is mandatory for any reviewer-action PR, even with one decision". Score 5.0 (P-MED; refines the existing decision-points pattern).
4. **L1 manager-coaching** — adding pending entry: "User asks where to confirm a decision = signal that the decisions-block is missing or buried". Score 5.0 (P-MED; the user's *"I don't see where I should confirm"* is a clean coaching question).
5. **Standing Work List deviation** — Phase 13 cleanup step (delete work list) deferred for multi-PR slices until the final PR's retrospective; documented in this retrospective.

## Enforcement Updates Made to avoid recurrence

1. **Add to PR 4 work-list checkbox**: validation gate must include `pnpm prisma migrate dev` against a running Docker DB before submission.
2. **Add to next-PR-with-decisions work-list checkbox**: PR body must include a `## Decisions for the reviewer` section at the bottom with numbered options + `← recommended` defaults for any reviewer-action item.
3. **No automated enforcement changes** for the forced-cast pattern. Lint can flag `as unknown as` casts in production code as warnings, but it's noisy (legitimate uses exist). The L1 mistake-pattern entry is the durable enforcement mechanism.
