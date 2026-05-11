---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R4 and R7 both prematurely claimed convergence)
---

# Coaching Moment: no-unilateral-convergence-claim

## What happened

Twice on PR #314 I claimed the spec was "converged" in the status line. R4 commit (`af0ba80`) set status to "Ready for review (R4 converged)" — followed by R5 D40 architectural reversal and R6 batch of 8 inline review comments. R7 commit (`e058b93`) set the Decision Log footer to "Spec converged after 7 review rounds" — followed by the user's R8 ask "do a thorough audit and correct as needed" which surfaced 9 more concrete gaps. Each "converged" claim was contradicted within one review round. The claim is mine to make in the document, but the act of convergence — review complete, spec ready for downstream RFC — belongs to the reviewer.

## What was learned

Convergence is a reviewer signal, not an author claim. Putting "converged" in spec status text while the spec is under review creates false confidence for the reviewer (who has to disprove the claim) and miscalibrates downstream work (RFC author may start prematurely).

## What the agent should have done

Set the spec frontmatter Status field to a state-of-iteration phrase rather than a convergence claim: "Iterating (round N)" while actively iterating; "Ready for review (round N — controls applied)" when handing off for review; never "Converged" until the reviewer approves the PR. For the Decision Log footer, "Iteration history (R0–RN); awaiting reviewer signoff" rather than "Spec converged after N rounds". When the user merges the PR or explicitly says "looks good, this is converged", THEN update the status to "Converged (approved <date>)". This single vocabulary discipline costs nothing and removes a recurring false-positive signal.
