---
author: sid.mathur@gmail.com
date: 2026-04-13
context: issue-141 / PR-142 / PR-143
---

## What happened

Implementing the Developer page feature (#141 via PR #142), I added a new `ApiKey` Prisma model. `prisma db push` failed locally because the local DB had drifted (missing pgvector), so I worked around it by running raw SQL (`CREATE TABLE api_keys ...`) directly against local Postgres to get the tests passing. I updated `schema.prisma`, ran `prisma generate`, wrote handler tests, and shipped. Local tests all green. I committed with the note "Created `api_keys` table in local Postgres via raw SQL (migrations applied through `prisma generate` + `build`)" — which is technically accurate but also exactly the kind of sentence that should have stopped me cold.

PR #142 merged and deployed. The new `auth.ts` code path then tried `prisma.apiKey.findUnique` on every `X-Api-Key` request in prod. Prod DB didn't have the table. Every MCP-server call started returning 500 with `P2021`. User caught it when they asked me to verify in prod and I probed the auth path.

I had to ship PR #143 as an emergency hotfix:
1. Defensive try/catch in the auth plugin to swallow P2021 and fall through to the legacy env-var fallback
2. A proper Prisma migration file so future deploys create the table
3. A regression test locking in the P2021 → fallback behavior

## What was learned

**A schema change is not done until the migration file exists.** Raw SQL against the local DB + `prisma generate` gives you green local tests but leaves prod completely unchanged. The migration file is the source of truth for "what shape does the DB need to be in" — without it, the gap between schema and DB is invisible until deploy breaks something.

**Second-order problem**: the deploy pipeline has no `prisma migrate deploy` step. That means EVEN IF I'd written a migration file, it wouldn't have auto-applied. Migration drift is the actual root cause; my PR #142 just happened to be the one that tripped over it. There's a separate repo-level issue worth filing.

## What the agent should have done

When introducing a new Prisma model:
1. Add it to `schema.prisma` **AND** run `prisma migrate dev --name add_<model>` to generate a proper migration file.
2. If local `prisma migrate dev` fails (drift, pgvector, etc.), **fix the drift first** — don't work around it with raw SQL. If the local DB is fundamentally broken, use a throwaway DB or a reset.
3. Before merging, check that the new migration file exists in `packages/database/prisma/migrations/`. If there's no new folder, the schema change isn't really committed.
4. Also check that the deploy pipeline runs migrations. If it doesn't, the new model is a landmine no matter how well-tested the code is — call it out explicitly in the PR and either gate the merge on a deploy-step fix or add a defensive fallback up front.
5. Specifically for auth plugins and other always-on code paths: any new DB dependency should have a graceful-degrade branch for "table doesn't exist yet" from day one, not as a hotfix after prod breaks.
