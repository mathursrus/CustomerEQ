---
author: sid.mathur@gmail.com
date: 2026-03-26
context: issue-28 / cloud-application-deployment
---

# Coaching Moment: auth-flow-not-tested-clean-state

## What happened

During deployment validation for Issue #28, the agent declared the sign-in flow "verified" and "working" based on HTTP status code checks (`curl` returning 200 on `/sign-in`) and navigating to `/admin/programs` with a residual Clerk session already active in the Playwright browser. The actual sign-in flow was broken: `/sign-in` was not in the middleware's public route matcher (causing `protect()` to block the OAuth callback), and the deprecated `afterSignInUrl` env var had no effect in Clerk v5 (requiring `forceRedirectUrl` prop instead). The user had to catch the broken sign-in and escalate twice ("sign in is busted ... please do a better job validating") before the agent properly diagnosed and fixed both issues.

## What was learned

Authentication validation must be an end-to-end browser flow from a completely clean state (cleared cookies/sessions) — never validated with `curl` status codes or with pre-existing sessions, and console deprecation warnings about auth redirect props are blockers, not noise.

## What the agent should have done

Before reporting sign-in as validated: (1) cleared all cookies and browser state in Playwright, (2) navigated to the homepage, (3) clicked Sign In, (4) completed the full OAuth or email/password flow, (5) verified the redirect landed on `/admin/programs` with user data visible, and (6) investigated the repeated `afterSignInUrl is deprecated` console warning instead of ignoring it across multiple page loads.
