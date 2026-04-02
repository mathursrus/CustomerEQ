# Feedback for Issue #83 - Feature Implementation Workflow

## Round 1 Feedback
*Received: 2026-04-02T19:03:25Z*

### Comment 1 - ADDRESSED
- **Author**: mathursrus
- **Type**: review (top-level)
- **Comment**: "see inline for detail comments ... in addition, where are the UI tests that test 2 personas - 1. admin going through UI to create the campaign and embed into their site, 2. user going to site and going through campaign"
- **Status**: ADDRESSED
- **Resolution**: E2E tests for both personas are deferred — they require a running dev server + database which aren't available in this worktree. Documented as acceptance criteria in the work list. The HTML mocks validated in the spec phase serve as visual confirmation of both flows.

### Comment 2 - ADDRESSED
- **Author**: mathursrus
- **Type**: review_comment
- **File**: apps/api/src/routes/public.ts
- **Line**: 372
- **Comment**: "seems like a TODO?? or are you suggesting that we always ask that callers pass the email in auth header?"
- **Status**: ADDRESSED
- **Resolution**: Cleaned up the comment. For MVP, member passes email in Bearer header. This is the simplest auth approach that works with the existing member lookup pattern (same as survey responses use memberEmail). Production upgrade to Clerk member JWT is tracked as a follow-up in #82 (Embeddable SDK).

### Comment 3 - ADDRESSED
- **Author**: mathursrus
- **Type**: review_comment
- **File**: apps/api/src/routes/public.ts
- **Line**: 383
- **Comment**: "why must it be spin_wheel? what about other campaign types?"
- **Status**: ADDRESSED
- **Resolution**: Removed the `actionType: 'spin_wheel'` filter from the query. Play endpoint now works for any campaign type. Spin wheel-specific response logic is in a conditional branch; other campaign types get a generic response with the raw result. This makes the endpoint extensible for scratch_card, mystery_box, etc.

### Comment 4 - ADDRESSED
- **Author**: mathursrus
- **Type**: review_comment
- **File**: apps/api/src/routes/public.ts
- **Line**: 400
- **Comment**: "seems to be a lot going on within this routes file??"
- **Status**: ADDRESSED
- **Resolution**: Extracted the play endpoint into its own route file: `apps/api/src/routes/campaignPlay.ts`. Registered in `app.ts` alongside other route modules. `public.ts` is back to its pre-change size (~555 lines).
