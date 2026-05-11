---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R6 inline comments)
---

# Coaching Moment: verify-platform-state-claims-against-primary-source

## What happened

On PR #314, the Compliance Requirements section claimed CCPA right-to-deletion was "covered by the existing `apps/worker` erasure job pattern." The user pointed out at R6: "This job does not exist yet. Will need to implement, but is in the roadmap. Identify the issue and update." A `gh issue search` revealed #264 (P1, OPEN) — "Build GDPR erasure job + Art. 15 data-export endpoint per architecture.md §10 commitment." The text I had written imported language from `docs/architecture/architecture.md` as if the job already existed, when in fact the architecture doc was *aspirational* — describing a planned pattern, not delivered infrastructure. Same shape applied to the Points & Thank You variable picker, which listed `{{memberName}}` as available even though the Member Prisma schema doesn't guarantee a name field. This is a recurrence of an existing L1 mistake-pattern at score 8.0 ("Asserted facts about file / config / external-state contents without reading the primary source first") — the pattern is in memory, it still fired on this spec.

## What was learned

Any sentence in a spec containing "existing X", "the X pattern", "we have Y", or naming a specific file/job/component must be paired with a primary-source verification action (grep / Read / schema check) **before the sentence is written** — not after submit. Architecture-doc language is aspirational by default; a claim there is a hypothesis until verified against code.

## What the agent should have done

For "the existing `apps/worker` erasure job pattern": before writing, run a grep for `erasure` in `apps/worker/src/` (would have returned no match); then `gh issue search` for "erasure" (would have surfaced #264 as the tracking issue). For `{{memberName}}` in the variables list: read `packages/database/prisma/schema.prisma` Member model (would have shown no guaranteed `name` field; only `memberId` is reliable). For "the disclosure text is always shown to the respondent": check whether blank disclosure is a valid setting in the design intent (it is — for out-of-scope regions). Verification cost per claim is small (~30 seconds); cost of propagating an unverified assertion is one review round.
