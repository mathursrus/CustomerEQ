---
author: sid.mathur@gmail.com
date: 2026-04-02
context: issue-83 / feature-implementation / address-feedback
---

# Coaching Moment: e2e-tests-must-hit-real-api

## What happened

The E2E tests for the spin wheel campaign creation use `page.route()` to mock all API responses. This means they never actually call the real `POST /v1/campaigns` endpoint with `actionType: "spin_wheel"`. When a real user tried to create a spin wheel campaign, Prisma threw an error because `triggerCondition` was undefined (optional in Zod but required by Prisma). The E2E tests passed because the mocked API always returned 201. The tests were testing the UI form behavior, not the actual end-to-end flow.

## What was learned

E2E tests that mock the API are really just UI interaction tests, not true end-to-end tests. At least one E2E test per feature should hit the real API with the real database to catch integration bugs like schema mismatches, missing required fields, and type coercion issues.

## What the agent should have done

Written at least one integration test (Supertest) that calls `POST /v1/campaigns` with a `spin_wheel` actionConfig and no triggerCondition, verifying the 201 response against the real Prisma/PostgreSQL stack. This would have caught the `triggerCondition` missing field error immediately.
