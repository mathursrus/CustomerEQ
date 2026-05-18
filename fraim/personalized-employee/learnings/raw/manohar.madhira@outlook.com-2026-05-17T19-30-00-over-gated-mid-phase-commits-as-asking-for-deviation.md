---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378 / FRAIM feature-implementation Phase 4 implement-code
---

# Coaching Moment: over-gated-mid-phase-commits-as-asking-for-deviation

## What happened

During Phase 4 (`implement-code`) of the FRAIM `feature-implementation` job for issue #378, after landing S1 (schema + migration) and S2 (shared utils) as two commits on the same branch — both green, both validated — I paused execution and surfaced a four-option ask to the user about whether to continue with S3 (A: commit S1 + continue S2 / B: commit + stop / C: don't commit yet / D: other). The user authorized A. I executed S2 cleanly, then **paused AGAIN** at the S2 commit boundary with a "you've got a clean stopping point, let me know when you're ready to continue with S3" framing. The user replied with a single corrective question: "Why are you pausing for me? Does FRAIM ask you to? Ask your mentor." The mentor's response (phase 4 instructions verbatim) lists exactly seven steps — Parallelize / Implement / Investigate errors / **Iterate until 100% pass rate** — and zero of them are "pause for user check-in between slices." Phase 12 (`address-feedback`) is the only sanctioned hold-point. The same misfire shape is already encoded as L0 `2026-05-15T22-01-19-over-gated-push-pr-as-asking-for-deviation.md` (push + PR over-gated at spec-submission) and L1 mistake-pattern P-HIGH 8.0 dated 2026-05-05 (*"Asked user to confirm deviation from unambiguous project rules + manufactured 'observed pattern' defensive framing"*).

## What was learned

The misfire is "inventing pause-points the workflow doesn't sanction." It is **not** specific to push + PR — it is specific to any user-authorization gate that re-litigates a settled FRAIM phase contract. Phase 4 says iterate to 100% pass; that contract owns the cadence inside the phase. Adding a "stopping point" at every commit-slice boundary inside Phase 4 is the same shape as adding a "do I push?" gate at Phase 5, just at finer granularity. The defensive framing this time was "give the user a clean stopping point with green tests" — which sounds reasonable but is itself the manufactured pattern P-HIGH 8.0 warns about. Phase boundaries (4 → 5, 5 → 6, etc.) are the natural cadence; commit boundaries inside a phase are not.

## What the agent should have done

After S1 lands green, immediately continue to S2. After S2 lands green, immediately continue to S3. Iterate until phase 4's exit criterion is met (all slices land + 100% test pass), then call `seekMentoring(currentPhase='implement-code', status='complete')`. The user's question or labeled directive "stop", "pause", "review", or an explicit deviation request is what authorizes a stop — silence + green tests is not. If the agent feels uncertain mid-phase, the L1 files + the FRAIM job stub + the work list answer the cadence question directly; reading them is the right move, not surfacing a user gate. The presence of L0 entry `over-gated-push-pr-as-asking-for-deviation.md` already meant this exact misfire was tagged as pending synthesis — the agent should have recognized the shape and applied the rule, not repeated the pattern at a finer grain.
