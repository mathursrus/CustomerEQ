---
author: manohar.madhira@outlook.com
date: 2026-05-31
context: issue-524 / feature-implementation
---

# Coaching Moment: reset-file-input-value-for-reupload

## What happened

I built a CSV upload step with a standard `<input type="file" onChange={...}>` that validated the file on selection. During live testing the user deleted a CSV row (got the expected "missing customer" error), fixed it, and re-uploaded the **same filename** — but the stale error remained; the corrected file "only processed when I changed the filename." The `onChange` event doesn't fire when the browser sees the selected file as unchanged, so re-selecting the same file is a silent no-op.

## What was learned

An HTML file input that needs to accept re-selection of the same filename must reset its `value` (to `''`) on change, otherwise the browser suppresses the `change` event for an unchanged selection and the handler never re-runs.

## What the agent should have done

In the `onChange` handler, capture the file then immediately clear the input (`e.target.value = ''`) before processing, so re-selecting the same corrected file fires `change` again and re-validates. Include a re-upload-same-name path in the test/validation checklist for any file-upload UI, not just the happy first-upload.
