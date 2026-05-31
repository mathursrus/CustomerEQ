---
author: manohar.madhira@outlook.com
date: 2026-05-31
context: issue-524 / feature-implementation
---

# Coaching Moment: idempotent-race-safe-create-on-mount

## What happened

I built a wizard that issues `POST /migrations` in a React mount effect to create a server-side migration record, guarded server-side by a read-then-insert check ("find an active migration; if none, create one") — the exact approach the approved RFC §B.4 called "simpler and sufficient." During the user's live testing this produced **two** migration rows per wizard entry with identical `createdAt`: React 18 dev strict-mode double-invokes the mount effect, firing two creates that both passed the non-atomic guard (TOCTOU race), leaving an orphaned `PENDING_VALIDATION` row. The user surfaced it during manual testing ("after I added the customer back... the new upload only processed when I changed the filename" was a separate one; this one I found verifying the DB).

## What was learned

A client effect that creates a server resource on mount is a concurrent caller by default (React strict-mode in dev, retries/double-clicks in prod), so the create must be idempotent AND the server must be race-safe (row-level lock or a DB unique constraint) — a read-then-insert "one active X per Y" guard is not sufficient, even when an RFC says it is.

## What the agent should have done

Make `POST /migrations` idempotent and atomic from the first implementation: lock the parent row (`SELECT … FOR UPDATE`) or add a partial-unique constraint, and return the existing pre-start resource (200) instead of creating a duplicate. On the client, also guard the create-on-mount effect against the strict-mode double-invoke. Treat "RFC says the app-layer guard is sufficient" as a claim to stress-test for concurrency, not accept.
