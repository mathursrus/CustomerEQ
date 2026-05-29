# Issue #540 — UI Polish Validation

## Scope

Three production bug fixes:
- F1 — worker URL resolver (no UI surface; backend-only)
- F2 — email logo `<img>` HTML shape (rendered into email body; not a web UI surface)
- F3 — `Survey.sentCount` denormalized field (server-side; the web view that reads it shows the same `surveyLifetimeSentCount` prop — no new rendered surface)

UI polish check: **N/A** — no web-rendered surface changes in this PR.

Composer preview (`EmailPreviewCard.tsx`) intentionally untouched in F2 — its inline rendering path is browser-only and already constrains the logo within the preview frame. A follow-up could align the preview's `<img>` shape with the new attributes for parity with the actual email render, but it's not in this PR's ACs.

Post-deploy spot checks for the actual email rendering (F2) and the Survey-detail "Survey Sent: N" header (F3) are recorded under "Manual / post-deploy verification" in `531-feature-implementation-evidence.md`.
