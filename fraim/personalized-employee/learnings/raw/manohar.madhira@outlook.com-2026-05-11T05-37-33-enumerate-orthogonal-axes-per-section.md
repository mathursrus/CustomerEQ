---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R6 inline comments)
---

# Coaching Moment: enumerate-orthogonal-axes-per-section

## What happened

On PR #314, the user caught four R6 misses with the same shape — each section had ONE axis covered, but the orthogonal axis was missing entirely. (1) Consent collection §2.1.1 designed the Explicit/Implied axis of consent *mode*, but missed the text-set / text-blank axis of consent *content*. The user explained: blank disclosure is a valid setting for out-of-scope regions (e.g., Washington state); audit log is the traceability. (2) Look & Feel §2.3 designed the channel × element chrome matrix, but missed the member-identification field entirely. The user pointed out Standalone needs an input field (per brand's `memberIdentifierKind`); Embedded reads from URL `?member_id=` in V0 with fallback prompt. (3) State-vocabulary §5 designed the operation verbs (Activate / Stop / etc.), but missed the audit-logging requirement. The user said all state changes must be logged for audit and reporting. (4) Points & Thank You variables listed `{{points}}` / `{{programName}}` / `{{memberName}}` / `{{rewardLink}}` / `{{pointCurrencyName}}` — covered the "available data" axis but missed the "respondent-facing-ness" axis (programName is internal; memberName isn't reliable).

## What was learned

For each spec section, after covering the obvious axis-of-variation, deliberately ask "what is the orthogonal axis?" — there is usually one (often two), and missing it produces an entire class of edge cases that surface during review. The pattern is structural: spec authoring tends to over-focus on the picked axis and under-cover the perpendicular one.

## What the agent should have done

Add a per-section "orthogonal axis" pass to spec drafting. After each section is drafted, write down the axis it covers, then ask: "What is the perpendicular axis?" Examples that would have caught the R6 misses: Consent *mode* (Explicit/Implied) → consent *content* (set/blank). State *verbs* (Activate/Stop/…) → state *audit trail* (logged/unlogged). Variable *availability* (data exists) → variable *appropriateness* (respondent-facing). Channel × element chrome matrix → form input requirements (member-ID capture). Treat the orthogonal-axis check as a 1-minute pass per section before submitting; cumulative cost is ~5 minutes; cost of missing an axis is one full review round.
