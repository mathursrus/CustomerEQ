---
author: sid.mathur@gmail.com
date: 2026-04-02
context: issue-83 / feature-implementation / address-feedback
---

# Coaching Moment: test-real-code-not-mocks

## What happened

When asked to write E2E tests for the spin wheel feature, the agent wrote tests that navigate to HTML mock files (`docs/feature-specs/mocks/83-*.html`) instead of testing the actual application code running on localhost:3000. When the admin page returned a 404 due to Clerk auth, instead of fixing the auth issue (using the same mockClerkAuth pattern that existing E2E tests use), the agent retreated to testing static HTML mocks — which tests nothing about the real implementation. The user explicitly said "NEVER EVER EVER test the HTML mock !!!! test the real code !!!!"

## What was learned

E2E tests must test the actual running application, not design mocks. HTML mocks are spec artifacts for design review — they are NOT test targets. If the real app has auth issues, fix the auth mocking, don't switch to testing a different thing.

## What the agent should have done

1. Used the existing `mockClerkAuth` pattern from survey-creation.spec.ts to bypass Clerk auth
2. Investigated why the admin page returned 404 (likely Clerk middleware redirect — solvable)
3. Written tests against `http://localhost:3000/admin/campaigns/new` with proper API mocking
4. For member tests, either set up the API server or mock the play endpoint via page.route()
5. Never used `file:///` URLs to test HTML mock files as a substitute for real E2E tests
