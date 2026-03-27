---
author: sid.mathur@gmail.com
date: 2026-03-26
context: cx-analytics feature build / analyze-why-you-messed-up
---

# Coaching Moment: browser-verify-before-commit

## What happened

After building the full LLM-powered CX analytics feature (39 files, 3 new UI pages, 5 new API endpoints), the agent committed and pushed without opening a browser to verify any of the new pages render. Earlier in the same session, the agent had run thorough Playwright-based UI validation for the surveys feature, catching a P0 crash (TypeError on ratingRange). Despite having this established pattern, the agent skipped browser validation for the new CX analytics pages because all 251 unit tests passed and the build compiled successfully. The user called this out: "you didn't do basic UI validation yourself?"

## What was learned

Unit tests and successful builds do not verify UI rendering — every commit that adds or modifies UI pages must include at least one Playwright browser check before pushing.

## What the agent should have done

Before staging the commit, the agent should have: (1) navigated to http://localhost:3009/admin/analytics/cx in Playwright, (2) taken a screenshot to confirm the page renders, (3) checked the browser console for errors, (4) verified the cluster detail page and survey detail cluster column, and (5) only then committed. This is the same process the agent followed earlier for the surveys feature.
