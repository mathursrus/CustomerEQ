---
author: manohar.madhira@outlook.com
date: 2026-05-28
context: issue-524 / technical-design address-feedback (audit pass)
---

# Coaching Moment: audit-rfc-codebase-claims-pre-submission

## What happened

After I submitted the RFC for #524 with §H impact-preview data-source queries written as concrete SQL (channel IN, WHERE-clauses on specific columns) and §K Risks claiming "existing GDPR erasure job zeroes email + externalId", the user demanded "audit every claim made in the RFC with actual code base." I ran the audit and found three real bugs and one missed edge case:

1. §H "Embedded survey forms" cited a `channel = 'embed'` value that does not exist — the zod enum at `apps/api/src/routes/public.ts:53` is `['email', 'in_app', 'link', 'sms']`; the widget hardcodes `'in_app'` at `public.ts:992`.
2. §H "Outbound webhooks" filtered on `deletedAt IS NULL`, but `WebhookEndpoint` (`schema.prisma:1206-1223`) has no `deletedAt` column — disable is `active` only.
3. §K Risks + Test Matrix claimed an "existing GDPR erasure job zeroes PII," but the actual codebase pattern is `Member.erased = true` + mask-on-read in `apps/api/src/routes/members.ts:538-540, 944-954` — no dedicated zeroing worker exists. Project Rule 13's "zeroed out" prose is aspirational vs the implementation.
4. Missed edge case: the worker would have re-PII'd erased members because pre-flight `WHERE deletedAt IS NULL` only excluded soft-deleted ones, not `erased = true` rows.

The 23 *other* concrete codebase claims in the RFC verified clean. So the problem isn't that I can't read code — it's that I let some claims into the document **without grepping for them** while I had verified others rigorously. The user has multiple prior coaching moments and a dedicated retrospective on exactly this pattern: `2026-05-04-rfc-claimed-files-not-verified-against-codebase.md`, `2026-05-23-trusted-spec-prose-without-grepping-route.md`, `docs/retrospectives/issue-301-rfc-existing-claims-unverified-postmortem.md`. The pattern fired again here despite those signals existing.

## What was learned

Every concrete codebase claim in an RFC — specific column names, enum values, file paths, regex bodies, worker behaviors, soft-delete fields — has to be verified by reading the actual source *before* writing the claim, even when the claim feels "obvious" or is sourced from a project rule (rules can be aspirational; the code is the truth).

## What the agent should have done

While writing the RFC, run an inline audit pass on each section that touches code: after drafting §H's data-source table, immediately grep for each column/enum value cited (`channel`, `audienceSpec.mode`, `WebhookEndpoint.deletedAt`); after drafting §K Risks' erasure language, grep for the actual erasure implementation in `apps/worker` (and on miss, grep more broadly in `apps/api/src/routes/members.ts`) before adopting Rule 13's prose. Treat the rule-prose-vs-code gap as a discoverable artifact, not a fact. Capture the audit results inline so reviewers can re-trace them.
