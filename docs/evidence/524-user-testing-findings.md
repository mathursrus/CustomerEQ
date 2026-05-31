# User-Testing Findings — Issue #524 (Switch Member Identifier Kind, Slice 1)

Running log captured during the user's manual functional pass (silent-capture; batch-fix on signal). Test brand: `cmpu4l3x80000ks3qjx2oixin` (FRAIM- Test, CUSTOMER_ID) seeded with 6 members (3 valid/unique, 2 sharing `dup@acme.test`, 1 blank email).

> **Batch-fix `87f5b23` — F1–F4 all ADDRESSED.** F1: Step-1 partial banner lists missing + duplicate + invalid counts. F2: template export adds an `issue` column (upload ignores it). F3: file input value reset so same-filename re-upload re-validates. F4: `POST /migrations` made idempotent + race-safe (brand-row `FOR UPDATE` lock; pre-start migration reused → 200) so create-on-mount can't duplicate. Integration suite 15/15.

## F1 — Step 1 (partial-coverage) under-reports: missing-email shown, collisions not
- **Scene:** Wizard Step 1, partial-coverage branch.
- **Observed:** Banner shows only `Partial coverage — 5 of 6 members have an email on file.` — i.e. only the missing-email condition.
- **Expected:** Both detected pre-flight issues surfaced upfront in the first run — **emails missing AND duplicate emails** — so the admin can fix everything in one pass instead of iterating (fix one → re-upload → discover the next).
- **Status:** LOGGED (not analyzed/fixed).

## F2 — (enhancement, change from spec) Downloaded template should annotate error rows
- **Idea:** The downloaded mapping template should identify the rows that have an error (e.g. an extra per-row "issue" column flagging missing/duplicate/invalid), so the admin sees exactly which rows to fix. The upload then **ignores** that annotation column.
- **Status:** LOGGED (enhancement; not analyzed/fixed).

## F4 — Wizard create-on-mount creates duplicate migration rows (race past the single-active guard)
- **Observed (during post-migration verification):** brand `cmpu4l3x80000ks3qjx2oixin` has **two** migration rows with the **identical `createdAt` (2026-05-31 18:59:51.645)** and adjacent ids (`…000d` completed `REKEY_COMPLETE_IN_GRACE`; `…000f` orphaned `PENDING_VALIDATION`, 0 members).
- **Likely trigger:** the wizard issues `POST /migrations` on mount; a double mount/effect (React dev strict-mode double-invoke, or no client-side de-dupe) fired two creates near-simultaneously. The server's "one active migration per brand" check is a read-then-insert (`findFirst` active → none → insert), so two concurrent requests both pass the check and both insert (TOCTOU race).
- **Effect:** orphaned `PENDING_VALIDATION` row left behind; the migration itself completed fine. Could also surface as a spurious 409/redirect in other timing.
- **Reproducibility:** reproduced on BOTH runs — the upload-path migration and the fast-path migration each left a duplicate `PENDING_VALIDATION` orphan with an identical `createdAt` to the completed row. Consistent on every wizard entry.
- **Status:** LOGGED (not analyzed/fixed). Surfaced by me during verification, not user-reported.

## F3 — Re-uploading the same filename is a no-op (stale validation result)
- **Scene:** Wizard Step 2, Upload & validate.
- **Repro:** Deleted one customer's row from the CSV → uploaded → correctly flagged "missing customer" (unmapped). Added the customer's row back, saved the file under the **same filename**, re-uploaded → the **same (stale) error remained**; the corrected file was not processed. The new content only validated after **renaming the file** and uploading.
- **Expected:** Re-uploading a corrected file (even with the same filename) re-runs validation against the new contents.
- **Status:** LOGGED (not analyzed/fixed).
