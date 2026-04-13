# Issue #141 — Implementation Work List

## Issue
**Title**: Adding a new note should automatically compute sentiment
**State**: OPEN
**Type**: feature (enhancement to existing note-creation flow)

**Desire**: When the admin adds a note on the customer detail page, the note's sentiment tag (`very_negative`/`negative`/`neutral`/`positive`/`very_positive`) should be automatically inferred from the note text via the existing AI sentiment pipeline. The admin keeps the ability to override the auto value before saving if they disagree with it.

## Current state (code audit)

### Backend
- `apps/api/src/routes/members.ts:689` — `POST /v1/members/:id/notes` reads `sentiment` from `CreateMemberNoteSchema`, stores as-is, and enqueues a health-score recompute if `note.sentiment` is non-null (`members.ts:734`).
- `packages/shared/src/zod/member.schema.ts:196` — `MEMBER_NOTE_SENTIMENTS` enum + `CreateMemberNoteSchema.sentiment` is optional.
- `packages/database/prisma/schema.prisma:283` — `MemberNote.sentiment` is `String?` storing the 5-bucket enum.
- **Existing sentiment AI**: `packages/ai/src/analysis/sentiment.ts` — `analyzeResponse(text, opts)` returns `{ sentiment: number (-1..1), confidence, topics, summary }` via `client.analyzeFeedback()`. Already wired up and used by `processSentimentForResponse` for survey responses.

### Frontend
- `apps/web/src/app/(admin)/admin/members/[id]/page.tsx:647` — Note-create form has a "Rep sentiment" dropdown bound to `noteSentiment` state; empty string is the default.
- `page.tsx:290-319` — Note edit flow also has a sentiment dropdown.
- `NOTE_SENTIMENTS` constant in the page defines the 5 buckets + labels/colors.

## Implementation checklist

### Backend
- [ ] `packages/ai/src/analysis/sentiment.ts` — add new helper `analyzeNoteText(body: string): Promise<{ sentiment: number, confidence: number }>` that wraps `client.analyzeFeedback()` with `surveyType: 'note'` and no cluster assignment. Keep the return narrow — we only need sentiment + confidence for this path.
- [ ] `packages/shared/src/utils/sentimentBucket.ts` **(new)** — tiny pure function `floatToSentimentBucket(value: number): MemberNoteSentiment` mapping `-1..1` float → 5-bucket string. Keep thresholds documented inline.
- [ ] `packages/shared/src/utils/sentimentBucket.test.ts` **(new)** — unit tests covering bucket boundaries (−1, −0.6, −0.2, 0, 0.2, 0.6, 1) + null/NaN handling.
- [ ] `apps/api/src/routes/members.ts:689` (POST notes) — if `input.sentiment` is absent, call `analyzeNoteText(input.body)`, map the float to a bucket via `floatToSentimentBucket`, and store it on the note. Wrap in try/catch so an AI failure degrades to `null` sentiment (no blocking). Return `sentiment` + `sentimentAuto: true` in the response so the UI can display a "computed" badge.
- [ ] `apps/api/src/routes/members.ts` — log sentiment-auto attempts (success + failure) at info level.
- [ ] `apps/api/src/routes/members.test.ts` — add unit tests (or update existing) for the POST path: (a) auto-computes when `sentiment` omitted, (b) respects explicit `sentiment` override, (c) graceful fallback when the AI call throws, (d) health-score recompute still fires when auto-computed sentiment is non-null.

### Frontend
- [ ] `apps/web/src/app/(admin)/admin/members/[id]/page.tsx` — update the note-create form:
  - Default `noteSentiment` to empty (so backend auto-computes)
  - Replace the "Rep sentiment" dropdown UX with: a small toggle/label that says "Auto-compute from note" when no value is selected, or shows the selected value when manually chosen
  - After a successful create, if the response carries `sentimentAuto: true`, show a brief toast/chip: "AI computed: Negative — click to override"
  - Clicking the auto-computed chip opens the existing edit flow on that note so the rep can change sentiment
- [ ] Keep the manual-override path 100% working. Tests must confirm both auto and manual paths.

### Tests
- [ ] `packages/shared/src/utils/sentimentBucket.test.ts` — unit
- [ ] `apps/api/src/routes/members.test.ts` — POST note + auto-sentiment (mock the AI client)
- [ ] Optional: add a zod schema test if the response shape changes

### Manual validation
- [ ] Start local stack (API :4000, web :3000, Postgres).
- [ ] Navigate to `/admin/members/:id` for any existing member.
- [ ] Add a note with clearly positive text ("Customer said they love the product!") — verify sentiment auto-computes as `positive` or `very_positive` without touching the dropdown.
- [ ] Add a note with clearly negative text ("Customer is furious, threatening to cancel") — verify it computes as `negative`/`very_negative`.
- [ ] Add a note with neutral text ("Called to confirm shipping address") — verify it computes as `neutral`.
- [ ] Add a note while explicitly selecting a sentiment → verify the selection wins over auto-compute.
- [ ] Verify health-score recompute still runs when the sentiment is auto-filled.
- [ ] Save screenshot to `docs/evidence/141-ui-polish-validation.md`.

## Validation Requirements

- `uiValidationRequired`: **true** — note-create UI is touched; browser validation via Playwright
- `mobileValidationRequired`: **false** — the customer detail page is desktop-only admin UX
- Browser baseline: Chromium via Playwright MCP
- Target journeys: (1) auto-compute positive, (2) auto-compute negative, (3) auto-compute neutral, (4) manual override wins
- Breakpoints: 1280×800 desktop only
- Evidence file: `docs/evidence/141-ui-polish-validation.md`

## Known risks / deferrals

- **AI client cost**: every note creation now triggers a GPT-4o call. For high-volume CS teams this is a non-trivial cost. Out of scope for this issue; add a feature flag if we ship to big brands later.
- **Latency**: AI call adds ~400-1200ms to note creation. Fire-and-forget isn't an option because we need the sentiment BEFORE returning the note to the UI. Acceptable for CRM notes (low frequency); document the trade-off.
- **Offline/AI-unavailable fallback**: if the AI client is unreachable, the note is still saved with `sentiment: null`. Health score won't recompute (same behavior as today when no sentiment tag is set). No user-visible error — just a log line.
- **Overriding after save**: currently an edit is needed. Out of scope to build an inline "override this auto-tag" action on the note card — the existing edit flow works.

## Out of scope

- Re-computing sentiment on existing notes (historical backfill)
- Per-brand AI model selection
- Confidence-threshold-based auto-override (e.g., "only use auto if confidence > 0.7")
