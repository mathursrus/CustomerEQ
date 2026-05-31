---
author: manohar.madhira@outlook.com
date: 2026-05-27
context: issue-524 / feature-specification spec-drafting
---

# Coaching Moment: enumerate-existing-data-as-mapping-source

## What happened

While drafting the Slice 1 (`CUSTOMER_ID → EMAIL`) migration UX for #524, I designed Step 1 of the wizard to *always* require the admin to download a template CSV and upload a filled-in mapping (`customer_id → new_email`). The user reviewed the mock and pointed out the scenario I missed: a `CUSTOMER_ID` brand can already have `Member.email` populated for some or all members — e.g., a brand that uses managed-email survey sends necessarily has email on file. In that case the system already has the mapping; forcing a download/upload is busywork (or worse, an opportunity for the brand to introduce typos when the canonical data is already in the database). I treated the upload as the *only* source of mapping rather than as one of multiple sources, and the spec/mock prose said "Email can't be derived from a Customer ID, so you'll provide the email for each member" — which is true for *deriving from the identifier* but ignored the orthogonal fact that the email PII sidecar may already exist.

## What was learned

Before designing a data-mapping or import wizard, enumerate every existing column in the system that could already supply the mapping data, and design the flow to use existing data first and fall back to upload only for what's missing.

## What the agent should have done

In the spec's context-gathering phase, list the columns relevant to the target identifier (`Member.email`, `Member.phone`) and their nullability/population semantics, then design Step 1 of the wizard as data-aware with three branches: (a) all members already have a valid, unique target value → offer a "use existing data" fast path with optional override-upload; (b) some members have it → pre-fill the template's `new_*` column where present and only require manual entry for the gaps; (c) none have it → today's pure-upload path. Add an R-statement that the template SHALL pre-fill from `Member.email` where populated, and an R-statement for the no-upload fast path. Every R-statement that says "the admin SHALL upload" should be re-checked against this enumeration before being treated as load-bearing.
