# UI Validation Evidence — Issue #121 (Case Detail Page)

**Date:** 2026-04-28  
**Validated by:** Claude (dev bypass mode, no Clerk)

## What was fixed

`addNote` in the case detail page was sending `{ text }` only; the API
`AddCaseNoteSchema` requires `{ text, author }`. Fixed to include the
Clerk user's email (falls back to `'admin'` when running without Clerk).

The rendering side was already defensive (`?? []` on all array fields,
null-safe helpers for dates and SLA).

## Journey tested

Admin → Cases → click case row → verify detail view loads

### Case without survey response (`dev-case-1`)
- Score/Survey/Sentiment/Feedback all render as `—` / "No feedback recorded" ✓
- SLA target shows formatted date, status shows "2h remaining" ✓
- Timeline entry visible ✓
- Mark Contacted / Mark Resolved / Close Case / Add Note buttons present ✓
- No crash ✓

### Case with survey response (`dev-case-2`)
- Score badge renders (3, red) ✓
- Survey name "Post-Purchase NPS" shown ✓
- Sentiment (-0.7) shown ✓
- Topic pills: "shipping", "pricing" ✓
- Feedback quote rendered ✓
- SLA status "1h overdue" in red ✓
- CRITICAL priority badge ✓
- No crash ✓
