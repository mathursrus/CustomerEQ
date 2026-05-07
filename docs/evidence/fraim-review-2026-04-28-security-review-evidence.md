---
reviewRef: fraim-review-2026-04-28
job: security-review
subject: CustomerEQ repository
runDate: 2026-04-28
branchRef: review/fraim-review-2026-04-28
status: submitted-for-review
---

# FRAIM Security Review Evidence

## Submitted Artifacts

- Security report: `docs/security-reviews/security-review-repo-2026-04-28.md`

## Submission Evidence

- Review branch: `review/fraim-review-2026-04-28`
- GitHub issues filed from review findings:
  - `#203` signed member identity for public survey responses
  - `#204` authenticated and rate-limited public survey trigger
  - `#205` signed auth for campaign play
  - `#206` signed auth for support-public routes
  - `#207` SSRF guardrails for outbound webhooks
  - `#208` trusted-origin CORS for MCP endpoint
  - `#209` remove member email from survey URLs

## Gate Outcome

- Gate decision: `fail`
- Composite score: `3.0`
- High findings: `5`
- Medium findings: `2`

## Reviewer Notes

- This was a review-and-handoff pass only; no production fixes were applied in this branch.
- Findings were dispositioned to `file` and converted into tracked GitHub issues for implementation follow-up.
