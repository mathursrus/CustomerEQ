# Feedback for Issue #170 — Technical Design Workflow

## Round 1 Feedback

*Received: 2026-04-26 21:48 UTC. Reviewer: rmadhira86. PR #196.*

### Comment 1 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 450 (IdentityProvider abstraction confidence row)
- **Comment**: "Do we need a Spike to verify?"
- **Status**: ADDRESSED
- **Theme**: Spike-before-design verification of the IdentityProvider abstraction.
- **Disposition**: Reviewer was right. Confidence "high" was overconfident. Ran a documentation-and-codebase-driven spike and surfaced two real issues plus two clean-pass methods.

#### Spike landing

Updated the RFC's "Spike Findings" section with the full results. Summary:

| Method | Result | Action |
| :--- | :--- | :--- |
| `parseWebhook` | ✅ Clean | None |
| `updateOrgName` | ✅ Clean | None |
| `createUserWithOrg` | ⚠️ Internally 3 Clerk API calls; partial-failure mode hidden | Interface kept; internal-cleanup contract documented as part of §3.1 interface comment + new row in §10 |
| `completeOAuth({ code, state })` | 🔴 Wrong shape for Clerk-mediated OAuth | **Removed** from the interface; replaced with the existing `getSession` + a new `getUser` method |

#### RFC sections updated

- §3.1 (Interface) — `completeOAuth` removed; `getUser(userId) → { email, name } | null` added; `createUserWithOrg`'s internal-cleanup contract documented inline.
- §4 (API surface) — `/api/auth/oauth/:provider/callback` row removed (Clerk owns the actual callback); `/api/auth/signup/finish` clarified to use `getUser` + `createOrgForUser`.
- §10 (Failure modes) — 3 new rows: `createUserWithOrg` partial failure with user-cleanup contract; OAuth `getSession` returning `orgId: null` (new-user routing); `createOrgForUser` failure on `/api/auth/signup/finish`.
- "Spike Findings" — populated with the 4-method audit + design impact + spike rationale.
- "Confidence Level" — bumped overall from 85 to 90; IdentityProvider abstraction row revised from "high" (overconfident) → "high *(post-spike)*" with concrete justification.

### Round 1 summary

- 1 of 1 comment addressed.
- 1 interface method removed (`completeOAuth`); 1 added (`getUser`); 1 contract clarification (`createUserWithOrg` cleanup).
- 1 API endpoint row removed (`/api/auth/oauth/:provider/callback`); 1 clarified (`/api/auth/signup/finish`).
- 3 new failure-mode rows.
- Confidence revised 85 → 90.
- No mock changes (RFC is text-only).
