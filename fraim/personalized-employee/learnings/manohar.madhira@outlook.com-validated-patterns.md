# Validated Patterns — manohar.madhira@outlook.com

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

---

## ⏳ Pending Review — 2026-04-27

### Proposed new entries

#### [P-HIGH] User pushback caught a near-miss before submit

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 3
**First synthesized**: (pending)

On issue #153, the agent was ready to submit a React state-sync fix based on typecheck + build + smoke-test passing — none of which validate UI state behavior. The user's single-line pushback ("Have you tested these?") forced full local-env setup and Playwright validation, which then confirmed the fix worked. On issue #170 spec, the reviewer's "Is the mock in sync completely with the spec now?" caught three mock-vs-spec mismatches that would otherwise have shipped. On issue #170 RFC PR #196 (2026-04-26), the reviewer's "Do we need a Spike to verify?" caught an overconfident "high" rating on the IdentityProvider abstraction — the spike that followed surfaced two real interface-shape issues (`completeOAuth` wrong shape; `createUserWithOrg` partial-failure mode). Validated principle: a single-question pushback is a hard signal — do a real audit and surface gaps explicitly rather than answering reflexively.

---

#### [P-HIGH] Caught `github.sha` / `head_sha` trap by re-reading docs before submit

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, the initial deploy.yml edit would have used `${{ github.sha }}` throughout. Re-reading GitHub Actions `workflow_run` semantics once before committing surfaced that `github.sha` resolves to the default-branch tip at dispatch time, not the CI-tested commit. Switched to `${{ github.event.workflow_run.head_sha || github.sha }}` for all 7 SHA references. Validated principle: for workflow YAML with non-obvious trigger semantics, budget one documentation re-read before committing. Cost: ~5 minutes; alternative cost (wrong-commit deploy tag): hours of prod debugging.

---

#### [P-HIGH] Multiple feedback memories firing correctly within a single session

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 4
**First synthesized**: (pending)

Saved feedback memories now consistently fire in-session and shape behavior without explicit recall. On issue #166, two memories triggered (`feedback_fraim_before_plan_mode`, `feedback_dont_ask_about_baseline_dev_env`) and produced clean phase progression with no rework. On issue #170 spec, five memories fired (FRAIM-first, issue-first-branching, push-PR-default, pricing-forward-compat, single-question-pushback) and Round 1 was visibly cleaner than the start of #179. On issue #170 RFC + implementation phase 1 (2026-04-27), five+ memories fired across the technical-design and implementation-scoping phases (FRAIM-discovery-flow, push-PR-default, user-doesn't-manually-close, pricing-not-finalized, audit-mock-vs-spec-at-every-round) — the resulting work was clean enough that Round 2 review hit only one decision-set reversal. On issue #177, three memories fired and the Node 22 bump shipped on the first pass. Validated principle: invest in the memory channel — durable lessons saved as `feedback_*.md` produce measurable efficiency gains across compounding sessions.

---

#### [P-HIGH] Traceability matrix catches gaps that pure design review misses

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 2
**First synthesized**: (pending)

During design-completeness-review for issue #2, the requirements traceability matrix surfaced that "tier removal blocked if members in tier" had no implementation path — `Member` had no `currentTierId` field. A pure design-review narrative would not have caught this. On issue #170 spec, the matrix caught a 5-step checklist that didn't match #170's named milestones verbatim — fixed before submit. Validated principle: traceability matrices are not redundant with design review; they catch a specific class of gap (AC → schema field / mock element coverage) that prose review misses. Treat the matrix as a mandatory artifact for any design-completeness-review phase with >10 requirements.

---

#### [P-HIGH] Found hidden second-order risk during deep code/audit read

**Score**: 8.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: (pending)

On issue #157 technical-design, reading the duplicate `new/page.tsx` and edit page implementations for Alert Rules surfaced ~450 LOC × 2 form duplication. A surface-level read of just the navigation files would have missed it; the RFC explicitly elevated form extraction to a primary deliverable rather than a side cleanup. On issue #177, the parallel Explore audit surfaced that **CI does not build the production Dockerfiles** — the highest residual risk in a Node 22 LTS bump, which a literal AC reading would have missed. Validated principle: deep reads (full file contents, parallel Explore agents) reliably surface second-order architectural risks beyond the stated ACs. Budget the time; the discovery rate justifies it.

---

#### [P-HIGH] Open decisions framed with `← recommended` get one-round answers

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 4
**First synthesized**: (pending)

On issue #2, both open decisions (OD-1 packages/ui placement, OD-2 pagination backfill) resolved in a single round because each had a recommended default. On issue #170 spec, OD-1 through OD-5 (five open architectural decisions) all resolved in single review rounds — most as one-word "Agreed", one reversed cleanly with a one-line rationale, one added new. On issue #170 RFC PR #196, four "Decisions for the reviewer" resolved across two rounds (3 accepted defaults + 1 clean reversal on the planTier placeholder). On issue #170 implementation phase 1 (2026-04-27), four pre-execution decisions (slicing approach, sign-in strategy, API layout, ADR placement) resolved in a single chat turn. On issue #177, three "Decisions for you" at PR-body bottom got three answers in a single chat turn. Validated principle: numbered/lettered options + one-line tradeoff each + explicit `← recommended` is the user's preferred decision format. Default to it for any non-trivial decision-set.

---

#### [P-HIGH] Documentation-and-codebase spike (no PoC) is sufficient for many abstraction-shape questions

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: (pending)

On issue #170 RFC Round 1 spike, the IdentityProvider abstraction was verified entirely via Clerk SDK documentation re-read + existing codebase scan (`apps/api/src/plugins/auth.ts`, `scripts/onboard-org.mjs`) — no PoC, no test harness. The 30-minute audit surfaced two real interface-shape issues (completeOAuth wrong shape; createUserWithOrg's hidden 3-call internal complexity) that a PoC would have surfaced more slowly. Validated principle: when the spike question is "does this interface match how the SDK actually works?", a documentation-and-callsite read is often the right level of verification — not every spike needs a runnable PoC. Reserve PoCs for "does this perform under load?" / "does X integrate with Y at all?" — questions a desk audit cannot answer. Cost-quality tradeoff: the spike took ~30 min vs. likely 2-4 hours for a PoC; same findings.

---

#### [P-HIGH] Reviewer reversals with one-line rationale resolve cleanly when accepted without re-arguing

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: (pending)

On issue #170 RFC Round 2, reviewer reversed Decision #2 (planTier placeholder, `← recommended`) with a one-line rationale: *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."* Correct response was to apply the reversal cleanly across all dependent sections (§2.1 schema, §2.5 migration list, §13 out-of-scope, Risks #7) and update the durable memory `project_pricing_not_finalized.md` with the principle — not to defend the original recommendation or ask for clarification. Validated principle: when a reviewer reversal includes a clear rationale, accept and apply it across all dependent sections in a single commit; the rationale itself is the design guidance. The reviewer's single-pass "Plan tier...unknown...won't design for it yet" is more durable than the agent's recommendation, because the user holds context the agent doesn't.

---

#### [P-HIGH] Honest "is X synced?" answer triggers a real audit, not a reflexive "yes"

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 2
**First synthesized**: (pending)

On issue #170 spec, when the reviewer asked "Is the mock in sync completely with the spec now?", the agent did a fresh end-to-end audit and surfaced two more gaps (missing 5th theme swatch, Scene-4 archetype CTA mismatch) rather than answering "yes" reflexively. On issue #170 RFC PR #196 (2026-04-26), the reviewer's "Do we need a Spike to verify?" triggered a real documentation-and-codebase spike instead of a reflex "high confidence is correct" — surfaced two real interface-shape issues that would otherwise have shipped. The audits cost ~5–30 minutes each; the alternatives (saying "yes" and shipping gaps) would have cost reviewer round-trips or days of integration rework. Validated principle: when the user/reviewer asks a direct sync/completeness/verification question, the only correct response is a fresh audit with explicit findings — never a reflex "yes."

---

#### [P-MED] Caught `package-lock.json` pollution via `git status` pre-stage check

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, `~/.fraim/scripts/prep-issue.sh` ran `npm install` and modified `package-lock.json` with 221 lines of unrelated churn. A quick `git status` before staging surfaced the pollution; `git checkout -- package-lock.json` cleaned it, then staged only the three intentional files. Validated principle: always run `git status` — never `git add -A` or `git add .` — immediately before staging, regardless of how confident you are in what the diff contains. Prep scripts and tooling routinely modify files you don't expect.

---

#### [P-MED] Rule #15 applied (in either direction) — kept the right level of abstraction

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 3
**First synthesized**: (pending)

Project rule #15 ("fix at the right abstraction level") fired correctly across multiple decisions. On issue #153, applied in reverse: kept four per-component state-sync fixes rather than extracting to a shared hook because each component used a different state-management pattern. On issue #166, rejected YAML anchors for the `head_sha || github.sha` 7x repetition because GitHub Actions doesn't fully support anchors and inlining is readable. On issue #177, resisted the urge to introduce build-time templating for 8 hardcoded Node-version surfaces (overkill for N=8 with zero direct native deps); documented as a "patterns missing from architecture" gap and explicitly scoped out. Validated principle: "right abstraction level" is not always "highest" — sometimes it's "stay where the variance lives." Always ask in both directions.

---

#### [P-MED] Bundling related issues in same component tree was efficient

**Score**: 5.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

On issue #153, two related minor bugs (#133 step label, #134 hardcoded eligibleTiers) lived in the same component tree as the primary state-sync fix. Bundling all three into one PR was efficient because the files overlapped, the browser validation covered all three at once, and the rework cost if bundled wrong was low. Validated principle: bundle when (a) files overlap, (b) a single validation pass covers all fixes, (c) the bundle is still cleanly reviewable, and (d) the issues share a natural root cause or component. Do NOT bundle to save PR count — bundle when the validation and review are genuinely shared.

---

#### [P-MED] Filing backlog issues proactively for deferred work

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

Whenever a design review defers a decision or a follow-up to a future phase, file the corresponding tracking artifact at decision time, not "when we get there." On issue #2, filed #34 for Phase 2 packages/ui extraction without being asked. On issue #157 technical-design, recommended a follow-up issue for inline-editing entity standardization. On issue #170 spec Round 2, filed **#189** (team-management) and **#190** (brand-settings) before referencing them in the spec — turning placeholder text into linked issues in the same commit. Validated principle: deferrals without trackers decay into lost context; proactive issue-filing converts "we'll do it later" into a concrete artifact the team can act on.

---

#### [P-MED] Spike-skip rationale recorded explicitly when no PoC is needed

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: (pending)

On issue #177 (Node 22 bump), the technical-spike phase was correctly skipped — Node 22 had been GA for 12+ months, zero direct native deps, transitive natives all support Node 22 in current versions. Rather than just "Spike Findings: N/A," the RFC documented *why* — so future reviewers can confirm the skip rather than wondering why no PoC was built. Validated principle: when skipping a phase that normally has a deliverable, document the rationale explicitly. The "no spike needed" outcome is correct in some classes of work (LTS bumps, mechanical translations, validated reference patterns); recording the conditions that justified the skip makes future analogous decisions cheaper.

---

#### [P-MED] Three-bucket architecture-gap classification structures the gap-review

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: (pending)

On issues #157 technical-design and #177, the architecture-gap-review phase produced output structured as three explicit buckets: "Patterns Correctly Followed," "Patterns Missing from Architecture," "Patterns Incorrectly Followed." The structure forces the agent to enumerate the universe of patterns, not just the ones that pass — and produced concrete recommendations the reviewer could approve in one round. Validated principle: when a phase asks "did we follow the architecture?" the answer needs structured buckets, not a narrative. The bucket count signals coverage; per-bucket entries signal action items.

---

#### [P-MED] Decision-points-at-PR-body-bottom format for fast review

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: (pending)

On issue #177 (PR #188), the PR description ended with three numbered "Decisions for you" — each a binary or ternary choice with one-line tradeoffs and a recommended default. The user answered all three in a single chat turn. Faster than waiting for inline GitHub review comments on each one separately. Validated principle: when an RFC or implementation PR has 2–4 design decisions the reviewer must make, surface them as a numbered list at the bottom of the PR body. Reviewer answers in one batch; agent applies the answers in one follow-up commit. Same pattern works for pre-execution question batches in chat.
