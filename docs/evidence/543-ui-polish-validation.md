# Issue #543 — UI Polish Validation

## Scope

F1 is a database-only Prisma migration. F2 is a render-condition refactor on the existing tokenized respondent page (`/survey/:id/r/:token`) — the Loading state already exists as a code path (the same component renders it 60 lines higher); the fix routes the transient render to that pre-existing loading card.

UI polish check: **N/A** — no new affordances, no copy changes, no spacing decisions, no new theme tokens. The visible behavior change is the *absence* of the red error-card flash. The Loading card is identical to its existing form (gray border, white background, "Loading…" caption, neutral footer).

## Status

0 P0/P1 findings. Manual cross-browser check is the post-deploy spot test (user-driven, same pattern as #531 / #540 / etc.). Browser baseline is whatever respondent clients use; not a polish concern.
