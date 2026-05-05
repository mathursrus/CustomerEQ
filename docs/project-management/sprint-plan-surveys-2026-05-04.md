# Sprint Plan — Surveys — 2026-05-04

## Sprint Goal

**Close the survey response loop end-to-end — fix the production blocker, restore points crediting through the canonical path (programs/campaigns), make the operator visible to what the system did, and harden the public endpoints — so hero [#6](https://github.com/mathursrus/CustomerEQ/issues/6) actually fires and existing surveys accept responses.**

A primitive-dev customer should be able to (a) get responses in on a survey created before [#231](https://github.com/mathursrus/CustomerEQ/issues/231) without any change on their end, (b) submit a response that actually credits the configured points via programs/campaigns, (c) see on the admin detail page exactly what the platform did, and (d) trust that the public response surface is spoofproof.

## Capacity & Assumptions

- **Window:** 3 weeks, 2026-05-05 → 2026-05-23.
- **Owner:** Manohar + AI agents.
- **Total committed budget:** ~32 size points (1 = trivial, 10 = epic).
- **Working pattern:** Day-1 ships the production migration; security and privacy fixes ship together where they share code surface; tiny credibility wins ([#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A, [#270](https://github.com/mathursrus/CustomerEQ/issues/270)) get pulled forward when their cost is < 1 day.
- **Scope discipline (CLAUDE.md R1):** Every committed item directly extends hero [#6](https://github.com/mathursrus/CustomerEQ/issues/6)'s CX-to-loyalty surface or removes a known broken contract.
- **Out-of-scope:** Foundational survey UCs ([#14](https://github.com/mathursrus/CustomerEQ/issues/14), [#15](https://github.com/mathursrus/CustomerEQ/issues/15), [#37](https://github.com/mathursrus/CustomerEQ/issues/37), [#38](https://github.com/mathursrus/CustomerEQ/issues/38), [#48](https://github.com/mathursrus/CustomerEQ/issues/48)). Each needs decomposition before sprint-eligible.

## Consolidations applied during this planning round

| Action | Outcome |
|---|---|
| **Filed [#276](https://github.com/mathursrus/CustomerEQ/issues/276)** | `[P0] Production hotfix: survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT`. Existing surveys silently rejecting responses since [#231](https://github.com/mathursrus/CustomerEQ/issues/231) made `EXPLICIT` the default. |
| **Filed [#277](https://github.com/mathursrus/CustomerEQ/issues/277)** | `[P1] Organization Settings page` — single source for org configuration. Consolidates [#190](https://github.com/mathursrus/CustomerEQ/issues/190) + [#245](https://github.com/mathursrus/CustomerEQ/issues/245) + the orphan admin UI for [#231](https://github.com/mathursrus/CustomerEQ/issues/231) fields. |
| **Marked [#190](https://github.com/mathursrus/CustomerEQ/issues/190) superseded by [#277](https://github.com/mathursrus/CustomerEQ/issues/277)** | [Comment posted](https://github.com/mathursrus/CustomerEQ/issues/190#issuecomment-4375282860); closure left to the user. |
| **Marked [#245](https://github.com/mathursrus/CustomerEQ/issues/245) superseded by [#277](https://github.com/mathursrus/CustomerEQ/issues/277)** | [Comment posted](https://github.com/mathursrus/CustomerEQ/issues/245#issuecomment-4375283490); closure left to the user. |
| **Promoted [#241](https://github.com/mathursrus/CustomerEQ/issues/241) to epic** | New title: `[Epic] Survey Admin UX — lifecycle, rule actions, and earning consolidation`. Three streams. |
| **Made [#234](https://github.com/mathursrus/CustomerEQ/issues/234), [#242](https://github.com/mathursrus/CustomerEQ/issues/242), [#246](https://github.com/mathursrus/CustomerEQ/issues/246) sub-issues of [#241](https://github.com/mathursrus/CustomerEQ/issues/241)** | Each ships end-to-end (UI + backend executor + delivery + tests), independently shippable; action types enabled as business value warrants. |
| **Absorbed [#232](https://github.com/mathursrus/CustomerEQ/issues/232) into [#241](https://github.com/mathursrus/CustomerEQ/issues/241) Stream 3** | Direction shift: instead of aligning EarningRule trigger vocabulary, eliminate the survey-points-via-EarningRule path. Survey points credit through programs/campaigns. Override later only if needed. [Comment on #232](https://github.com/mathursrus/CustomerEQ/issues/232#issuecomment-4375519064). |
| **Identified close-ready: [#117](https://github.com/mathursrus/CustomerEQ/issues/117), [#198](https://github.com/mathursrus/CustomerEQ/issues/198)** | [#117](https://github.com/mathursrus/CustomerEQ/issues/117) implementation merged in [PR #132](https://github.com/mathursrus/CustomerEQ/pull/132) (2026-04-27); [#198](https://github.com/mathursrus/CustomerEQ/issues/198) resolved by `20260427200452_add_survey_distribution` migration that creates `survey_themes`. Verify and close. |

## Backlog (WSJF Scored)

WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each axis 1–10. Size: 1=trivial, 2=tiny, 3=small, 4=small-med, 5=med, 6=med-large, 8=large, 10=epic.

| # | Title | BV | TC | RR | Size | WSJF | Sprint Lane |
|---|---|---:|---:|---:|---:|---:|---|
| [#246](https://github.com/mathursrus/CustomerEQ/issues/246) | Drop wheel/card/box action types from dropdown (sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241)) | 4 | 5 | 6 | 1 | **15.0** | Committed |
| [#270](https://github.com/mathursrus/CustomerEQ/issues/270) | Migration `patch_survey_distribution_gap` not idempotent on fresh DB | 7 | 9 | 9 | 2 | **12.5** | Committed |
| [#276](https://github.com/mathursrus/CustomerEQ/issues/276) | [P0] Production hotfix: survey-level consent override + migration | 10 | 10 | 8 | 3 | **9.3** | Committed |
| [#209](https://github.com/mathursrus/CustomerEQ/issues/209) | fix(privacy): remove member email from survey URLs | 7 | 6 | 7 | 3 | **6.7** | Committed (bundle w/ [#203](https://github.com/mathursrus/CustomerEQ/issues/203)) |
| [#234](https://github.com/mathursrus/CustomerEQ/issues/234) | `send_message` action config — end-to-end (sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241)) | 9 | 9 | 7 | 4 | **6.25** | Committed |
| [#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3 | Earning consolidation first slice — points via programs/campaigns (Stream 3 of [#241](https://github.com/mathursrus/CustomerEQ/issues/241); absorbs [#232](https://github.com/mathursrus/CustomerEQ/issues/232)) | 10 | 10 | 9 | 5 | **5.8** | Committed |
| [#203](https://github.com/mathursrus/CustomerEQ/issues/203) | fix(security): require signed member identity for public survey responses | 9 | 8 | 9 | 5 | **5.2** | Committed |
| [#204](https://github.com/mathursrus/CustomerEQ/issues/204) | fix(security): authenticate and rate-limit the public survey trigger endpoint | 8 | 8 | 9 | 5 | **5.0** | Committed |
| [#235](https://github.com/mathursrus/CustomerEQ/issues/235) | [P0] Survey response detail completeness — verbatim, points, question preview | 7 | 7 | 6 | 4 | **5.0** | Committed |
| [#130](https://github.com/mathursrus/CustomerEQ/issues/130) | feat: wire survey-completers-earn-more insight rule DB query | 4 | 3 | 3 | 2 | **5.0** | Stretch |
| [#242](https://github.com/mathursrus/CustomerEQ/issues/242) | `award_reward` action config — end-to-end (sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241)) | 6 | 5 | 4 | 4 | **3.75** | Stretch |
| [#52](https://github.com/mathursrus/CustomerEQ/issues/52) | Re-survey trigger after case resolution | 6 | 3 | 5 | 4 | **3.5** | Not-in-sprint |
| [#244](https://github.com/mathursrus/CustomerEQ/issues/244) | [P1] Program wizard pragmatics — drop UI gates, fix preview/simulator | 7 | 5 | 5 | 5 | **3.4** | Not-in-sprint |
| [#38](https://github.com/mathursrus/CustomerEQ/issues/38) | Response quotas & sampling controls | 6 | 3 | 4 | 5 | **2.6** | Not-in-sprint |
| [#277](https://github.com/mathursrus/CustomerEQ/issues/277) | [P1] Organization Settings page — umbrella for org configuration | 8 | 5 | 7 | 8 | **2.5** | Next-sprint candidate |
| [#248](https://github.com/mathursrus/CustomerEQ/issues/248) | [P2] Public widget branding — brand-first headers, branded share slugs | 6 | 4 | 4 | 6 | **2.3** | Not-in-sprint |
| [#262](https://github.com/mathursrus/CustomerEQ/issues/262) | [P1] Historical survey data import — CSV bulk import | 7 | 4 | 5 | 8 | **2.0** | Not-in-sprint (spec OQs in [PR #263](https://github.com/mathursrus/CustomerEQ/pull/263)) |
| [#241](https://github.com/mathursrus/CustomerEQ/issues/241) | [Epic] Survey Admin UX — lifecycle + rule actions + earning consolidation (full epic) | 9 | 6 | 8 | 12 | **1.9** | Multi-sprint epic; first slice ([#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3) committed this sprint |
| [#14](https://github.com/mathursrus/CustomerEQ/issues/14) | [UC-07] Surveys, Quizzes & Contests — Zero-Party Data | 9 | 4 | 6 | 10 | **1.9** | Not-in-sprint (decompose) |
| [#15](https://github.com/mathursrus/CustomerEQ/issues/15) | [UC-15] Progressive Profiling | 7 | 3 | 5 | 8 | **1.9** | Not-in-sprint (decompose) |
| [#37](https://github.com/mathursrus/CustomerEQ/issues/37) | Multi-channel survey distribution (email/SMS/QR/intercept/SDK) | 8 | 4 | 5 | 9 | **1.9** | Not-in-sprint (decompose) |
| [#48](https://github.com/mathursrus/CustomerEQ/issues/48) | MCP-native AI agent platform | 9 | 2 | 8 | 10 | **1.9** | Not-in-sprint (moonshot) |
| [#232](https://github.com/mathursrus/CustomerEQ/issues/232) | (absorbed into [#241](https://github.com/mathursrus/CustomerEQ/issues/241) Stream 3) | — | — | — | — | — | Absorbed |
| [#117](https://github.com/mathursrus/CustomerEQ/issues/117) | fix([#79](https://github.com/mathursrus/CustomerEQ/issues/79)): survey creation UX — restore ad-hoc path + wire trigger | — | — | — | — | — | Close-ready |
| [#198](https://github.com/mathursrus/CustomerEQ/issues/198) | fix: pre-existing schema-vs-migrations drift on `survey_themes` | — | — | — | — | — | Close-ready |

## Close-Ready (Verify & Close — Not Planning Lane)

| # | Title | Evidence |
|---|---|---|
| [#117](https://github.com/mathursrus/CustomerEQ/issues/117) | fix([#79](https://github.com/mathursrus/CustomerEQ/issues/79)): survey creation UX | [PR #132](https://github.com/mathursrus/CustomerEQ/pull/132) merged 2026-04-27. Issue still open with `status:needs-review`. **Action:** verify acceptance criteria against `main` and close. |
| [#198](https://github.com/mathursrus/CustomerEQ/issues/198) | fix: schema-vs-migrations drift on `survey_themes` | Migration `20260427200452_add_survey_distribution` creates the `survey_themes` table (verified by reading the migration SQL). **Action:** confirm `pnpm db:reset --force` succeeds on a fresh DB and close. (Note: [#270](https://github.com/mathursrus/CustomerEQ/issues/270) is the still-open follow-on for that same migration's idempotency bug — already in the committed lane.) |

## Committed Scope

Total: **32 size points**.

### 0. [#276](https://github.com/mathursrus/CustomerEQ/issues/276) — Production hotfix: survey-level consent override + migration (size 3, P0, ship Day 1)

- **Why first:** Production blocker. Existing surveys silently reject every response after [#231](https://github.com/mathursrus/CustomerEQ/issues/231) made `EXPLICIT` the default `consentMode`. All existing surveys are test fixtures.
- **Scope:** One-shot data migration ships first as its own PR (existing surveys → `IMPLIED_ON_SUBMIT`). Override field + admin-gated picker land as a follow-up PR. Open questions defer to feature-spec phase.
- **Acceptance:** Existing surveys accept responses without code changes after migration; admin can override consent mode per survey, gated by authorization.

### 1. [#270](https://github.com/mathursrus/CustomerEQ/issues/270) — Fresh-DB migration idempotency (size 2)

- **Why early:** Every new contributor + every DR replay hits this today. Tiny + critical. Unblocks [#198](https://github.com/mathursrus/CustomerEQ/issues/198)'s verify-and-close.
- **Acceptance:** `pnpm db:reset --force` runs all migrations cleanly on a fresh container; CI gains a `prisma migrate deploy` step against an empty postgres.

### 2. [#241](https://github.com/mathursrus/CustomerEQ/issues/241) Stream 3 first slice — Earning consolidation: survey points via programs/campaigns (size 5, P0)

- **Why P0:** Empirically broken in prod — customer set up a `survey_completion` rule, NPS submission credited zero points, zero `LoyaltyEvent` rows. Hero [#6](https://github.com/mathursrus/CustomerEQ/issues/6) path silently fails.
- **Direction shift (was [#232](https://github.com/mathursrus/CustomerEQ/issues/232)):** Eliminate the survey-points-via-EarningRule path entirely. `Survey.incentivePoints` becomes the single source of truth and credits via the program/campaign pipeline. Remove `survey_completion` from the EarningRule wizard. Override later only if needed.
- **Scope this sprint:** Only the survey-completion side; other EarningRule trigger consolidations are out of scope.
- **Acceptance:** Re-running the empirical reproduction yields a non-zero `LoyaltyEvent` row; `survey_completion` no longer appears in the EarningRule wizard; widget badge and post-submit message use the program's `pointCurrencyName`.

### 3. [#234](https://github.com/mathursrus/CustomerEQ/issues/234) — `send_message` action config UI (size 4, P0, sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241))

- **Why P0:** Required for the Winback hero loop demo. Today rules with `send_message` save with `actionConfig: {}` and fire with nothing to send.
- **Spike risk:** Issue body asks "verify the rule executor for `send_message` actually exists." If executor missing, scope grows ~3 days. Spike on day 1 of the work block.
- **End-to-end definition:** UI + worker executor + email/SMS provider integration + validation + integration test where NPS submission triggers delivery.
- **Acceptance:** NPS ≤ 6 → recovery email + bonus points reproducible end-to-end through the wizard.

### 4. [#235](https://github.com/mathursrus/CustomerEQ/issues/235) — Survey response detail completeness (size 4, P0)

- **Why P0 + sequenced after [#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3:** Operator surface for confirming the closed loop. Verbatim text + LoyaltyEvent linkage + question preview. Once survey points credit reliably ([#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3), this surface lets operators *see* it work.
- **Acceptance:** Survey detail page shows verbatim per response, points credited (or "0 / no rule matched"), and the survey's question definitions.

### 5. [#203](https://github.com/mathursrus/CustomerEQ/issues/203) + [#209](https://github.com/mathursrus/CustomerEQ/issues/209) — Signed member token (security HIGH + privacy MED, bundled, size 6)

- **Why bundled:** Same code surface (`apps/api/src/routes/public.ts` + `apps/web/src/app/survey/[id]/page.tsx`); signed token replaces both email-as-identity ([#203](https://github.com/mathursrus/CustomerEQ/issues/203)) and email-in-URL ([#209](https://github.com/mathursrus/CustomerEQ/issues/209)). One PR, two findings closed.
- **Pull-forward justification:** Incremental cost of removing the URL email param once token resolution works server-side is < 0.5 day. Validation overlap meaningful.
- **Acceptance:** Public survey responses authenticate via signed token; URL contains no raw email; integration tests cover valid / forged / expired-token cases.

### 6. [#204](https://github.com/mathursrus/CustomerEQ/issues/204) — Auth + rate-limit public trigger (size 5, security HIGH)

- **Why:** OWASP API6 — anyone can flood notifications today. Independent of [#203](https://github.com/mathursrus/CustomerEQ/issues/203) but same area of `apps/api/src/routes/public.ts` — distinct PR for review hygiene.
- **Acceptance:** Endpoint rejects unauthenticated requests, blocks replays, enforces per-caller and per-target rate limits.

### 7. [#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A — Drop wheel/card/box action types (size 1, sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241))

- **Why pulled forward:** Trivial credibility fix. Aligns with [#241](https://github.com/mathursrus/CustomerEQ/issues/241) epic invariant: every action type listed must work end-to-end or be removed.
- **Acceptance:** `spin_wheel`, `scratch_card`, `mystery_box` removed from `ACTION_TYPES`; comment notes they return when configurable assets ship.

## Stretch Scope (capacity permitting)

- **[#130](https://github.com/mathursrus/CustomerEQ/issues/130)** (size 2) — wire `survey-completers-earn-more` insight rule DB query. `status:ready`, small. Closes [#78](https://github.com/mathursrus/CustomerEQ/issues/78) follow-on.
- **[#242](https://github.com/mathursrus/CustomerEQ/issues/242)** (size 4, sub-issue of [#241](https://github.com/mathursrus/CustomerEQ/issues/241)) — `award_reward` action UI + executor end-to-end. Same shape as [#234](https://github.com/mathursrus/CustomerEQ/issues/234); once [#234](https://github.com/mathursrus/CustomerEQ/issues/234)'s pattern lands, this is much smaller.

## Not-in-Sprint (with Cost-of-Delay note)

| # | Why deferred | Cost of delay |
|---|---|---|
| [#277](https://github.com/mathursrus/CustomerEQ/issues/277) | Org Settings umbrella (P1) — natural next-sprint candidate; this sprint focused on the response-loop closure. | Admins still have to set [#231](https://github.com/mathursrus/CustomerEQ/issues/231) fields via DB UPDATE; not blocking the loop. |
| [#244](https://github.com/mathursrus/CustomerEQ/issues/244) | P1 but tangential to survey loop closure; touches Program wizard, not survey wizard. | Customers who skip Rewards or aren't USD-denominated hit blockers; not gating the loop. |
| [#248](https://github.com/mathursrus/CustomerEQ/issues/248) | Depends on `Brand.slug` (not modeled) and on [#241](https://github.com/mathursrus/CustomerEQ/issues/241)'s broader streams. | Customer-facing branding stays weak; tolerable until lifecycle ships. |
| [#262](https://github.com/mathursrus/CustomerEQ/issues/262) | Spec [PR #263](https://github.com/mathursrus/CustomerEQ/pull/263) has 3 blocking open questions; not actionable. | Customers can't backfill; resolve OQs in parallel so [#262](https://github.com/mathursrus/CustomerEQ/issues/262) is ready next sprint. |
| [#52](https://github.com/mathursrus/CustomerEQ/issues/52) | Tier-2 differentiation; not gating MVP. | Closed-loop effectiveness measurement remains manual. |
| [#38](https://github.com/mathursrus/CustomerEQ/issues/38) | Tier-1 ergonomic; not part of loop-closure thesis. | Statistical validity for CX research stays manual. |
| [#14](https://github.com/mathursrus/CustomerEQ/issues/14), [#15](https://github.com/mathursrus/CustomerEQ/issues/15), [#37](https://github.com/mathursrus/CustomerEQ/issues/37), [#48](https://github.com/mathursrus/CustomerEQ/issues/48) | Foundational/broad; need decomposition into shippable sub-issues. | Each is a separate planning effort. |
| [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (broader streams beyond first slice) | Multi-sprint epic; remaining streams (lifecycle/wizard convergence, more action configs) sized for next 1–2 sprints. | Lifecycle UX stays inconsistent until next sprint. |

## Sequencing (Week-by-Week)

- **Week 1 (May 5–9):** **Day 1: [#276](https://github.com/mathursrus/CustomerEQ/issues/276) migration PR + [#270](https://github.com/mathursrus/CustomerEQ/issues/270)**. Then [#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3 first slice (eliminate `survey_completion` EarningRule, route via programs/campaigns) + spike [#234](https://github.com/mathursrus/CustomerEQ/issues/234) worker executor.
- **Week 2 (May 12–16):** [#276](https://github.com/mathursrus/CustomerEQ/issues/276) override field + UI follow-up → [#234](https://github.com/mathursrus/CustomerEQ/issues/234) end-to-end → [#235](https://github.com/mathursrus/CustomerEQ/issues/235) (operator visibility) → start [#203](https://github.com/mathursrus/CustomerEQ/issues/203) + [#209](https://github.com/mathursrus/CustomerEQ/issues/209) design + integration tests.
- **Week 3 (May 19–23):** Finish [#203](https://github.com/mathursrus/CustomerEQ/issues/203) + [#209](https://github.com/mathursrus/CustomerEQ/issues/209) → [#204](https://github.com/mathursrus/CustomerEQ/issues/204) → [#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A → verify-and-close [#117](https://github.com/mathursrus/CustomerEQ/issues/117) + [#198](https://github.com/mathursrus/CustomerEQ/issues/198) → stretch ([#130](https://github.com/mathursrus/CustomerEQ/issues/130), [#242](https://github.com/mathursrus/CustomerEQ/issues/242)).

## RAID

### Risks

- **R1 (Capacity)** — Solo + AI cadence; if AI throughput drops, drop stretch first, then [#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A. Owner: Manohar. Trigger: any P0 slips past Week 2.
- **R2 (Earning consolidation reach)** — [#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3 first slice intentionally only covers `survey_completion`. If implementation reveals coupling with other EarningRule triggers (review, referral, etc.), scope grows. Mitigation: make the cut at the trigger filter — only `survey_completion` is removed from EarningRule wizard; other triggers untouched.
- **R3 ([#234](https://github.com/mathursrus/CustomerEQ/issues/234) spike)** — Worker `send_message` executor existence unknown. Scope could grow ~3 days if absent. Spike on day 1 of work block; if absent, descope [#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A and one stretch item to absorb.
- **R4 ([#203](https://github.com/mathursrus/CustomerEQ/issues/203) design)** — Signed-token primitive is a security cryptographic decision; needs RFC/design review before implementation. Mitigation: schedule `technical-design` job before `feature-implementation`.
- **R5 ([#276](https://github.com/mathursrus/CustomerEQ/issues/276) migration semantics)** — One-shot SQL migration that updates every existing `Survey.consentMode` could surprise if any prod survey was intentionally left at brand default. Mitigation: scope check in the migration — only update rows where `consentMode IS NULL` (i.e., never explicitly set).

### Assumptions

- **A1** — 3-week sprint, solo + AI cadence is the working tempo (unconfirmed by user; default).
- **A2** — Hero [#6](https://github.com/mathursrus/CustomerEQ/issues/6) SLA (<15 min CX-to-loyalty) is preserved across all changes (CLAUDE.md R2). All earning-rule changes go through BullMQ; no synchronous DB writes for loyalty state from API layer.
- **A3** — Survey response data model rework ([#231](https://github.com/mathursrus/CustomerEQ/issues/231)) shipped in [PR #265](https://github.com/mathursrus/CustomerEQ/pull/265) + [PR #267](https://github.com/mathursrus/CustomerEQ/pull/267); the schema this sprint depends on is current.

### Issues

- **I1** — [#117](https://github.com/mathursrus/CustomerEQ/issues/117) and [#198](https://github.com/mathursrus/CustomerEQ/issues/198) are open but appear close-ready. Verifying and closing is part of sprint cleanup, not active scope.

### Decisions

- **D1** — Bundle [#203](https://github.com/mathursrus/CustomerEQ/issues/203) + [#209](https://github.com/mathursrus/CustomerEQ/issues/209) in a single PR (signed token replaces email-in-URL).
- **D2** — Use [#246](https://github.com/mathursrus/CustomerEQ/issues/246) Option A (remove dropdown entries) rather than building wheel/card/box configs.
- **D3** — [#241](https://github.com/mathursrus/CustomerEQ/issues/241) is multi-sprint; only Stream 3's first slice (eliminate `survey_completion` EarningRule) is in this sprint. Lifecycle/wizard/builder convergence and other action-type sub-issues sequence next sprint.
- **D4** — [#262](https://github.com/mathursrus/CustomerEQ/issues/262) not committed because spec [PR #263](https://github.com/mathursrus/CustomerEQ/pull/263) has 3 blocking OQs. Resolve OQs in parallel; commit next sprint.
- **D5** — [#276](https://github.com/mathursrus/CustomerEQ/issues/276) migration ships first as a stand-alone PR before override field + UI to unblock production immediately.

## Definitions of Done

- All committed issues' acceptance criteria met and verified against `main`.
- All committed PRs pass `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke` (CLAUDE.md R11).
- Security PRs ([#203](https://github.com/mathursrus/CustomerEQ/issues/203), [#204](https://github.com/mathursrus/CustomerEQ/issues/204)) have integration tests covering authorized / forged / replayed / rate-limited cases.
- [#241](https://github.com/mathursrus/CustomerEQ/issues/241)-S3's empirical reproduction (NPS submission → non-zero `LoyaltyEvent`) added to integration tests.
- [#117](https://github.com/mathursrus/CustomerEQ/issues/117) and [#198](https://github.com/mathursrus/CustomerEQ/issues/198) verified and closed.
- This sprint plan updated with actuals at end of sprint (date-stamp the update).
