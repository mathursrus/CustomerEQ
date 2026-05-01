# Feedback for Issue #170 — PR 2 Retrospective Workflow

## Round 1 Feedback
*Received: 2026-05-01T00:14:41Z*

### Comment 1 - ADDRESSED

- **Author**: rmadhira86
- **Type**: review_comment (inline)
- **File**: `docs/retrospectives/manohar.madhira@outlook.com-issue-170-onboarding-shared-spine-pr2-implementation-postmortem.md`
- **Line**: 84
- **Comment**: *"This is a key learning moment. When presenting options, we should consider both 'with sunk cost' and without sunk cost."*
- **Status**: ADDRESSED

#### What the comment was responding to

Line 84 of the retrospective described how during the JTBD spec re-segmentation discussion, I first recommended a light reframe (Option A — preserve existing enum, sub-issues, and three-bucket structure) before pivoting to the JTBD answer when the user explicitly asked "if we don't worry about sunk cost, what would you suggest?". The retrospective entry framed this as "almost did wrong but caught" — implying I caught the mistake.

#### Why the feedback is correct

I did not catch the mistake. The user did, by asking a follow-up that explicitly stripped sunk cost out of the framing. My initial recommendation silently weighted "minimize churn" over "give the right answer" without naming that tradeoff to the user — and that's a different (worse) failure mode than the retrospective's wording implied.

The right approach is to present **both** "with sunk cost" and "without sunk cost" recommendations side-by-side in the original response, name the deciding tradeoff explicitly, and let the user pick the frame *and* the answer in one shot — not two prompts.

#### Actions taken

1. **Coaching moment captured**: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-01T00-16-49-options-with-and-without-sunk-cost.md` — full incident description, learning extraction, and the corrected approach with concrete example wording.
2. **Memory entry added**: `feedback_present_both_sunk_cost_frames_upfront.md` (in agent memory store), indexed in `MEMORY.md`. Rule + Why + How-to-apply structure per the feedback memory style guide.
3. **Retrospective updated**: the line-84 entry has been moved out of "Almost Did Wrong But Caught" (which it didn't belong in) and into a new **"What I Did Wrong That The User Caught"** subsection. The entry now describes the failure honestly, names the cost (a half-measure recommendation that would have shipped if the user hadn't pushed back), and links to the captured memory entry. The retrospective's "Lessons Learned" section gains a new item #8 covering the same pattern.
4. **Verification commit** pushed to `docs/170-pr2-retrospective` so the reviewer can confirm the corrected framing.

#### Why this is a real pattern, not a one-off

This failure mode shows up whenever a strategic question is asked of an agent that has been working in the same problem space for a while — the agent has implicit knowledge of the work-in-flight (sunk cost) and silently weights it into recommendations. The user, asking a fresh question, doesn't have that weight and gets blindsided when their follow-up reveals a substantively different "right" answer. Surfacing both frames upfront eliminates the failure mode by making the implicit weight explicit and reviewable.

Verified the same risk applies to: PR-vs-feature decisions ("should we ship this with the existing approach or rebuild it?"), refactor scoping ("touch this surface or leave it alone?"), API contract changes ("evolve the existing shape or break it?"), and any "should we keep going or start over" question. Memory entry covers these by name so the rule fires across categories.
