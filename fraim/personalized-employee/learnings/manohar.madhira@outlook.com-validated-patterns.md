# Validated Patterns — manohar.madhira@outlook.com

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

**Last synthesized**: 2026-05-05

---

#### [P-HIGH] User pushback caught a near-miss before submit

**Score**: 8.0
**Last seen**: 2026-05-04
**Recurrences**: 8
**First synthesized**: 2026-04-27

On issue #153, the agent was ready to submit a React state-sync fix based on typecheck + build + smoke-test passing — none of which validate UI state behavior. The user's single-line pushback ("Have you tested these?") forced full local-env setup and Playwright validation, which then confirmed the fix worked. On issue #170 spec, the reviewer's "Is the mock in sync completely with the spec now?" caught three mock-vs-spec mismatches that would otherwise have shipped. On issue #170 RFC PR #196 (2026-04-26), the reviewer's "Do we need a Spike to verify?" caught an overconfident "high" rating on the IdentityProvider abstraction. **#170 PR2 retrospective PR #222 (2026-04-30)** added a 4th recurrence: reviewer's *"This is a key learning moment..."* caught the mis-categorization of the JTBD framing miss. **The 2026-05-03 sleep-on-learnings cycle added two more in two days**: (5) on #231 PR #259, *"Why didn't you add replies?"* caught a missed reviewer-experience step; (6) on #231 PR #259, *"This statement is incorrect. This is the second occurrence"* caught a false primary-source claim about `fraim/config.json`. **The 2026-05-04 #273 cycle adds 7th and 8th recurrences**: (7) the user's *"the probe checking if the image is activated — should it be in CI or CD?"* on PR #275 Round 1 caught a missing CI-vs-CD carve-out in the RFC AND prompted narrowing the probe target from the full app entry (`apps/api/dist/server.js`) to `@customerEQ/ai`'s dist directly — turning a flaky-prone gate into a precise one. (8) the user's *"Have you actually verified this in production?"* on the post-merge investigation of #267 caught the agent reporting "Deploy: success ⇒ in prod" without querying revision state — directly led to discovering #273's BAML regression had been hiding for 16 days. Validated principle: a single-question pushback or pointed observation is a hard signal — do a real audit and surface gaps explicitly rather than answering reflexively. The cost of treating each as a full stop-and-reconsider is small; the cost of ignoring even one of them compounds across the audit/review chain.

---

#### [P-HIGH] Caught `github.sha` / `head_sha` trap by re-reading docs before submit

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #166, the initial deploy.yml edit would have used `${{ github.sha }}` throughout. Re-reading GitHub Actions `workflow_run` semantics once before committing surfaced that `github.sha` resolves to the default-branch tip at dispatch time, not the CI-tested commit. Switched to `${{ github.event.workflow_run.head_sha || github.sha }}` for all 7 SHA references. Validated principle: for workflow YAML with non-obvious trigger semantics, budget one documentation re-read before committing. Cost: ~5 minutes; alternative cost (wrong-commit deploy tag): hours of prod debugging.

---


#### [P-HIGH] Traceability matrix catches gaps that pure design review misses

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 2
**First synthesized**: 2026-04-27

During design-completeness-review for issue #2, the requirements traceability matrix surfaced that "tier removal blocked if members in tier" had no implementation path — `Member` had no `currentTierId` field. A pure design-review narrative would not have caught this. On issue #170 spec, the matrix caught a 5-step checklist that didn't match #170's named milestones verbatim — fixed before submit. Validated principle: traceability matrices are not redundant with design review; they catch a specific class of gap (AC → schema field / mock element coverage) that prose review misses. Treat the matrix as a mandatory artifact for any design-completeness-review phase with >10 requirements.

---

#### [P-HIGH] Found hidden second-order risk during deep code/audit read

**Score**: 8.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: 2026-04-27

On issue #157 technical-design, reading the duplicate `new/page.tsx` and edit page implementations for Alert Rules surfaced ~450 LOC × 2 form duplication. A surface-level read of just the navigation files would have missed it; the RFC explicitly elevated form extraction to a primary deliverable rather than a side cleanup. On issue #177, the parallel Explore audit surfaced that **CI does not build the production Dockerfiles** — the highest residual risk in a Node 22 LTS bump, which a literal AC reading would have missed. Validated principle: deep reads (full file contents, parallel Explore agents) reliably surface second-order architectural risks beyond the stated ACs. Budget the time; the discovery rate justifies it.

---


#### [P-HIGH] Documentation-and-codebase spike (no PoC) is sufficient for many abstraction-shape questions

**Score**: 8.0
**Last seen**: 2026-05-04
**Recurrences**: 2
**First synthesized**: 2026-04-27

On issue #170 RFC Round 1 spike, the IdentityProvider abstraction was verified entirely via Clerk SDK documentation re-read + existing codebase scan (`apps/api/src/plugins/auth.ts`, `scripts/onboard-org.mjs`) — no PoC, no test harness. The 30-minute audit surfaced two real interface-shape issues (completeOAuth wrong shape; createUserWithOrg's hidden 3-call internal complexity) that a PoC would have surfaced more slowly. **#273 BAML codegen-options spike (2026-05-04) added a 2nd recurrence in a different shape**: 3-minute spike replaced what would have been a ~50-line custom post-process patch script with a 1-line BAML config option (`module_format "esm"`). The spike consisted of: edit the .baml generator block, run `npx @boundaryml/baml generate`, grep the output for `.js` extensions, then test fail-loud behavior with an invalid value. Empirically confirmed BAML accepts/validates the option AND fails loud on bogus values — high-confidence design with zero ambiguity. Validated principle: when the spike question is "does this interface match how the SDK actually works?" or "does this generator have a config option for what we need?", a documentation-and-callsite read (or a 3-minute `generate + grep`) is often the right level of verification — not every spike needs a runnable PoC. Reserve PoCs for "does this perform under load?" / "does X integrate with Y at all?" — questions a desk audit cannot answer. Cost-quality tradeoff stays favorable: 30 min vs. likely 2-4 hours for a PoC; same findings.

---

#### [P-HIGH] Reviewer reversals with one-line rationale resolve cleanly when accepted without re-arguing

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC Round 2, reviewer reversed Decision #2 (planTier placeholder, `← recommended`) with a one-line rationale: *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."* Correct response was to apply the reversal cleanly across all dependent sections (§2.1 schema, §2.5 migration list, §13 out-of-scope, Risks #7) and update the durable memory `project_pricing_not_finalized.md` with the principle — not to defend the original recommendation or ask for clarification. Validated principle: when a reviewer reversal includes a clear rationale, accept and apply it across all dependent sections in a single commit; the rationale itself is the design guidance. The reviewer's single-pass "Plan tier...unknown...won't design for it yet" is more durable than the agent's recommendation, because the user holds context the agent doesn't.

---

#### [P-HIGH] Honest "is X synced?" answer triggers a real audit, not a reflexive "yes"

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 2
**First synthesized**: 2026-04-27

On issue #170 spec, when the reviewer asked "Is the mock in sync completely with the spec now?", the agent did a fresh end-to-end audit and surfaced two more gaps (missing 5th theme swatch, Scene-4 archetype CTA mismatch) rather than answering "yes" reflexively. On issue #170 RFC PR #196 (2026-04-26), the reviewer's "Do we need a Spike to verify?" triggered a real documentation-and-codebase spike instead of a reflex "high confidence is correct" — surfaced two real interface-shape issues that would otherwise have shipped. The audits cost ~5–30 minutes each; the alternatives (saying "yes" and shipping gaps) would have cost reviewer round-trips or days of integration rework. Validated principle: when the user/reviewer asks a direct sync/completeness/verification question, the only correct response is a fresh audit with explicit findings — never a reflex "yes."

---


#### [P-MED] Rule #15 applied (in either direction) — kept the right level of abstraction

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 3
**First synthesized**: 2026-04-27

Project rule #15 ("fix at the right abstraction level") fired correctly across multiple decisions. On issue #153, applied in reverse: kept four per-component state-sync fixes rather than extracting to a shared hook because each component used a different state-management pattern. On issue #166, rejected YAML anchors for the `head_sha || github.sha` 7x repetition because GitHub Actions doesn't fully support anchors and inlining is readable. On issue #177, resisted the urge to introduce build-time templating for 8 hardcoded Node-version surfaces (overkill for N=8 with zero direct native deps); documented as a "patterns missing from architecture" gap and explicitly scoped out. Validated principle: "right abstraction level" is not always "highest" — sometimes it's "stay where the variance lives." Always ask in both directions.

---

#### [P-MED] Bundling related issues in same component tree was efficient

**Score**: 5.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #153, two related minor bugs (#133 step label, #134 hardcoded eligibleTiers) lived in the same component tree as the primary state-sync fix. Bundling all three into one PR was efficient because the files overlapped, the browser validation covered all three at once, and the rework cost if bundled wrong was low. Validated principle: bundle when (a) files overlap, (b) a single validation pass covers all fixes, (c) the bundle is still cleanly reviewable, and (d) the issues share a natural root cause or component. Do NOT bundle to save PR count — bundle when the validation and review are genuinely shared.

---


#### [P-MED] Spike-skip rationale recorded explicitly when no PoC is needed

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #177 (Node 22 bump), the technical-spike phase was correctly skipped — Node 22 had been GA for 12+ months, zero direct native deps, transitive natives all support Node 22 in current versions. Rather than just "Spike Findings: N/A," the RFC documented *why* — so future reviewers can confirm the skip rather than wondering why no PoC was built. Validated principle: when skipping a phase that normally has a deliverable, document the rationale explicitly. The "no spike needed" outcome is correct in some classes of work (LTS bumps, mechanical translations, validated reference patterns); recording the conditions that justified the skip makes future analogous decisions cheaper.

---

#### [P-MED] Three-bucket architecture-gap classification structures the gap-review

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 3
**First synthesized**: 2026-04-27

On issues #157 technical-design and #177, the architecture-gap-review phase produced output structured as three explicit buckets: "Patterns Correctly Followed," "Patterns Missing from Architecture," "Patterns Incorrectly Followed." The structure forces the agent to enumerate the universe of patterns, not just the ones that pass — and produced concrete recommendations the reviewer could approve in one round. **#231 design-phase retrospective (2026-05-03)** validated the structure across 7 unanimous "Agreed" responses on architecture-gap candidates. **#273 design phase (2026-05-04)** added a 3rd recurrence: 5 patterns correctly followed + 2 missing-from-architecture + 1 incorrectly-followed-in-production-but-not-in-this-RFC (worker `QUEUE_MODE=inline` deploy state, surfaced as a cross-issue finding for #274). The "incorrectly followed in production but not in this RFC's design" sub-classification was a useful refinement — it surfaced a separate issue without conflating it with this RFC's design soundness. Validated principle: when a phase asks "did we follow the architecture?" the answer needs structured buckets, not a narrative. The bucket count signals coverage; per-bucket entries signal action items. Sub-classify the third bucket (Incorrectly Followed) when relevant: design-error vs production-state-divergence-tracked-elsewhere.

---


#### [P-HIGH] PR scope discipline holds under multiple side-quests in one session (R21 carrying)

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR2 (PR #201, 2026-04-30), Phase 12 (address-feedback) hit three unrelated obstacles in sequence: a freshly-published Clerk CVE blocking the audit gate, an over-aggressive `pnpm.overrides` hotfix that broke apps/web's build, and a JTBD spec re-segmentation discussion that surfaced a "weak POV" call against the existing picker. Each could have been bundled into PR #201 ("I can fix this on the same branch in 5 minutes"). All three were instead spun out: #218 (rate-limiting), #219 (Clerk CVE — closed via PRs #220 + #221), and #217 (JTBD re-segmentation). PR #201's final diff stayed exactly its original scope — 15 files, +2345/-13. The cost paid off concretely when PR #220's first attempt at the Clerk fix needed its own hotfix #221 — those iterations didn't muddy PR #201's history. R21 is the load-bearing rule and it carried under three simultaneous interruptions. Validated principle: when an unrelated fix surfaces during an in-flight PR's address-feedback phase, default to a separate-branch + new-issue path, even when the temptation to bundle is strong. **The frame to use**: "this issue blocks all PRs against main, not just this PR — that's a fair argument for treating it as repo infrastructure not feature-PR work." That framing converts the bundling temptation into a separation argument.

---

#### [P-MED] Logger injection over console / module-level singletons for testability + structural correctness

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR1 Round 1 review (PR #197, 2026-04-27), reviewer flagged two `console.error` calls in `clerk-identity-provider.ts` orphan-cleanup paths as ESLint warnings. Replacement options: (a) eslint-disable, (b) module-level logger import, (c) injected `logger: { error(obj, msg): void }` constructor param. Picked (c). The Fastify plugin passes `fastify.log`; tests pass a `vi.fn()`-shaped mock; the existing orphan-cleanup test extended in-place to assert `logger.error` was called with the expected metadata. Validated principle: when ESLint flags `console.*` in production code, the right fix is constructor-injected Pino-shaped logger — not eslint-disable, not a module-level import. The pattern generalizes to any provider abstraction that wraps a vendor SDK and needs to log internal failures. Cost: ~5 lines of constructor + interface change; benefit: structurally clean dependency, mockable in tests, consistent with the rest of the Fastify ecosystem.

---

#### [P-MED] Merge-into-branch over rebase when conflicts touch evolving shared surfaces under squash-merge

**Score**: 5.0
**Last seen**: 2026-04-30
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR2 (PR #201, 2026-04-30), the branch had been off main for 2 days while waiting for partner approval. Five conflicts surfaced when re-syncing — `auth.ts`, `auth.test.ts`, `members.ts`, `architecture.md`, `170-implement-work-list.md`. The auth.ts conflict was semantically touchy (HEAD added `allowNoOrg`; main had layered DEV_BYPASS_AUTH on the same plugin). Rebase would replay each commit on top of main and could surface the same logical conflict 4-5 times across PR 2's history. Chose merge-into-branch instead: single conflict resolution moment, no force-push (preserves partner's local checkouts and any review-thread anchors), final history identical because CustomerEQ uses squash-merge (`gh pr merge --squash`). After resolution: typecheck 0 errors, lint 0/0, full test suite 346/346. CI green. Validated principle: rebase is the convention for "clean feature branches", but when conflicts touch genuinely-evolving shared surfaces (auth/identity/middleware), merge-in is the conservative call. The deciding factor is the squash-merge workflow — it makes "linear history on the branch" moot because the branch's merge commit gets squashed away on merge to main.

---

#### [P-MED] CI and CD gates answer different questions; explicit carve-out documents the boundary

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 1
**First synthesized**: 2026-05-04

On #273 PR #275 Round 1 design feedback, the user asked *"the probe checking if the image is activated — should it be in CI or CD?"* The reflexive answer (pick one) was wrong; the right answer was to make the carve-out explicit: CI = code-load gate (does the image's code load cleanly in isolation? — catches `ERR_MODULE_NOT_FOUND`, broken imports, missing dist files; cheap, no prod infra), CD = deployed-revision gate (does the deployed revision serve traffic against real prod infra? — catches env-var misconfiguration, secret/identity issues, DB/Redis connectivity). RFC was updated to include a CI-vs-CD comparison table making the boundary durable; no future design will relitigate it. Empirical motivation: the existing CD `Verify API health` gate was silently skipped for 16 days because an unrelated workflow step (#272 demo storefront) failed earlier — a CI-only or CD-only design would have left that hole. Validated principle: when a "should this gate live in X or Y" question has the form "X and Y answer different questions," the right answer is "both, with an explicit carve-out." Document the boundary in the spec/RFC; do not rely on tribal knowledge to keep the gates non-overlapping.

---

#### [P-MED] Grep cross-references before renumbering structural docs

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 1
**First synthesized**: 2026-05-04

On #273 implementation, when adding a new "AI Layer" sub-section to `architecture.md`, the initial instinct was to insert it between §3.5 (Shared Layer) and §3.6 (UI Layer), shifting UI to §3.7 and Embed to §3.8. A quick `grep -rE "§3\.[6-9]" docs/` caught that `docs/feature-specs/170-onboarding-first-run.md` cross-references `§3.7` (UI Layer) — renumbering would have silently broken that reference. Instead, appended the new section as `§3.8` (after Embed Layer), keeping all existing numbering and cross-refs intact. Validated principle: when adding a new section/layer/subsection to a long structural document, prefer **append-at-end** over **insert-and-renumber**, even if the result is less topologically perfect. Always grep `§<N>\.<n>` and `<filename>:<n>` patterns across the docs/ tree before any renumbering; if any cross-reference would shift, append instead. The renumbering temptation is symmetric with "fix at the highest abstraction" — sometimes the right answer is "stay where the variance lives."

---

#### [P-HIGH] Per-thread PR replies posted at resolution time (not just feedback file or commit message)

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 4 (cumulative across spec/design rounds since 2026-05-03)
**First synthesized**: 2026-05-05

Originally captured as a mistake-pattern after #231 PR #259 (P-MED, "Did not post per-thread replies on PR review comments"). Now consistently firing as a validated practice across review rounds: (1) #231 PR #259 round 1 — 18 inline comments → 18 per-thread replies citing resolving commit; (2) #276 PR #282 spec round 1 — 11 review comments → 11 per-thread replies (all with `c9093fc` commit hash + one-line resolution summary); (3) #276 PR #282 design round 1 — 6 review comments → 6 per-thread replies (`3e8a809`); (4) #270 PR #280 review — 1 review comment got the same treatment (`fbfb121`). The reviewer's `is_outdated: false` flags after each round confirm the threads read as actively closed. **Rule**: when addressing PR review comments, post a per-thread reply at resolution time. Use `mcp__github__add_reply_to_pull_request_comment` (REST: `POST /pulls/N/comments/<id>/replies`). Each reply cites: (a) the resolving commit SHA, (b) a one-line summary of how the issue was resolved (or "Confirmed — recommended answer kept" for approvals). The feedback file remains the durable evidence record; PR-thread replies are the live communication channel reviewers actually scan. The pattern scales to any review round size (6, 11, 18+ comments) and is fast enough as a parallel batch. Promotes from mistake-pattern (where it was captured as a gap) to validated-pattern (now the default behavior).

---

#### [P-HIGH] Multiple feedback memories firing correctly within a single session

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 10
**First synthesized**: 2026-04-27

Saved feedback memories now consistently fire in-session and shape behavior without explicit recall. On issue #166, two memories triggered (`feedback_fraim_before_plan_mode`, `feedback_dont_ask_about_baseline_dev_env`) and produced clean phase progression with no rework. On issue #170 spec, five memories fired and Round 1 was visibly cleaner than the start of #179. On issue #170 RFC + implementation phase 1 (2026-04-27), five+ memories fired across the technical-design and implementation-scoping phases. On issue #177, three memories fired and the Node 22 bump shipped on the first pass. **#170 PR2** added a 5th recurrence: three new memories saved in-session and two fired within the same conversation. **The 2026-05-03 sleep-on-learnings cycle adds a 6th recurrence**: the issue-255 retrospective `## Where Past Learnings Actually Fired` section explicitly cites three L1 patterns firing in-session. **The 2026-05-04 #273 cycle adds 7th and 8th recurrences** across two retrospectives in one day citing 8 firings between them. **The 2026-05-05 cycle adds 9th and 10th recurrences across #270 and #276 spec retros**: #270 retro cites 5 firings (Migration not validated against real DB, Skipped FRAIM phase mentoring, Reply on PR threads, Diagnose script before externals, RFC-claimed-files-not-verified — the latter two firing in the right direction by *not* repeating the mistake); #276 spec retro cites 5 firings (Reply on PR threads with all 11/11, Asserted facts about file/config — proactively read schema/resolver before claiming, Branch scope hygiene R21 — filed #281 separately during prep, Decision-points-at-PR-body-bottom — Q1/Q2/Q3 in PR body answered in 17 min, Overcorrected toward generating unnecessary artifacts — did NOT pad the competitor matrix). Validated principle: invest in the memory channel — durable lessons saved as `feedback_*.md` produce measurable efficiency gains across compounding sessions, AND can fire usefully within the same session if the structure (Why + How-to-apply) is concrete enough. **Strengthening corollary**: retrospectives that explicitly enumerate which prior learnings fired (and where) reinforce the channel — the act of writing "this past learning saved me X minutes today" makes the next firing more likely. Ten recurrences across multiple issues confirms it is a load-bearing pattern of agent behavior.

---

#### [P-HIGH] Open decisions framed with `← recommended` get one-round answers

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 8
**First synthesized**: 2026-04-27

On issue #2, both open decisions (OD-1 packages/ui placement, OD-2 pagination backfill) resolved in a single round because each had a recommended default. On issue #170 spec, OD-1 through OD-5 all resolved in single review rounds — most as one-word "Agreed", one reversed cleanly with a one-line rationale, one added new. On issue #170 RFC PR #196, four "Decisions for the reviewer" resolved across two rounds (3 accepted defaults + 1 clean reversal on the planTier placeholder). On issue #170 implementation phase 1 (2026-04-27), four pre-execution decisions resolved in a single chat turn. On issue #177, three "Decisions for you" at PR-body bottom got three answers in a single chat turn. **#170 PR1 (2026-04-27) added a 5th recurrence**: the structured-decisions block on PR #197 got "go with a)" the moment it was visible. **#170 PR2 (2026-04-30) added a 6th recurrence in two flavors**: (a) Clerk CVE Path A vs B framing got a one-message "Yes, take Path A"; (b) the merge-vs-rebase trade-off table got "Would 2 be safer if we merge main into branch?" — same-message resolution. **The 2026-05-05 #276 cycle adds 7th and 8th recurrences across spec and design rounds**: (7) Spec round 1 — Q1/Q2/Q3 surfaced as a numbered table at the bottom of PR #282 with recommended + alternative + tradeoff; reviewer answered with 1-word/2-word inline replies ("Null is fine.", "Reuse", "All Surveys across all organizations.") within 17 minutes of the PR opening. (8) Design round 1 — 4 decisions surfaced in the same shape (migration split, audit-plugin Option, consentReason max length, resolver source label); reviewer answered all 4 inline ("Two files...", "Option A", "500 should be enough.", "Don't add") with 3 confirming the recommended and 1 overriding cleanly. Validated principle: numbered/lettered options + one-line tradeoff each + explicit `← recommended` is the user's preferred decision format. Default to it for any non-trivial decision-set. The pattern scales from 2-3 decisions to 4 in one PR (still single-batch). When an answer overrides the recommended, the override is also delivered in the same one-line shape — confirming the table format works in both directions.

---

#### [P-MED] Decision-points-at-PR-body-bottom format for fast review

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 6
**First synthesized**: 2026-04-27

On issue #177 (PR #188), the PR description ended with three numbered "Decisions for you" — each a binary or ternary choice with one-line tradeoffs and a recommended default. The user answered all three in a single chat turn. **#170 PR1 added a 2nd recurrence** via `gh pr edit` to add a structured decisions section. **#170 PR2 added a 3rd recurrence** with two reviewer decisions. **The Clerk CVE Path A vs B framing in chat** added a 4th recurrence. **The 2026-05-05 #276 cycle adds 5th and 6th recurrences**: (5) Spec PR #282 body surfaced Q1/Q2/Q3 in a "Open question resolutions (please weigh in)" table at the top; reviewer answered all three inline within the table itself with one-word replies. (6) Design round 1 added 4 more decisions (migration split, audit-plugin shape, max length, source label); same table format; same one-word inline answers. Validated principle: when an RFC or implementation PR has 2-4 design decisions the reviewer must make, surface them as a numbered list with `← recommended` defaults. Reviewer answers in one batch; agent applies in one follow-up commit. **Stronger phrasing after recurrence #6**: this is now a *required* pattern for any PR with reviewable design decisions, not just a nice-to-have.

---

#### [P-MED] Filing backlog issues proactively for deferred work

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 9
**First synthesized**: 2026-04-27

Whenever a design review defers a decision or a follow-up to a future phase, file the corresponding tracking artifact at decision time, not "when we get there." On issue #2, filed #34 for Phase 2 packages/ui extraction without being asked. On issue #157 technical-design, recommended a follow-up issue. On issue #170 spec Round 2, filed **#189** + **#190** before referencing them. **#170 PR1 added a 4th recurrence**: filed **#198** for the SurveyTheme drift in the same commit as the Round 1 fixes. **#170 PR2 added 5th-7th recurrences**: filed **#217**, **#218**, **#219** at the moment each deferral surfaced. **The 2026-05-05 #276 cycle adds 8th and 9th recurrences**: (8) Filed **#281** (CREATE TYPE non-idempotency in #231 PR1) during #276 worktree-prep dev-DB recovery — same shape as #270 but in a different migration; filed without bundling onto the active #276 branch (R21). (9) After #282 merge, filed **#283** as a sub-issue of #241 carrying the deferred PATCH endpoint contract, audit-plugin Option A extension, survey-editor UX, plus all 7 binding decisions from the spec + RFC review rounds — full handoff context, not "I'll write it up later." Validated principle: deferrals without trackers decay into lost context; proactive issue-filing converts "we'll do it later" into a concrete artifact. **Strengthening corollary after recurrence #9**: when deferring scope to a sibling/parent issue, the tracking issue MUST be self-contained (binding decisions, design notes, reviewer constraints carried forward) — not a one-line "see #N for context." A future agent picking it up should not need to re-read the entire source PR's review threads.

---

#### [P-MED] Caught `package-lock.json` pollution via `git status` pre-stage check

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 4
**First synthesized**: 2026-04-27

On issue #166, `~/.fraim/scripts/prep-issue.sh` ran `npm install` and modified `package-lock.json` with 221 lines of unrelated churn. A quick `git status` before staging surfaced the pollution; `git checkout -- package-lock.json` cleaned it. **#273 implementation (2026-05-04) added a 2nd recurrence** with the same prep-issue.sh trap. **The 2026-05-05 cycle adds 3rd and 4th recurrences**: prep-issue.sh ran for #270 worktree (3rd) and again for #276 worktree (4th); both times `git status` showed `M package-lock.json` and `git checkout -- package-lock.json` cleaned it before staging. Validated principle: always run `git status` — never `git add -A` or `git add .` — immediately before staging, regardless of how confident you are in what the diff contains. **Stronger phrasing after 4 recurrences**: this is a deterministic side-effect of `prep-issue.sh` in pnpm repos, not an occasional surprise. The defensive habit is non-negotiable for any worktree set up by that script. Pair-pattern with L1 mistake-pattern *"prep-issue.sh runs npm install in pnpm-only repo"*.

