---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R7 meta-RCA after audit miss)
---

# Coaching Moment: apply-controls-retrospectively-on-audit-requests

## What happened

After completing an RCA (`analyze-why-you-messed-up` job) on PR #314's R5+R6 misses, I defined four preventive controls (CTRL-1 issue-body open decision, CTRL-2 FRAIM template compliance pass, CTRL-3 primary-source verification, CTRL-4 orthogonal-axis pass). The user then explicitly asked: "Can you also check again the feature specification document and any new missing / incorrectly written sections? ... do a thorough audit and correct as needed." I ran the audit and added the missing Non-Functional Requirements section + Error States subsection + Schema/API Summary section + 6 Validation Plan rows. I declared the spec "converged after 7 review rounds". The user came back and said I missed things even after the RCA — and asked for another RCA. A retrospective sweep then surfaced 9 concrete remaining gaps: 2 Epic Acceptance Criteria not mapped (AC-5 rule-action picker, AC-6 contradicted by D40), 1 internal contradiction (§4 says "applies campaign multipliers" while OQ3 says this is unresolved), 1 unverified assertion (NFR-BC1 references `scripts/check-migration-idempotency.sh` without verification — same shape as the erasure-job miss the original RCA flagged), 4 orthogonal-axis misses (program-rate-change-after-activation, anonymous responses + responsePolicy, brands-with-neither-field migration behavior, pipeline-resilience axis), 4 mock-vs-spec parity gaps (live char counter, save-failed indicator, embedded-mode fallback, blank-disclosure audit badge), 1 ambiguous statement (NFR-S5 "if available"), and the premature-convergence claim. The controls I had just defined were applied only to the new content I was about to write, not to the existing 300+ lines of spec.

## What was learned

Preventive controls phrased as forward-looking actions ("before writing the sentence", "after drafting a section") must be paired with an explicit retrospective-sweep step when the user asks for an audit/review/check — otherwise the controls fire only on new content and existing flaws persist round after round.

## What the agent should have done

At the start of any audit / review / check request, before adding anything new: (1) **Retrospective CTRL-3 sweep** — grep the document for the trigger phrases ("existing X", "the X pattern", "we have Y", specific component names); verify each match against primary sources. (2) **Retrospective CTRL-4 sweep** — walk every existing requirement / NFR / section and ask "what's the perpendicular axis?" Document gaps. (3) **Internal-contradiction check** — grep for Open Questions references; verify no operational description contradicts an unresolved OQ. (4) **THEN** add any net-new sections the user flagged. The retrospective sweep is a 10-15 minute pass that catches the class of misses R7 left in. Forward-only application of controls produces a moving-target audit that the reviewer has to keep extending.
