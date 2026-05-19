# Validated Patterns — manohar.madhira@outlook.com

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

**Last synthesized**: 2026-05-17

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
**Last seen**: 2026-05-17
**Recurrences**: 3
**First synthesized**: 2026-04-27

During design-completeness-review for issue #2, the requirements traceability matrix surfaced that "tier removal blocked if members in tier" had no implementation path — `Member` had no `currentTierId` field. A pure design-review narrative would not have caught this. On issue #170 spec, the matrix caught a 5-step checklist that didn't match #170's named milestones verbatim — fixed before submit.

**#378 design Phase 5 (2026-05-17) added 3rd recurrence**: traceability matrix mapped 29 functional R-items + 24 NFRs + 11 compliance items + 4 issue success criteria + 32 validation-plan hooks → all to specific RFC sections / Zod schemas / file-level changes. **Zero Unmet rows**. The matrix also drove a mock-vs-RFC parity check (6/6 scenes mapped) which is a sister-validation pattern.

Validated principle: traceability matrices are not redundant with design review; they catch a specific class of gap (AC → schema field / mock element coverage) that prose review misses. Treat the matrix as a mandatory artifact for any design-completeness-review phase with >10 requirements.

---

#### [P-HIGH] Found hidden second-order risk during deep code/audit read

**Score**: 8.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: 2026-04-27

On issue #157 technical-design, reading the duplicate `new/page.tsx` and edit page implementations for Alert Rules surfaced ~450 LOC × 2 form duplication. A surface-level read of just the navigation files would have missed it; the RFC explicitly elevated form extraction to a primary deliverable rather than a side cleanup. On issue #177, the parallel Explore audit surfaced that **CI does not build the production Dockerfiles** — the highest residual risk in a Node 22 LTS bump, which a literal AC reading would have missed. Validated principle: deep reads (full file contents, parallel Explore agents) reliably surface second-order architectural risks beyond the stated ACs. Budget the time; the discovery rate justifies it.

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



#### [P-HIGH] PR scope discipline holds under multiple side-quests in one session (R21 carrying)

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR2 (PR #201, 2026-04-30), Phase 12 (address-feedback) hit three unrelated obstacles in sequence: a freshly-published Clerk CVE blocking the audit gate, an over-aggressive `pnpm.overrides` hotfix that broke apps/web's build, and a JTBD spec re-segmentation discussion that surfaced a "weak POV" call against the existing picker. Each could have been bundled into PR #201 ("I can fix this on the same branch in 5 minutes"). All three were instead spun out: #218 (rate-limiting), #219 (Clerk CVE — closed via PRs #220 + #221), and #217 (JTBD re-segmentation). PR #201's final diff stayed exactly its original scope — 15 files, +2345/-13. The cost paid off concretely when PR #220's first attempt at the Clerk fix needed its own hotfix #221 — those iterations didn't muddy PR #201's history. R21 is the load-bearing rule and it carried under three simultaneous interruptions. Validated principle: when an unrelated fix surfaces during an in-flight PR's address-feedback phase, default to a separate-branch + new-issue path, even when the temptation to bundle is strong. **The frame to use**: "this issue blocks all PRs against main, not just this PR — that's a fair argument for treating it as repo infrastructure not feature-PR work." That framing converts the bundling temptation into a separation argument.

<!-- resolved 2026-05-16: Scope note — R21 governs off-scope fixes discovered during an in-flight PR's address-feedback phase (e.g., a CVE, a build break, a JTBD re-segmentation that blocks all PRs). It does NOT govern Phase 13 retros, coaching-moment captures, or post-merge work-list cleanups — those must ride on the parent feature branch per Rule 26. The "frame to use" paragraph above is correct for off-scope infrastructure work; it is NOT a valid justification for spinning a chore-issue for Phase 13 artifacts. See project_rules.md Rule 26: "One PR Per Phase Artifact — No Chore-Issue Splits." -->

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

#### [P-MED] Decision-points-at-PR-body-bottom format for fast review

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 6
**First synthesized**: 2026-04-27

On issue #177 (PR #188), the PR description ended with three numbered "Decisions for you" — each a binary or ternary choice with one-line tradeoffs and a recommended default. The user answered all three in a single chat turn. **#170 PR1 added a 2nd recurrence** via `gh pr edit` to add a structured decisions section. **#170 PR2 added a 3rd recurrence** with two reviewer decisions. **The Clerk CVE Path A vs B framing in chat** added a 4th recurrence. **The 2026-05-05 #276 cycle adds 5th and 6th recurrences**: (5) Spec PR #282 body surfaced Q1/Q2/Q3 in a "Open question resolutions (please weigh in)" table at the top; reviewer answered all three inline within the table itself with one-word replies. (6) Design round 1 added 4 more decisions (migration split, audit-plugin shape, max length, source label); same table format; same one-word inline answers. Validated principle: when an RFC or implementation PR has 2-4 design decisions the reviewer must make, surface them as a numbered list with `← recommended` defaults. Reviewer answers in one batch; agent applies in one follow-up commit. **Stronger phrasing after recurrence #6**: this is now a *required* pattern for any PR with reviewable design decisions, not just a nice-to-have.

---

#### [P-HIGH] User pushback caught a near-miss before submit

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 11
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 2 new recurrences appended:]

**#291 impl PR #296 (2026-05-07) added 9th recurrence in two flavors**: (a) reviewer's *"We have run integration tests before locally from the .env available on main worktree, why skip now?"* caught the agent's premature "infra gap" declaration — 297/297 integration tests passed after the fix. (b) reviewer's *"Why don't you bring up the dev server?"* triggered a Playwright e2e run; CREATE-mode prune e2e passed (4.7s) and pre-existing EDIT-mode failures were correctly diagnosed against `origin/main`. **#371 PR #372 (2026-05-14) added 10th recurrence**: *"Have you tested these?"* caught the unit-test-only Phase-5 deferral. The live-browser proof that followed (`NEXT_PUBLIC_DEV_BYPASS_AUTH=true` + killed API → `GET /admin/surveys/new 307 → /admin/surveys?error=auth-failed 200`) is the *exact failure mode* the production user hit and proved the route now handles it cleanly.

**#378 design phase (2026-05-17) added 11th recurrence in three flavors**: (a) reviewer's *"Cross check each claim made in the RFC with actual code and documents. You have erred in the past by making false claims causing issues during implementation"* caught the 5 RFC inaccuracies (F-1..F-5) before they reached the impl phase — including two structural ones (tenant-scoping framing wrong; public-route audit row would silently not persist). (b) reviewer's *"Why did the RFC create a new PR instead of a new commit on #385? We just had the discussion."* caught the Rule 26 misread before the design phase's structural shape compounded. (c) reviewer's *"Run a Spike for this"* on OD-2 caught the merit-over-ease shortcut before the RFC's library-vs-roll-our-own framing landed in implementation. Validated principle continues to hold: a single-question pushback is a hard signal — do a real audit and surface gaps explicitly rather than answering reflexively. The three 2026-05-17 pushbacks each prevented a downstream impl-rework cycle.

---

#### [P-HIGH] Per-thread PR replies posted at resolution time (not just feedback file or commit message)

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 7 (cumulative across spec/design/impl rounds since 2026-05-03)
**First synthesized**: 2026-05-05

[Body preserved from existing entry, with 3 new recurrences appended:]

**#291 cycle (2026-05-07) added 5th and 6th recurrences across three rounds**: (5) spec PR #295 — all 11 inline review comments got their own reply with resolving SHA at the moment they were addressed; reviewer's `is_outdated: false` confirmed threads read as actively closed. (6) impl PR #296 — both reviewer pushbacks (integration test infra gap + dev server start) got specific corrective commits (`d483f52`, `12f5e88`) with per-thread PR replies citing the resolving SHA.

**#378 design Round 1 (2026-05-17) added 7th recurrence**: PR #385 received 15 inline review comments at design phase R1 (across §Brand-TZ formatting, §Confidence Level, OD-1..OD-5, Architecture Analysis M-1..M-5). All 15 received per-thread replies posted via `mcp__github__add_reply_to_pull_request_comment` citing the resolving commit `19e662a` + a one-line resolution. Posted in a single parallel batch (15 tool calls in one message). Threads now read as actively closed. Pattern confirmed across 7 distinct PRs covering spec/design phases — the parallel-batch shape scales to 15-comment rounds in ~3 minutes.

---

#### [P-HIGH] Multiple feedback memories firing correctly within a single session

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 12
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 2 new recurrences appended:]

**#371 retro (2026-05-14) adds 11th recurrence**: 4 memories cited firing in-session — `validate-phase-must-run-build`, `check-pr-comments-before-merge`, `no-ask-user-question-dialog`, and Rule 25b destructive-action discipline. The retro framed it as "memories saved me from the exact wrong move documented in the rule's origin incident".

**#378 design phase (2026-05-17) added 12th recurrence**: 10 memories cited firing in-session — `check_pr_comments_before_merge` (ran `get_review_comments` + `get_reviews` + `get_comments` rather than relying on PR status alone); `no_ask_user_question_dialog` (presented choices as plain-text numbered lists for inline reply); `Per-thread PR replies posted at resolution time` (15 replies in parallel batch); `Open decisions framed with ← recommended` (R1 answered in one-batch); `Three-bucket gap classification` (Phase 4 produced 20+5+0); `Traceability matrix` (Phase 5 zero-Unmet); `Pre-execution confirmation on multi-section rewrites` (Q1-Q3 surfaced before R1 mass-edit); `Show full draft before publishing to external surfaces` (pre-show on #264 + #218 bodies); Rule 25b destructive-action discipline (`--force-with-lease` over `--force`; cherry-pick + close-without-merge over reset); `one_pr_per_phase_artifact` (fired AFTER user correction — captured as a coaching moment for the late-firing pattern).

---

#### [P-HIGH] Open decisions framed with `← recommended` get one-round answers

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 11
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 3 new recurrences appended:]

**#291 cycle (2026-05-07) added 9th and 10th recurrences**: (9) Spec DR1/DR2/DR3 surfaced as a numbered table at top of PR #295 body; reviewer answered DR2 with one-word "Agree with rename" and DR3 with one-word "Directly on Survey as columns" inline within 17 min. (10) Design RFC architecture-doc question framed in `← recommended` shape; reviewer answered "Agreed" in one word; doc edit landed in the same address-feedback commit.

**#378 design phase (2026-05-17) added 11th recurrence**: RFC body surfaced 5 Open Decisions (OD-1..OD-5) with `← recommended` defaults. Reviewer answered all 5 across two messages: 4 inline `"Agreed"` / direct override comments + 1 spike directive. The Round-1-feedback bodies + spike-scope clarification (Q1-Q3) + per-thread mapping all got one-batch responses from the reviewer. Pattern now confirmed across 11 distinct issues spanning multiple FRAIM job types (feature-specification, technical-design, implementation), scaling from 2-3 decisions to 5 per PR.

---

#### [P-MED] Filing backlog issues proactively for deferred work

**Score**: 5.0
**Last seen**: 2026-05-17
**Recurrences**: 12
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 3 new recurrences appended:]

**#335 Slice 4a (2026-05-13) added 10th recurrence**: filed #354 (Round 1 work-list cleanup) immediately, with full handoff context. **#343 (2026-05-12) added 11th recurrence**: three follow-up PRs filed in sequence — #348 (dorny→shell-step rewrite), #350 (work-list cleanup), #352 (YAML # truncation + dorny seed-pattern bug) — each surfaced from a specific post-merge failure mode, none bundled onto the active branch. R21 held throughout 3 rounds of regression cycles.

**#378 design phase (2026-05-17) added 12th recurrence in two refined shapes**: (a) `gh issue list --search` BEFORE filing a new tracker — found #218 already exists with the exact rate-limit scope, posted AC-addition comment as a #378 trigger criteria rather than filing a redundant new issue (R1-9 R1 review-comment). (b) For deferred work whose dependency-issue already exists (#264 worker erasure job, OPEN), augmented the existing issue's AC with the specific contract #378 depends on (the `audienceSpec.identifiersResolved[].identifier → '[redacted]'` redaction rule) — comment posted at #264 issuecomment-4472048119. **Pattern refinement**: before filing a new backlog issue, search for an existing tracker; if one exists with overlapping scope, comment on it with the additional context rather than creating a duplicate. Posted at #218 issuecomment-4472048244 (rate-limit trigger criteria).

<!-- resolved 2026-05-16: Rule 26 correction — PRs #350 and #354 are Rule 26 violations (Phase 13 chore-issue splits), not validated filing patterns. The principle of filing backlog issues proactively remains valid for genuine deferred work — PRs #348 (dorny→shell-step rewrite) and #352 (YAML truncation + dorny seed-pattern bug) are legitimate examples because they address real post-merge failure modes that are not Phase 13 retro/coaching artifacts. Remove PRs #350 and #354 from the canonical examples set; they must not be cited to endorse chore-issue splits for Phase 13 artifacts. See project_rules.md Rule 26: "One PR Per Phase Artifact — No Chore-Issue Splits." -->

---

#### [P-MED] Caught `package-lock.json` pollution via `git status` pre-stage check

**Score**: 5.0
**Last seen**: 2026-05-12
**Recurrences**: 6
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 2 new recurrences appended:]

**#343 cycle (2026-05-12) added 5th and 6th recurrences**: prep-issue.sh's `npm install` modified `package-lock.json` by 1687 lines on both #343 and #347 worktrees; `git status` flagged each; `git restore package-lock.json` cleaned before staging. Pattern now confirmed across 6 worktree setups in 2026-05 (Slice 3 / #343 / #347 / #349 / #351 / #336) — deterministic side-effect of `prep-issue.sh` in pnpm repos. Captured as candidate upstream FRAIM fix (`mathursrus/FRAIM` script should default to pnpm when `pnpm-lock.yaml` exists).

---

#### [P-HIGH] Documentation-and-codebase spike (no PoC) is sufficient for **correctness-only** abstraction-shape questions

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 3
**First synthesized**: 2026-04-27

<!-- resolved 2026-05-17 (sleep-on-learnings option b): scope clarified to **correctness-only** abstraction-shape questions. NOT sufficient when the deciding axis is ergonomics + maintenance cost — those questions warrant a real spike because the candidate's stated advantage may itself be the shortcut-shaped framing that the preference `Merit over ease` prohibits. #378 OD-2 (2026-05-17) is the canonical mis-fire example. -->

For **correctness-only** abstraction-shape questions — *"does this generator have a config option for X?"*, *"does this interface match how the SDK works?"*, *"does Prisma's RENAME preserve FKs?"* — a documentation-and-codebase reading spike is sufficient and a runnable PoC is overkill. On issue #166 the deploy.yml `workflow_run.head_sha` fallback was resolved via GitHub Actions docs in ~5 minutes; #170 RFC's IdentityProvider interface shape was answered by `@clerk/backend` docs + grep; #291 RFC's Prisma 5.x rename behavior was answered by Prisma docs + the existing `20260430000000_patch_survey_distribution_gap` migration as the in-tree pattern.

**Scope clarification (mis-fire on #378 OD-2, 2026-05-17)**: agent applied this pattern in Phase 3 of #378's technical-design — declared `SKIPPED` with rationale *"documentation-and-codebase spike sufficient"* for OD-2 (Brand-timezone library: native `Intl` vs `date-fns-tz`). Reviewer overruled at R1-3: *"Why is it not as simple as getting current time in Brand's timezone, doing the math and updating time to 23:59:59.999 for the date returned? Run a Spike for this."* The spike then ran with 15 test cases and 3 candidate approaches; result was that **correctness was never the deciding axis** — all 3 approaches converged byte-identical UTC outputs. The deciding axis was **ergonomics + maintenance cost**, which the spike's data made concrete: `date-fns-tz` `zonedTimeToUtc(...)` is one line; native Intl + `wallClockToUtc` helper is ~30 lines. Library wins on merit. OD-2 reversed to 2b post-spike.

**Refined application rule**: this pattern fires only when the question is *"does X work / what does X return / what shape does X have?"* (correctness). When the question is *"should we use X or Y?"* with the candidate's stated advantage being *"no new dep / smaller diff / drop-in swap / fewer lines"* (ergonomics + maintenance cost), the pattern does NOT fire — run a real spike, because the shortcut-shaped framing is itself the signal that the durable answer hasn't been validated. Cross-reference: preference `Merit over ease` (P-HIGH 8.0) — the spike's deciding axis can shift the recommendation away from the shortcut-shaped candidate.

---

#### [P-MED] Three-bucket architecture-gap classification structures the gap-review

**Score**: 5.0
**Last seen**: 2026-05-17
**Recurrences**: 5
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 2 new recurrences appended:]

**#291 design phase (2026-05-07) added 4th recurrence**: 7 patterns correctly followed + 2 missing from architecture + 0 incorrectly followed. The third "Patterns Missing" candidate (public survey API select-set) was correctly deferred as single-data-point — restraint pattern firing. Reviewer "Agreed" on architecture-doc Recommendation paragraph in one word; doc edit landed in same address-feedback commit.

**#378 design phase (2026-05-17) added 5th recurrence**: Phase 4 architecture-gap-review produced 20 patterns correctly followed (verbatim cross-ref to `docs/architecture/architecture.md` sections §3.1, §3.2, §3.4, §6) + 5 patterns missing from architecture (M-1 hash-at-rest tokenized public endpoint, M-2 brand-TZ display utility, M-3 in-handler rate-limit with QUEUE_MODE parity, M-4 re-download = regenerate semantics, M-5 detail-page filter-row UX) + 0 patterns incorrectly followed. Reviewer signed off M-1/M-2/M-4 explicitly, accepted M-3 implicitly via OD-3a acceptance, deferred M-5 until a second occurrence. Pattern now confirmed across 5 RFC cycles.

---

#### [P-MED] Spike-skip rationale recorded explicitly when no PoC is needed

**Score**: 5.0
**Last seen**: 2026-05-07
**Recurrences**: 2
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 1 new recurrence appended:]

**#291 design phase (2026-05-07) added 2nd recurrence**: RFC's Spike Findings section documented the doc-and-codebase skip rationale in ~50 words rather than leaving "N/A" — so a future reviewer can confirm the skip rather than wondering why no PoC was built. Same shape as #177's Node 22 LTS-bump skip.

---

#### [P-HIGH] Reviewer reversals with one-line rationale resolve cleanly when accepted without re-arguing

**Score**: 8.0
**Last seen**: 2026-05-07
**Recurrences**: 2
**First synthesized**: 2026-04-27

[Body preserved from existing entry, with 1 new recurrence appended:]

**#291 spec round-2 correction (2026-05-07) added 2nd recurrence**: reviewer's one-line correction *"if data shows the fields are used, we need to migrate and backfill — not defer"* on the round-2 misread (where I had dropped Survey-side schema). Round 3 restored the schema move + added explicit 6-block migration SQL with `ADD → BACKFILL → DROP` ordering. The one-line rationale carried the load-bearing argument — applied across §2.4, §4, migration plan, and alternatives section in a single commit. Validated principle holds at the spec-correction layer the same way it does at the RFC-design layer.

---

#### [P-MED] `/follow-your-mentor` is a clean mid-stream recovery cycle

**Score**: 5.0
**Last seen**: 2026-05-17
**Recurrences**: 2
**First synthesized**: 2026-05-17

When a workflow discipline breaks mid-stream (an L1 rule violation, a phase boundary crossed wrong, a recommendation that contradicts the agent's own prior arguments), the FRAIM `follow-your-mentor` coaching job is a clean recovery path: 4 phases (`analyze-gap` → `document-learnings` → `fix-it` → `submit`) that diagnose the gap, capture an L0 coaching moment, fix the work, and submit the recovery — all under `seekMentoring` guidance. Validated across two sessions: (1) #378 spec Phase 5 (2026-05-15) — user invoked *"Follow your mentor — what do they say?"* after agent over-gated push+PR; recovery cycle ran cleanly: L1 read surfaced two rules, agent self-corrected, pushed + opened PR, captured `over-gated-push-pr-as-asking-for-deviation.md` in L0. (2) #378 design phase (2026-05-17) — user invoked *"Follow your mentor"* alongside an OD-2 reversal directive; recovery cycle ran cleanly: analyze-gap identified the merit-over-ease misfire, document-learnings captured `merit-over-ease-misfired-on-od-2.md`, fix-it executed RFC rewrite + spike + AC-additions on external trackers, submit posted round-complete summary on PR #385.

Validated principle: when a recovery is needed (agent has just been corrected, or agent self-diagnoses a workflow break mid-session), invoke `follow-your-mentor` as a structured coaching cycle rather than ad-hoc recovery. The 4-phase shape forces the agent to identify the gap explicitly, capture the learning durably, and submit the recovery through the same channel as the original work. Costs ~15 minutes; alternative (ad-hoc fix without structured coaching) loses the L0 coaching moment, the causal-chain analysis, and the discipline of submitting recovery evidence. Both 2026-05 invocations were initiated by the user as a single short directive; the agent should also recognize when to invoke it proactively after self-diagnosing a violation. **Strongest proactive trigger** (per the companion manager-coaching entry): BEFORE approaching the user with any question, check `follow-your-mentor` first — the coaching cycle's `analyze-gap` phase often resolves the question without user input.

---

#### [P-MED] Pre-show external GitHub publishing bodies before posting

**Score**: 5.0
**Last seen**: 2026-05-17
**Recurrences**: 3
**First synthesized**: 2026-05-17 (promoted to L1 from auto-memory `feedback_show_full_draft_before_publishing.md`)

Companion-pattern to user-side preference `feedback_show_full_draft_before_publishing.md`. When the agent is about to publish content to a shared/external surface the user can't easily iterate post-publish (GitHub issue body, comment on an issue, Slack, email), present the final body in chat first — fenced as a code block — and wait for user approval before the publishing call. Validated explicitly across three 2026-05-17 surfaces: (1) PR #385 spec retro published the body; user confirmed in chat. (2) #264 AC-addition comment for #378 erasure-job redaction contract — body pre-shown in chat; user approved with "yes" + minor edit directive ("Keep the comments short, not elaborate"); posted after approval at [issuecomment-4472048119](https://github.com/mathursrus/CustomerEQ/issues/264#issuecomment-4472048119). (3) #218 rate-limit adoption-trigger comment — body pre-shown; same approval cycle; posted at [issuecomment-4472048244](https://github.com/mathursrus/CustomerEQ/issues/218#issuecomment-4472048244).

**Exception — PR surfaces don't need pre-show** (per the user-side memory + 2026-05-17 user clarification: *"comment on PR can be reviewed by reviewer during PR review, so don't need a preview"*): `gh pr create`, `gh pr review`, per-thread PR review-comment replies, AND general top-level PR comments do NOT require pre-show. The user reviews these directly on the PR after submission. 15 per-thread replies + the round-complete summary comment on PR #385 R1 (2026-05-17) were posted without pre-show under this exception; the user did not push back. Validated principle: pre-show for issue bodies + issue comments + Slack/email; **skip pre-show for any PR comment or PR review action** — the PR is itself the review channel.
