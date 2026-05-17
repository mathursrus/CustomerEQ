# Feedback for Issue #378 — technical-design Workflow

## Round 1 Feedback

*Received: 2026-05-17T12:09–12:32 UTC via 15 inline PR review comments on PR #385 (RFC commit `8a7244d` / now `64bda3c` post-rebase)*
*Surface: `docs/rfcs/378-personalized-survey-links-byo-email.md`*
*Reviewer: rmadhira86 (@manohar.madhira@outlook.com)*
*All 15 anchored to the pre-rebase line numbers in commit `8a7244d`; comments now show `is_outdated: true` on GitHub. Status capture below uses original-RFC line numbers + section context for unambiguous mapping.*

### Theme A — Locale hardcoding (2 items)

#### Comment R1-1 — UNADDRESSED — [r3254595776](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254595776)
- **RFC line / section**: 391 / §Technical Details — Brand-timezone formatting — `formatInBrandTz` helper
- **Targeted code**: `return new Intl.DateTimeFormat('en-US', { ... })`
- **Comment**: "Why is the locale hardcoded? It should come from Brand's default Locale"
- **Implication**: replace `'en-US'` with `Brand.locale` (verified at `schema.prisma:213` — `locale String @default("en-US")`, added by #277). Pass through as a third helper parameter or read from request context.

#### Comment R1-2 — UNADDRESSED — [r3254596627](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254596627)
- **RFC line / section**: 403 / §Technical Details — Brand-timezone formatting — `endOfDayInBrandTz` helper
- **Targeted code**: `new Intl.DateTimeFormat('en-CA', { ... })`
- **Comment**: "Why is the locale hardcoded? Where did you get en-CA from? Locale should come from Brand's default locale"
- **Implication**: `'en-CA'` was a clever-clog trick (it produces YYYY-MM-DD format reliably), not a deliberate locale choice. Spike outcome (see R1-3) may obviate this helper entirely. If the helper survives, the date-parts extraction should not depend on locale string at all — use `Intl.DateTimeFormat(undefined, { timeZone, ... })` and parse via `formatToParts()` keyed on `type === 'year' | 'month' | 'day'`, not split-on-dash.

### Theme B — Spike directive (Phase 3 reopens)

#### Comment R1-3 — UNADDRESSED — [r3254599820](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254599820)
- **RFC line / section**: 505 / §Confidence Level — Brand-TZ math reservation
- **Comment**: "Why is it not as simple as getting current time in Brand's timezone, doing the math and updating time to 23:59:59.999 for the date returned? Run a Spike for this"
- **Implication**: explicit directive to run a Phase 3 (`technical-spike`) on `endOfDayInBrandTz`. Two questions to answer:
  - Is the simpler approach (get current wall-clock time in brand TZ → add N days → set time to 23:59:59.999 → convert back to UTC) sufficient?
  - Does it survive DST-boundary edge cases (spring-forward / fall-back during the N-day window)?
  - If `date-fns-tz` `zonedTimeToUtc` makes this a one-liner, does that change OD-2's recommendation?

#### Comment R1-7 — UNADDRESSED — [r3254617319](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254617319)
- **RFC line / section**: 583 / OD-2 (Brand-timezone library)
- **Comment**: "See my comment about spike."
- **Implication**: OD-2's premise (the 30-line helper) is itself spike-pending. Reviewer pauses signoff on OD-2a until the spike runs.

### Theme C — Self-validation specificity

#### Comment R1-4 — UNADDRESSED — [r3254602340](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254602340)
- **RFC line / section**: 506 / §Confidence Level — Regenerate-tokens response shape reservation
- **Targeted text**: *"a review eye specifically on that handler is welcome"*
- **Comment**: "What do you mean by a review eye is welcome? Who will review? What can be done to validate it by you?"
- **Implication**: vague reviewer-ask is not acceptable. Replace with concrete self-validation steps the agent will run during implementation: (a) automated test asserting plaintext appears in the POST response body but is absent from any subsequent GET; (b) static-analysis check that `prisma.surveyDistributionToken.findUnique` results never include a plaintext column; (c) end-to-end test asserting a regenerated CSV downloads with new URLs and old URLs return HTTP 410 `state='invalid'`. Surface what the agent does, not what a hypothetical reviewer would do.

### Theme D — Issue tracking for deferred work

#### Comment R1-5 — UNADDRESSED — [r3254603040](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254603040)
- **RFC line / section**: 507 / §Confidence Level — *"**The two known gaps** (#264 erasure job, no rate-limit plugin) are scoped out and documented; if either has to land inside #378 instead, the design absorbs them but the impl scope grows ~30%."*
- **Comment**: "Make sure to update the issues to ensure this space isn't left out when they land"
- **Reviewer clarification (2026-05-17)**: scope is the two gaps named on line 507 — **#264 (erasure) and the rate-limit gap, NOT #403**. Agent incorrectly pulled #403 into this comment in the original capture; corrected. The rate-limit half of R1-5 is the same action as **R1-9** (file / comment on a rate-limit issue with the explicit adoption trigger).
- **Implication (corrected)**: post AC-addition on **#264 only** — the `audienceSpec.identifiersResolved[].identifier → '[redacted]'` erasure-rule contract so the next implementor doesn't miss #378's schema. Rate-limit side is folded into R1-9 (comment on existing tracker #218 — see below).

#### Comment R1-9 — UNADDRESSED — [r3254620723](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254620723)
- **RFC line / section**: 588 / OD-3 (b) area — `@fastify/rate-limit` repo-wide adoption alternative
- **Comment**: "Check if issue already exists, if not file one for future. Mention the trigger for when this should be adopted"
- **Search result (2026-05-17)**: existing issue [#218 OPEN](https://github.com/mathursrus/CustomerEQ/issues/218) — *"Add app-level rate limiting on public auth endpoints (SEC-170-005, SEC-170-006)"* — already proposes adopting `@fastify/rate-limit` with per-route opt-in, Redis-backed counters, and explicit out-of-scope-for-authed-routes carve-out. **No new tracker issue needed.**
- **Implication**: post a short comment on #218 noting that #378's NFR-SC1 (10 batches/min/survey on the new admin distribution endpoint) lands as an in-handler `INCR + EXPIRE` in #378 itself, and adding the explicit trigger criteria for when #218's plugin-based approach should be adopted instead. Plus the related issue [#204 OPEN](https://github.com/mathursrus/CustomerEQ/issues/204) — *"fix(security): authenticate and rate-limit the public survey trigger endpoint"* — is being closed-as-supplanted in this PR since #378 deletes the trigger endpoint outright.

### Theme E — OD-1 not actually an open decision

#### Comment R1-6 — UNADDRESSED — [r3254616719](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254616719)
- **RFC line / section**: 579 / OD-1 (CSV upload transport) area
- **Comment**: "Already confirmed in the spec - follow the format of Import Survey Results"
- **Implication**: OD-1 is not an open decision — the spec already locked `text/csv` raw-body per #262's pattern. Remove OD-1 from the Open Decisions block; reframe as a Resolved decision (carry-forward from spec). The "OD-1" framing was spurious.

### Theme F — OD-3 lock + implementation directive

#### Comment R1-8 — UNADDRESSED — [r3254619322](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254619322)
- **RFC line / section**: 587 / OD-3 (a) area — in-handler Redis rate-limit
- **Comment**: "Implement"
- **Implication**: lock OD-3 = **3a (in-handler Redis `INCR + EXPIRE` with `QUEUE_MODE=inline` graceful-degradation)**. Implement as part of the impl-phase work-list. Combined with R1-9 above: implement 3a AND file the longer-term `@fastify/rate-limit` backlog issue.

### Theme G — Agreed (locked decisions)

#### Comment R1-10 — RESOLVED (Agreed) — [r3254620879](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254620879)
- **RFC line / section**: 591 / OD-4 area — Erasure-job extension scope-out + #264 gating
- **Comment**: "Agreed"
- **Resolution**: lock **OD-4 = 4a** (scope erasure out of #378; document #264 as gating dependency; schema is shape-compatible).

#### Comment R1-11 — RESOLVED (Agreed) — [r3254621319](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254621319)
- **RFC line / section**: 595 / OD-5 area — Migration shape
- **Comment**: "Agreed"
- **Resolution**: lock **OD-5 = 5a** (hand-written migration per architecture §3.4 + #20260430000000 precedent).

#### Comment R1-12 — RESOLVED (Agreed) — [r3254622641](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254622641)
- **RFC line / section**: 660 / §Architecture Analysis — Patterns Missing M-1 (hash-at-rest tokenized public endpoint)
- **Comment**: "Agreed"
- **Resolution**: **M-1 confirmed for architecture.md addition** during impl phase — new §6 bullet *Hash-at-rest tokenized public endpoint* with cross-reference to ApiKey precedent + #378 implementation.

#### Comment R1-13 — RESOLVED (Agreed) — [r3254623585](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254623585)
- **RFC line / section**: 661 / §Architecture Analysis — Patterns Missing M-2 (brand-TZ display utility)
- **Comment**: "Agreed"
- **Resolution**: **M-2 confirmed for architecture.md addition** during impl phase — new §3.5 row under *Shared Layer* listing `packages/shared/src/datetime.ts`. Spike outcome (R1-3) may revise the implementation shape but the *location-of-doc-row* is locked.

#### Comment R1-14 — RESOLVED (Agreed) — [r3254624975](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254624975)
- **RFC line / section**: 663 / §Architecture Analysis — Patterns Missing **M-4 (re-download = regenerate semantics)**
- **Comment**: "Agreed"
- **Reviewer clarification (2026-05-17)**: M-4 confirmed. Reviewer also noted M-3 was not commented on because *"it was written that it is based on my OD-3a acceptance — I didn't feel the need to comment on it"* — i.e., **M-3 is implicitly accepted via R1-8's "Implement" on OD-3a**. Agent's mis-mapping (reading 663 as M-3) was the cause for confusion.
- **Resolution**: **M-4 confirmed for architecture.md addition** during impl phase — new §6 bullet *One-time secret regeneration as the only re-fetch path*, paired with M-1. **M-3 also confirmed** (implicitly, via OD-3a acceptance) — new §6 bullet *In-handler throttling with QUEUE_MODE parity*.

### Theme H — Defer architecture.md addition

#### Comment R1-15 — RESOLVED (deferred) — [r3254627295](https://github.com/mathursrus/CustomerEQ/pull/385#discussion_r3254627295)
- **RFC line / section**: 664 / §Architecture Analysis — Patterns Missing M-5 (detail-page filter-row UX pattern)
- **Comment**: "Not yet. We will decide when second occurrence comes up"
- **Resolution**: **M-5 deferred**. Architecture-doc addition waits for a second feature that needs the same pattern. The implementation ships as part of #378 R23; the doc row does not.

---

## Round 1 — agent's planned actions

Pending pre-execution confirmation from the reviewer before the multi-section rewrite (L1 preference *"Pre-execution confirmation on multi-section rewrites"*). Outline:

1. **R1-1 + R1-2 (locale hardcoding)** — pass `Brand.locale` into the helpers; rewrite the `endOfDayInBrandTz` parsing to use `formatToParts()` keyed on the typed parts (`year`/`month`/`day`), not split-on-locale-specific separator.
2. **R1-3 + R1-7 (spike)** — reopen Phase 3. Build a runnable PoC in a scratch script comparing three approaches: (a) the "current-time + add days + 23:59:59.999" approach the user suggested; (b) my current `endOfDayInBrandTz` Intl-formatToParts approach; (c) `date-fns-tz` `zonedTimeToUtc('YYYY-MM-DDT23:59:59.999', brandTz)`. Run each against 8 test cases: brand TZ = `UTC`, `America/Los_Angeles`, `America/New_York` (DST), `Asia/Tokyo` (no DST), `Pacific/Auckland`, on dates that span DST spring-forward and fall-back boundaries. Document the actual outputs and decide OD-2 against the spike data. If `date-fns-tz` wins (simpler + correct), reverse OD-2 to 2b.
3. **R1-4 (self-validate regenerate)** — replace "review eye welcome" with three concrete self-validation steps (response-body schema assertion test, static-analysis prohibition on plaintext fields in subsequent GETs, end-to-end old-URL-410 verification).
4. **R1-5 (#264 / #403 AC update)** — post AC-addition comments on both issues with the precise schema-compatibility contracts (`audienceSpec[].identifier` redaction; `Brand.supportEmail` conditional render). Pre-show the comment bodies in chat before posting.
5. **R1-9 + R1-8 (rate-limit followup issue)** — search GitHub for any existing rate-limit-plugin tracking issue; if absent, file a new backlog issue with explicit trigger criteria. Pre-show the issue body in chat before filing.
6. **R1-6 (OD-1 reframe)** — move OD-1 from Open Decisions to Resolved decisions (carry-forward from spec).
7. **R1-8 (OD-3 lock + implement)** — lock OD-3 = 3a in Resolved decisions; expand §Technical Details with the in-handler Redis `INCR + EXPIRE` code block + the inline-mode graceful-degradation branch.
8. **R1-10 through R1-14 (Agreed)** — mark OD-4 = 4a, OD-5 = 5a, M-1/M-2/M-3 = confirmed in Resolved decisions / Architecture Analysis sections.
9. **R1-15 (M-5 defer)** — mark M-5 in §Architecture Analysis as "DEFERRED — wait for second occurrence per reviewer R1-15".
10. **Per-thread replies** — post per-thread replies on every comment thread at resolution time citing the resolving commit SHA + a one-line resolution summary (per L1 validated pattern *"Per-thread PR replies posted at resolution time"*, 6 recurrences).

---

## Round 1 — pre-execution clarifications for reviewer

Per L1 preference *"Pre-execution confirmation on multi-section rewrites"* (1 recurrence, validated): three clarifications surfaced before the agent mass-edits:

- **Q1.** Confirm R1-14 (Agreed on line 663) is targeting M-3 (in-handler rate-limit with queue-mode parity) — agent's reading. If it was actually M-4 (re-download = regenerate semantics), say "M-4" and the doc-row landing changes.
- **Q2.** Spike scope: (a) include `date-fns-tz` as a candidate approach in the comparison even though it adds a dependency, or (b) constrain the spike to native `Intl` approaches only. Agent recommends (a) — the user's "Why is it not as simple as…" wording suggests they're open to whatever is actually simpler, including a small dependency.
- **Q3.** For the GitHub-action items (R1-5 #264/#403 AC additions, R1-9 rate-limit followup issue) — pre-show the comment / issue bodies in chat for approval before posting (per memory *"Show full draft before publishing to external surfaces"*), or batch-post all three at once once the rewrite is otherwise complete? Agent recommends pre-show.
