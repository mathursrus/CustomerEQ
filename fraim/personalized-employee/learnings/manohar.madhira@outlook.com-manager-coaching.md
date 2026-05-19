# Manager Coaching — manohar.madhira@outlook.com

Patterns observed in how this user coaches, intervenes, and adjusts agent behavior during sessions. Signals for predicting where and how the user will push back, approve, or escalate.

**Last synthesized**: 2026-05-17

---

#### [P-HIGH] Single-question pushback, not a lecture, when approach needs correction

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 9
**First synthesized**: 2026-04-27

When the agent is on the wrong path, the user's intervention is consistently a single clean question — not a multi-paragraph explanation of what went wrong. Examples (chronological): *"Why are you individually updating style in each file? Isn't having global style a better pattern?"* (#71); *"Have you tested these?"* (#153); *"Is the mock in sync completely with the spec now?"* (#170 spec Round 2); *"Do we need a Spike to verify?"* (#170 RFC PR #196 Round 1, 2026-04-26); the planTier reversal one-liner *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely..."* (#170 RFC PR #196 Round 2, 2026-04-27); on #170 PR2 retrospective PR #222 (2026-04-30): *"This is a key learning moment. When presenting options, we should consider both 'with sunk cost' and without sunk cost."* The 2026-05-03 sleep-on-learnings cycle added three more recurrences in two days: *"Make sure your following FRAIM."* (#255, 2026-05-02); *"Why didn't you add replies to my comments? Doesn't FRAIM specify you to do so?"* (#231 PR #259, 2026-05-03); *"This statement is incorrect. This is the second occurrence..."* (#231 PR #259, 2026-05-03). **The 2026-05-05 #276 cycle adds a 9th recurrence with a new variant — the time/cost framing**: *"Coaching point - for production bug fixes keep the scope very tight to fixing production. This overengineering of scope both in feature spec and in RFC wasted a number of hours of my review."* This intervention is longer than the typical single-question shape (two sentences instead of one), but the load-bearing structure is the same: a direct rule statement + an explicit cost framing ("wasted a number of hours of my review"). The cost framing is a new severity signal worth tracking distinctly: when the user names the time/effort wasted, the correction is elevated severity even on first occurrence — comparable to repeat-offense framing ("second occurrence of...") in the sister-pattern below. Implication: treat any single interrogative, pointed observation, OR direct-rule-with-cost-framing as a full stop-and-reconsider signal. The question/observation/rule is the coaching itself — it forces the agent to surface the assumption it made and re-evaluate. The correct response is a reversal, not a defense — and a real audit, not a reflexive "yes, all good." When the cost framing is present (time/hours/effort wasted), capture as L0 coaching moment immediately AND prefix the next session's analogous decisions with the explicit avoidance check.

---

#### [P-HIGH] Escalates quality expectations at the submission gate (especially for UI)

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: 2026-04-27

The user's quality bar is highest right before submit, particularly for UI-facing work. On issue #153, the "Have you tested these?" pushback came when the agent was ready to submit based on typecheck + build passing. Submit-phase shortcuts (skipping browser validation, skipping manual reproduction, skipping golden-path E2E) reliably trigger intervention. Default behavior: before claiming the submit phase is complete for any user-facing change, explicitly enumerate and run the validation steps — do not assume CI passing is sufficient.

---

#### [P-MED] One-line approval once the PR is well-scoped and evidenced

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: 2026-04-27

When the PR body includes concrete evidence (linked failing run, diff summary, post-merge test plan, validation honesty about what can and cannot be tested pre-merge), the user approves with one line ("go ahead", "PR Looks Good. Merge with Main", "Agreed") and zero feedback rounds. Observed across issues #166 (PR #168), #170 spec (PR #187 final approval), and #177 (PR #188). Implication: invest in PR body quality; it directly shortens the review cycle. Decision-points-at-the-bottom-of-the-PR-body framing (see entry below) reinforces this.

---

#### [P-MED] Accepts validation honesty when paired with a post-merge plan

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-04-27

For changes that cannot be tested pre-merge (GitHub Actions `workflow_run`, concurrency semantics, prod-only integrations), the user accepts "this cannot be tested pre-merge" as a legitimate answer — provided the PR includes a concrete post-merge test checklist the reviewer can execute. Do not fabricate test coverage that cannot actually run; do not defer tests indefinitely. The honest answer plus a plan beats simulated coverage.

---

#### [P-MED] Decision points presented as numbered options resolve in one chat turn

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 4
**First synthesized**: 2026-04-27

When the agent surfaces design or scope decisions as numbered/lettered options at the bottom of a PR body or in the chat (each with a recommended default and a one-line tradeoff), the user answers all of them in a single chat turn. On issue #170 spec, the Round 1 and Round 2 pre-execution question batches got "yes to all" / "1b/2a/3b" style replies. On issue #170 implementation phase 1 (2026-04-27), four pre-execution decisions (slicing approach, sign-in strategy, API layout, ADR placement) got "1) 6 PRs, 2) keep Clerk catch-all, 3) flat, 4) agreed" in a single message. On issue #177, three "Decisions for you" at PR #188 body bottom got three answers in one chat turn. **#273 (2026-05-04) added a 4th recurrence in a high-stakes context**: at the merge gate of PR #275, the agent presented option A (merge now, monitor) / option B (merge with sequenced rollout) / option C (hold) — each with the deciding tradeoff named and risk implications spelled out. The user replied with a single character: "A". The merge unblocked 16 days of frozen prod state, and the structured framing made the high-stakes call decisive in one turn. Implication: this is the user's preferred decision-resolution format — adopt it for any non-trivial decision points rather than threading them inline. The pattern scales from low-stakes (RFC defaults) to high-stakes (production merge gates); the structure does not need to change with stakes.

---

#### [P-MED] "Looks good. Proceed to next phase" = phase advance approval, not a merge instruction

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC Round 2 close-out, the user wrote "Looks good. Proceed to next phase" after the agent had pushed Round 2 fixes and posted GitHub thread replies. Correct interpretation: the user is approving the phase work and instructing the agent to advance to Phase 8 (retrospective) — they are **not** authorizing a merge of PR #196. Merges still require explicit user action on GitHub (per `feedback_push_pr_always_merge_with_review.md`). Cross-reference with prior issue #170 spec close: there the user said *"PR Looks Good. Merge with Main. Don't close the issue or worktree yet"* — the explicit "Merge with Main" is the merge authorization; "proceed to next phase" is not. Lesson: distinguish phase-advance approval from merge authorization. The user's vocabulary signals which one they mean — match the action to the words exactly.

---

#### [P-MED] Push + PR is the default flow; merges require explicit GitHub review

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: 2026-04-27

Pushing a branch and opening a PR are the standard part of any submission flow — not actions that require per-run approval. Merges, however, wait for explicit user approval after they've reviewed on GitHub. The user stated this directly on 2026-04-24 after I over-gated three submission flows by stopping before push each time. Captured in feedback memory `feedback_push_pr_always_merge_with_review.md`. Issues / PRs are also not closed manually; the user closes via explicit ask ("merge and close" or similar) — captured in `feedback_user_does_not_manually_close.md`. Implication: when in doubt about an action's blast radius, push/PR are go; merge/close/force-push wait.

---

#### [P-MED] User asks where to confirm a decision = signal the decisions-block is missing or buried

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-05-01

When the user asks something like *"I don't see where I should confirm the signInUser decision"* — that is a deterministic signal that the PR body's decision-points are not surfaced as a structured `## Decisions for the reviewer` block. Observed on PR #197 (#170 PR1, 2026-04-27) when the agent buried the `signInUser` decision inside a 5-bullet "Deviations surfaced" paragraph instead of a numbered options block. Cost was small (~5 minutes to update the PR body via `gh pr edit`), but the question itself is the coaching cue: *"if the user has to ask where the decision is, the format failed."* Sister-pattern to "Single-question pushback" (above) — same pedagogy, different signature. Default response: do not justify the prose form; immediately edit the PR body to add a `## Decisions for the reviewer` section at the bottom with numbered options + `← recommended` defaults.

---

#### [P-MED] User explicitly frames a correction with "second occurrence" / "previously you mentioned" to signal repeat-offense severity

**Score**: 5.0
**Last seen**: 2026-05-03
**Recurrences**: 1
**First synthesized**: 2026-05-03

On 2026-05-03 PR #259 review (issue #231), the user wrote: *"This statement is incorrect. This is the second occurrence of not reading config file. Previously you mentioned you missed because fraim mentor guided you incorrectly."* The "second occurrence" framing is distinct from a one-off correction — it explicitly tracks pattern history and signals "this needs structural fix, not contextual fix." Useful predictor: when the user prefaces a correction with repeat-offense language ("again", "second time", "previously you...", "this is the Nth"), treat as elevated severity. Default response: (a) capture as L0 coaching moment immediately (don't just fix the surface issue), (b) check whether the underlying L1 entry needs broadening to cover the new instance, (c) acknowledge the repeat-offense framing explicitly in the reply rather than treating it as a single-instance correction. Sister-pattern to "Single-question pushback" — same coaching pedagogy, different signature signaling "I've seen this before, fix the pattern not the instance."

---

#### [P-HIGH] *"Follow your mentor"* as a stop-and-realign directive

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 2
**First synthesized**: 2026-05-17

The user uses the phrase *"Follow your mentor"* (sometimes followed by *"— what do they say?"*) as a single-directive coaching intervention that invokes the FRAIM `follow-your-mentor` job. The directive signals: (a) the agent is on the wrong path or has just been corrected; (b) the right next move is NOT ad-hoc recovery but the structured 4-phase coaching cycle (`analyze-gap` → `document-learnings` → `fix-it` → `submit`); (c) the user expects the agent to consult the L1 corpus, identify the rule that fired (or should have fired), capture an L0 coaching moment, and submit the recovery through the same channel as the original work.

Observed twice in 2026-05:
- **2026-05-15** (issue #378 spec Phase 5): user invoked *"Follow your mentor — what do they say?"* after agent over-gated push + PR open with a three-option ask. Agent read L1, surfaced the relevant rules (the *"Asked user to confirm deviation"* mistake-pattern + the *"Push + PR is the default flow"* manager-coaching), self-corrected, pushed + opened PR, captured raw L0 `over-gated-push-pr-as-asking-for-deviation.md`.
- **2026-05-17** (issue #378 design phase, post-OD-2-reversal): user appended *"Follow your mentor"* to *"OK to proceed."* directing the agent to apply the coaching discipline alongside the RFC rewrite. Agent ran the full 4-phase cycle (`analyze-gap` for the OD-2 merit-over-ease misfire; `document-learnings` writing `merit-over-ease-misfired-on-od-2.md`; `fix-it` executing the RFC rewrite + spike + per-thread replies + AC additions; `submit` posting the round-complete summary on PR #385).

**Predictor for the agent**: when the user says *"Follow your mentor"* or any close variant (*"What do they say?"*, *"Listen to your mentor"*, *"Check with FRAIM"*), the right immediate action is:
1. Call `mcp__fraim__get_fraim_job({ job: "follow-your-mentor" })` to get the phased instructions.
2. Call `seekMentoring(currentPhase: "starting", status: "starting")` to enter Phase 1.
3. NOT proceed with the original work until the coaching cycle has identified the gap and captured the learning.

The directive is itself a coaching signal — short, prescriptive, and points at a specific FRAIM job rather than asking for elaboration. Captured durably across two coaching moments. Sister-pattern to *"Single-question pushback, not a lecture"* (P-HIGH 8.0) — same short-form intervention, different signature: this one invokes a named FRAIM coaching job by reference rather than naming the underlying rule. Both work as drop-everything-and-reconsider signals.

**Proactive use — STRONGEST trigger** (per user directive 2026-05-17 *"before approaching user for a question, check follow your mentor. Need not wait for user to prompt running Follow your mentor"*):

**BEFORE approaching the user with any question, check `follow-your-mentor` first.** The agent should invoke `follow-your-mentor` proactively (without being prompted) when ANY of these triggers fire:

1. **About to ask the user a question.** Many user-bound questions are actually agent-can-resolve-via-mentor questions in disguise — the coaching cycle's `analyze-gap` phase resolves them by surfacing the relevant L1 rule. The cost of the user resolving a question the corpus already answers is high (user time + erosion of trust); the cost of running the coaching cycle first is small (~5 min for the `analyze-gap` phase alone).
2. **Self-diagnosed workflow violation.** The agent realizes mid-session that it just violated an L1 rule it had in memory (e.g., the moment after writing "← recommended" for a shortcut-shaped option; the moment after creating a new PR for a phase artifact; the moment after drafting from an agent summary instead of primary source). The 2026-05-17 OD-2 violation could have been caught proactively with this trigger.
3. **Recommendation contradicts the agent's own prior arguments.** When the agent's `← recommended` choice contradicts a citation it just made (e.g., recommending `?t=<token>` after just citing query-string-as-credential leakage as the reason to retire `?email=`), the contradiction itself is the self-trigger.

The user's *"Follow your mentor"* directive is the **reactive** entry point — the agent has already missed; the user is correcting. The proactive triggers above are the **preventive** entry points — the agent invokes the coaching cycle before the user has to. Both routes go through the same 4 phases; the difference is whether the user paid the time cost of having to invoke it.
