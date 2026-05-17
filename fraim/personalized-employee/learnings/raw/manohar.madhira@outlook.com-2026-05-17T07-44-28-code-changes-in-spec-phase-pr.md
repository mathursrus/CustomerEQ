---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378 / FRAIM feature-specification Phase 6 address-feedback
---

# Coaching Moment: code-changes-in-spec-phase-pr-and-misread-of-rule-26

## What happened

During Round 3 of address-feedback on PR #385 (FRAIM `feature-specification` job for issue #378), I bundled **production code changes** into the spec-phase commit `72d1c5a` — specifically: deleting `POST /v1/public/surveys/trigger` and `SurveyTriggerSchema` from `apps/api/src/routes/public.ts`, removing the test block from `public.test.ts`, modifying `examples/acme-coffee-demo/` SDK + server + README, and adding the `competitors` block to `fraim/config.json`. The user pushed back: *"Why did you make Code changes in this commit? Did you not follow FRAIM?"* My acknowledgment was correct in identifying the FRAIM phase-boundary issue, but my **proposed remediation was wrong**: I offered three options, all of which (especially Option A — "file a new impl issue + PR") were exactly the chore-issue-split fabrication that L1 mistake-pattern P-HIGH 30.0 (and Rule 26 itself) was authored to eliminate. The user corrected: *"There is something wrong — We are still using one PR per Issue, Not one PR per artifact. Multiple Commits, but one PR for Issue."* — pointing me back at the literal Rule 26 text: *"Each phase artifact ships in **one PR** containing the artifact + any architecture / evidence / test updates surfaced in that phase."* That wording is ambiguous (sounds like "one PR per artifact" but actually means "the one PR for the issue carries each artifact alongside its phase's evidence/test updates"). I read it through the narrow lens.

## What was learned

Rule 26's invariant is **one issue → one branch → one PR with multiple phase-aligned commits**, not "one PR per phase artifact" — the spec phase and impl phase produce separate commits on the same branch, both landing through the same PR. When in doubt about a rule's intent, re-read the full text + ask the user to clarify rather than acting on a single-frame interpretation, especially when the proposed action looks structurally like a known fabrication pattern (filing a new issue or PR to split an artifact).

## What the agent should have done

After the user's Round 3 directive *"demo update should be done in this PR — not punted down"* and the user's pushback on code changes, the correct response was:
1. **Acknowledge** the FRAIM phase boundary — production code edits ≠ spec-phase artifact.
2. **Revert** the code changes from the spec-phase commit (using `git restore --source=<prev-commit> <files>`).
3. **Leave the spec text describing the design unchanged** (V0 retires the trigger endpoint and adds the competitors config — that's the design, captured in the spec).
4. **Soften any "deleted/added in this PR" language to "lands in impl-phase commits on this same PR"** for accuracy.
5. **NOT propose a chore-issue split or a new PR** — that's the fabrication pattern Rule 26 exists to prevent. The impl phase of #378 will land the code on the same `feature/378-...` branch through the same PR #385, just in a separate commit. The work-completion job will then close the issue + delete the worktree at the end.
6. **Surface ambiguity in the rule wording** — Rule 26's text *"Each phase artifact ships in one PR"* invites the misread; flag the wording for correction in a separate (legitimate) issue scoped to project-rules updates.

The structural lesson: when a rule's wording could be read two ways, and one reading would justify a fabrication pattern that the same rule was authored to eliminate, the other reading is almost certainly correct.
