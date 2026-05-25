---
author: manohar.madhira@outlook.com
date: 2026-05-22
context: issue-420 / feature-specification phase 6 address-feedback round 6
---

# Coaching Moment: hallucinated-claims-without-codebase-verification

## What happened

In the #420 spec rounds 1–5, I asserted multiple capability claims about the existing CustomerEQ codebase without first verifying them by reading the relevant source files. The reviewer caught two specific instances during the round-5 review of PR #497:

1. **Line 46** (`docs/feature-specs/420-send-via-customereq-acs.md`) — Customer-Problem item #3 claimed "filter-by-attribute audience targeting (Gold tier, low health score, etc.) is a V1.x extension on top of the V0 primitives." Reviewer correction: *"This is wrong. We don't have the filtering by attribute. Don't hallucinate. Verify each claim with actual code base."* I had reused #378's spec language without checking whether attribute filters actually existed in #378's implementation (they did not — #378 explicitly excluded them per its `V1.x` block but I described them as if they were present today).

2. **Line 687** (OQ-7 about `Brand.logoUrl`) — I marked `Brand.logoUrl` as a dependency *"assumed to exist today"* and asked the reviewer to confirm. Reviewer correction: *"I know it exists. Shouldn't spec verify this first instead of assuming?"* I had the codebase open in this conversation; `grep`/`Read` on `schema.prisma` would have answered the question in seconds.

Both follow the same shape: I made an unverified assumption about codebase state, framed it in spec text as either ambient fact (#1) or an Open Question (#2), and shipped it to the reviewer to validate. The reviewer's reaction is the same in both cases: *"Why are you asking me when you could check?"* / *"Don't hallucinate."*

## What was learned

A spec must verify every factual claim about the codebase against actual source before the claim ships to the reviewer — and Open Questions that are *"does this exist?"* questions are codebase lookups, not reviewer questions.

## What the agent should have done

- Before writing any spec sentence of the shape *"X exists today"* or *"X is in V1.x"* or *"X is supported by the platform"*, run a grep or read against the file the claim implies (e.g., `packages/database/prisma/schema.prisma` for column existence, `apps/api/src/routes/` for endpoint claims, `packages/connectors/src/` for connector behavior, `apps/web/src/app/(admin)/admin/` for UI surface claims).
- Treat "does X exist in the codebase?" as a Priority-1 codebase lookup (use [[Asked-instead-of-looked]] mistake-pattern's forcing function), **not** as a reviewer Open Question. OQs should be reserved for **design** decisions (per-survey vs brand-wide unsubscribe, glob vs LIKE, default editor library, etc.) — not for **existence** questions about the code.
- When inheriting language from a prior spec (#378 → #420), verify each inherited claim against current codebase state. The inherited claim may have been accurate at the time of the source spec but stale now (or never accurate to begin with). [[draft-rfc-from-agent-summary-not-source]] in mistake-patterns is the sister-shape forcing function here.
- The verification step costs ~10 seconds per claim. The cost of an unverified claim landing in a spec is a review round, an erosion of trust in the spec's other claims, and a "don't hallucinate" coaching moment.
