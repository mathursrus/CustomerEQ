# Feedback for Issue #524 — technical-design Workflow

## Round 1 Feedback
*Received: 2026-05-28 (conversational, on RFC review)*

### Comment 1 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: design review (conversational)
- **File**: `docs/rfcs/524-switch-member-identifier-kind.md`
- **Comment**: "I don't see coverage of which paths could break. e.g. What happens when Brands register new members with the old ID after migration, after grace period. Which paths don't honor the Brand Member Identification and what should be done about them?"
- **How addressed**: Added a new **§M — Ingress coverage, member scope & breakage analysis** to the RFC, built from a verified (file:line) audit of every member-touching production path:
  - **§M.2 ingress matrix** — each path, what it identifies the member by, whether it honors `memberIdentifierKind`, whether it creates members.
  - **§M.3 lifecycle matrix** — behavior of each path class across pre-migration / `PROCESSING` / grace / post-grace.
  - **§M.4** — the reviewer's exact question (new member with old id after grace): two sub-cases, both proven safe (no duplicate, no silent corruption); defined the `IDENTIFIER_DEPRECATED_AFTER_MIGRATION` (matched-mapping) vs `IDENTIFIER_SHAPE_INVALID` (unknown id) error split and the mapping-retention that enables the actionable error.
  - **§M.5** — disposition for the non-honoring paths.
  - This audit surfaced **2 more inaccurate claims** corrected in the RFC + spec (see Comment 2).
- **Status**: ADDRESSED in commit `15a2159`.

### Comment 2 — ADDRESSED (inaccurate claims surfaced by the §M audit)
- **Author**: (self-surfaced during the §M.1/§M.2 audit prompted by Comment 1)
- **Type**: factual correction
- **Findings & fixes**:
  - **`/v1/events` is migration-stable, not a cutover surface.** It resolves by internal `Member.id` cuid (`events.ts:96-97`), not the brand external id. Removed from §H impact-preview; corrected spec R30/R33 and the R31/R32/R35/R37 ACs (which wrongly used `/v1/events` + `memberId: cust_00012`); corrected §D and Architecture-Analysis SLA notes (the hero `/v1/events` path does NOT get the dual-key extra query); trimmed the `MigrationOldKeyIngress` enum (B.3) to the 3 paths that actually carry the external id.
  - **`CLERK_OAUTH` member-enroll ingress does not exist.** `MemberEnrolledVia.CLERK_OAUTH` is defined (`member.schema.ts:75`) but no production writer exists. Removed from the ingress enum + lifecycle analysis.
- **Status**: ADDRESSED in commit `15a2159`.

### Comment 3 — ADDRESSED (domain clarification from the user)
- **Author**: manohar.madhira@outlook.com
- **Type**: scope clarification
- **Comment**: "Two types of members: Loyalty members (survey auto-enroll, API) — don't necessarily have a Clerk ID. The others are Clerk-enrolled Members (admin/RBAC portal access). Primary target are the Loyalty members."
- **How addressed**: Verified against code that admin/portal users are Clerk-org → `Brand` rows (`identityProviderWebhook.ts:13,18`; `user.created` is a no-op), **not `Member` rows**, so the re-key inherently excludes them. `Member.clerkUserId` is a self-enroll attribute (set only via the optional token on `/v1/members/enroll`, `members.ts:82-90`; no self-enroll UI yet). Added **§M.1** to the RFC and **R36** to the spec scoping the migration to loyalty members and requiring `clerkUserId` preservation (added to the R26 preserve set). Captured the loyalty-vs-admin model as a durable reference memory.
- **Status**: ADDRESSED in commit `15a2159`.

**Note:** Comments 1–3 are normal design-review iteration plus self-surfaced corrections; one coaching moment captured (`build-ingress-by-phase-matrix-for-contract-migrations`) covering the systematic-completeness lesson.
