# Manager Coaching — manohar.madhira@outlook.com

Patterns observed in how this user coaches, intervenes, and adjusts agent behavior during sessions. Signals for predicting where and how the user will push back, approve, or escalate.

---

## ⏳ Pending Review — 2026-04-26

### Proposed new entries

#### [P-HIGH] Single-question pushback, not a lecture, when approach needs correction

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

When the agent is on the wrong path, the user's intervention is consistently a single clean question — not a multi-paragraph explanation of what went wrong. Examples: "Why are you individually updating style in each file? Isn't having global style a better pattern?" (#71); "Have you tested these?" (#153); "Is the mock in sync completely with the spec now?" (#170 Round 2). The question itself is the coaching — it forces the agent to surface the assumption it made and re-evaluate. Implication: treat any single interrogative as a full stop-and-reconsider signal, not a request for justification. The correct response is a reversal, not a defense — and a real audit, not a reflexive "yes, all good."

---

#### [P-HIGH] Escalates quality expectations at the submission gate (especially for UI)

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

The user's quality bar is highest right before submit, particularly for UI-facing work. On issue #153, the "Have you tested these?" pushback came when the agent was ready to submit based on typecheck + build passing. Submit-phase shortcuts (skipping browser validation, skipping manual reproduction, skipping golden-path E2E) reliably trigger intervention. Default behavior: before claiming the submit phase is complete for any user-facing change, explicitly enumerate and run the validation steps — do not assume CI passing is sufficient.

---

#### [P-MED] One-line approval once the PR is well-scoped and evidenced

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: (pending)

When the PR body includes concrete evidence (linked failing run, diff summary, post-merge test plan, validation honesty about what can and cannot be tested pre-merge), the user approves with one line ("go ahead", "PR Looks Good. Merge with Main", "Agreed") and zero feedback rounds. Observed across issues #166 (PR #168), #170 spec (PR #187 final approval), and #177 (PR #188). Implication: invest in PR body quality; it directly shortens the review cycle. Decision-points-at-the-bottom-of-the-PR-body framing (see entry below) reinforces this.

---

#### [P-MED] Accepts validation honesty when paired with a post-merge plan

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

For changes that cannot be tested pre-merge (GitHub Actions `workflow_run`, concurrency semantics, prod-only integrations), the user accepts "this cannot be tested pre-merge" as a legitimate answer — provided the PR includes a concrete post-merge test checklist the reviewer can execute. Do not fabricate test coverage that cannot actually run; do not defer tests indefinitely. The honest answer plus a plan beats simulated coverage.

---

#### [P-MED] Decision points presented as numbered options resolve in one chat turn

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 2
**First synthesized**: (pending)

When the agent surfaces design or scope decisions as numbered/lettered options at the bottom of a PR body or in the chat (each with a recommended default and a one-line tradeoff), the user answers all of them in a single chat turn. On issue #170 spec, the Round 1 and Round 2 pre-execution question batches got "yes to all" / "1b/2a/3b" style replies. On issue #177, three "Decisions for you" at PR #188 body bottom got three answers in one chat turn. Implication: this is the user's preferred decision-resolution format — adopt it for any non-trivial decision points rather than threading them inline.

---

#### [P-MED] "Looks good. Proceed to next phase" = phase advance approval, not a merge instruction

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: (pending)

On issue #170 RFC Round 2 close-out, the user wrote "Looks good. Proceed to next phase" after the agent had pushed Round 2 fixes and posted GitHub thread replies. Correct interpretation: the user is approving the phase work and instructing the agent to advance to Phase 8 (retrospective) — they are **not** authorizing a merge of PR #196. Merges still require explicit user action on GitHub (per `feedback_push_pr_always_merge_with_review.md`). Cross-reference with prior issue #170 spec close: there the user said *"PR Looks Good. Merge with Main. Don't close the issue or worktree yet"* — the explicit "Merge with Main" is the merge authorization; "proceed to next phase" is not. Lesson: distinguish phase-advance approval from merge authorization. The user's vocabulary signals which one they mean — match the action to the words exactly.

---

#### [P-MED] Push + PR is the default flow; merges require explicit GitHub review

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: (pending)

Pushing a branch and opening a PR are the standard part of any submission flow — not actions that require per-run approval. Merges, however, wait for explicit user approval after they've reviewed on GitHub. The user stated this directly on 2026-04-24 after I over-gated three submission flows by stopping before push each time. Captured in feedback memory `feedback_push_pr_always_merge_with_review.md`. Issues / PRs are also not closed manually; the user closes via explicit ask ("merge and close" or similar) — captured in `feedback_user_does_not_manually_close.md`. Implication: when in doubt about an action's blast radius, push/PR are go; merge/close/force-push wait.
