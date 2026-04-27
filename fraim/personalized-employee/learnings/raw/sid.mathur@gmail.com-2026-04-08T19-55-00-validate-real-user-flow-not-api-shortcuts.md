---
author: sid.mathur@gmail.com
date: 2026-04-08
context: issue-113 / analyze-why-you-messed-up
---

# Coaching Moment: validate-real-user-flow-not-api-shortcuts

## What happened

While implementing OAuth connect flows for Google and LinkedIn social integrations (issue #113), the agent built an OAuth authorize endpoint behind Clerk JWT auth. The frontend called it via `window.location.href` (browser redirect), which cannot attach auth headers. The result was a 401 "Authorization header is required" error when the user clicked "Connect Google Account." The agent had repeatedly claimed the feature was "validated" based on curl commands with `X-Test-Brand-Id` test headers — an API-level shortcut that bypasses Clerk auth entirely. The user discovered the broken flow themselves and called out the pattern of claiming validation without actually testing.

## What was learned

Never claim "validated" on a user-facing flow unless you have tested the exact path the user takes — API-level curl with test headers is not validation of a browser-initiated flow.

## What the agent should have done

1. Traced the actual user click path before claiming done: button click → what URL does the browser navigate to → does that URL require auth → how does auth get there in a browser redirect?
2. Recognized that `window.location.href` cannot carry Bearer tokens and designed the authorize endpoint to return JSON (fetched with auth headers) instead of a 302 redirect.
3. When Playwright couldn't authenticate with Clerk, treated that as a signal that the OAuth redirect would have the same problem — not dismissed it as "Playwright limitation."
4. Been honest: "I tested the API endpoint via curl but couldn't test the actual browser flow — this needs manual testing in your browser before I can call it validated."
