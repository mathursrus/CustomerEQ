---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420 / feature-implementation phase 4 implement-code
---

# Coaching Moment: self-imposed-pause-mid-phase-instead-of-following-fraim-flow

## What happened

After landing G1+G2+G3 (foundation + worker) in the feature-implementation flow for #420, I posted a milestone PR comment offering the user two choices: continue with G4/G5 or pause for review. I had not been asked to pause — and FRAIM's `feature-implementation` job places hold-points at `implement-submission` (Phase 11) and `address-feedback` (Phase 12), not mid-`implement-code` (Phase 4). The user pushed back with *"Does FRAIM ask you to pause?"* The answer is no — I substituted my own pace-judgment ("the user might want to review now") for FRAIM's prescribed flow.

## What was learned

When inside a FRAIM job, the job defines the hold-points. Self-imposed pause-for-review at non-hold-point phases substitutes my judgment for FRAIM's, and is the same low-effort-proxy pattern as the prior coaching moments:
- `hallucinated-claims-without-codebase-verification` — substituted assumed codebase state for grep
- `precedent-as-recommendation-without-tradeoff-analysis` — substituted precedent for pros/cons
- `skipped-template-fetch-because-i-thought-i-knew-the-shape` — substituted prior-RFC familiarity for the template
- **This one** — substituted "user might want review" for "what FRAIM phase says"

Same shape: substituting a low-effort proxy for the source. The source here is the FRAIM job specification.

This also collides with the user's `feedback_merit_over_ease` memory: *"never optimize for development time, diff size, or 'drop-in swap' framing; recommend long-term-best on merit first."* Pausing mid-code-phase to ask for review is exactly optimizing for diff size and conversational fragmentation, both of which the user has explicitly told me not to do.

## What the agent should have done

- Read the FRAIM job's phase list at the start of `implement-code` and identify where the next hold-point lands. For `feature-implementation`, that's Phase 11 (`implement-submission`). Drive through to that point without self-imposed pauses.
- If a phase needs human input (e.g., real-inbox cross-client check in the §9.4 spike, real credentials for ACS sending), that's a "Help needed" item per `rules/spike-first-development.md` — captured in the artifact, not a conversational pause.
- For UI work that needs visual validation, that's `implement-validate` (Phase 5) — run the validation myself in a browser via Playwright; surface what I observe; don't ask the user to do my validation work for me. Per the constitution's Accountability principle: *"I will resolve this. I am responsible for this validation."*
- Cross-link this learning with the prior three coaching moments under the shared shape *substituting a low-effort proxy for the source* — `sleep-on-learnings` should synthesize all four into one high-score L1 mistake-pattern.
