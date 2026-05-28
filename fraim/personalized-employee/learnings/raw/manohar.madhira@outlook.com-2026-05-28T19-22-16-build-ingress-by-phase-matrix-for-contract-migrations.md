---
author: manohar.madhira@outlook.com
date: 2026-05-28
context: issue-524 / technical-design address-feedback
---

# Coaching Moment: build-ingress-by-phase-matrix-for-contract-migrations

## What happened

My RFC for #524 designed the dual-key resolution inside `resolveOrEnrollMember` (§E) and the grace window, but it never systematically enumerated **which inbound paths actually resolve members and how each behaves across the migration lifecycle**. The user asked the questions I should have pre-empted: "which paths could break? what happens when a brand registers a new member with the old ID after grace? which paths don't honor Brand Member Identification?" When I then audited every member-touching path against code, I found: (1) `/v1/events` keys on the internal `Member.id`, not the external id — so it's migration-stable and was wrongly listed as a cutover surface in §H and in several spec ACs; (2) `externalSignalIngestion.ts` and `webhooks.ts` are two email-keyed match paths I'd never accounted for; (3) `MemberEnrolledVia.CLERK_OAUTH` is defined but unwired; (4) I had no defined behavior for "new member with old id after grace." The dual-key design was sound, but the *coverage analysis* of the surface area was missing, and that gap also hid concrete factual errors.

## What was learned

For any change that flips a system-wide contract (identifier kind, schema, auth scheme), the design must include an explicit "ingress × lifecycle-phase" matrix — every path that touches the affected entity, what it keys on (verified against code), whether it honors the contract, and its behavior in each phase (before / during / grace / after) — because the breakage analysis is where both missing requirements and wrong assumptions surface.

## What the agent should have done

Before writing the dual-key/grace sections, grep for every writer/resolver of the affected entity (`member.create`, `brandId_externalId`, `resolveOrEnrollMember`, the route handlers) and build the matrix first. Classify each path as honors-contract / bypasses-contract / unaffected (keys on a stable internal id), verifying the key each uses by reading the handler — never assume a path uses the external identifier just because it deals with members (`/v1/events` takes the internal cuid). Then design dual-key/grace/rejection behavior per class, and derive the impact-preview surface list and post-cutover error behavior from the matrix rather than from memory. The matrix is a required RFC section for contract migrations, not an afterthought.
