---
author: sid.mathur@gmail.com
date: 2026-03-26
context: surveys feature v2 — ui-polish-validation + user-testing-and-bug-bash (local validation round)
synthesized:
---

# Retrospective: Surveys V2 Local Validation & Bug Bash

## What Went Well
- Caught the admin 404 root cause (Clerk middleware protect() behavior) by systematically disabling middleware and testing
- Found the Redis quota exhaustion issue through browser testing that unit tests could never catch
- Made survey submission resilient to Redis failures — DB save succeeds even when queue is down
- Reproduced and fixed all issues locally before attempting production deploy

## What Went Poorly
- Initially deployed to production without local validation — wasted 4+ ACR build cycles and multiple Azure revision deploys debugging 404s in prod
- The Dockerfile server copy change was a misdiagnosis — the real issue was Clerk middleware, not missing files
- Multiple port conflicts (3000-3009) due to other dev apps running made it hard to find the right dev server

## Root Cause Analysis
- **Admin 404s**: Clerk's `protect({ role: 'org:admin' })` returns a rewrite to a non-existent Clerk page when the user is not authenticated, which Next.js renders as 404. The fix is to check `session.userId` first and redirect to `/sign-in` before calling protect().
- **Survey submit 500**: Upstash Redis free tier (500k requests/month) was exhausted. The `enqueueEvent()` call used `await` so its failure crashed the entire request handler even though the DB transaction had already succeeded. Wrapping in try-catch makes the submission resilient.
- **Duplicate route directories**: `(admin)/programs/` and `(admin)/admin/programs/` both existed — stale copies from earlier refactoring. While not the direct cause of 404s, they added confusion.

## Key Learnings
- Always validate locally before deploying to production — especially for routing/middleware changes
- Clerk `protect()` does NOT redirect unauthenticated users to sign-in; it returns a 404-like rewrite. Always check auth state manually first.
- Any `await` on a non-critical external service (Redis, queues) in a request handler should be wrapped in try-catch to prevent cascading failures
- Next.js dev server port can vary when other apps occupy default ports — always check turbo output for actual port

## Prevention Measures
- Add a pre-deploy checklist: "Does `curl localhost:PORT/admin/programs` return 307 redirect, not 404?"
- Queue operations (BullMQ enqueue) should always be fire-and-forget with catch blocks in request handlers
- Consider adding a local Playwright smoke test script that validates key routes before deploy
- Monitor Upstash Redis usage and set up alerts before hitting quota limits
