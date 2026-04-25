# Manager Coaching — manohar.madhira@outlook.com

Patterns observed in how this user coaches, intervenes, and adjusts agent behavior during sessions. Signals for predicting where and how the user will push back, approve, or escalate.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] Single-question pushback, not a lecture, when approach needs correction

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 2
**First synthesized**: (pending)

When the agent is on the wrong path, the user's intervention is consistently a single clean question — not a multi-paragraph explanation of what went wrong. Examples: "Why are you individually updating style in each file? Isn't having global style a better pattern?" (#71); "Have you tested these?" (#153). The question itself is the coaching — it forces the agent to surface the assumption it made and re-evaluate. Implication: treat any single interrogative as a full stop-and-reconsider signal, not a request for justification. The correct response is a reversal, not a defense.

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
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

When the PR body includes concrete evidence (linked failing run, diff summary, post-merge test plan, validation honesty about what can and cannot be tested pre-merge), the user approves with one line ("go ahead") and zero feedback rounds. On issue #166, PR #168 had a tight +29/-7 single-file diff, a comprehensive body with evidence, and an explicit pre/post-merge test breakdown — approved without comments. Implication: invest in PR body quality; it directly shortens the review cycle.

---

#### [P-MED] Accepts validation honesty when paired with a post-merge plan

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

For changes that cannot be tested pre-merge (GitHub Actions `workflow_run`, concurrency semantics, prod-only integrations), the user accepts "this cannot be tested pre-merge" as a legitimate answer — provided the PR includes a concrete post-merge test checklist the reviewer can execute. Do not fabricate test coverage that cannot actually run; do not defer tests indefinitely. The honest answer plus a plan beats simulated coverage.
