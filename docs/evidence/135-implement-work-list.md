# Issue #135 — Standing Work List

Production API reports `redis: skipped` in `/healthz`. Investigation + fix.

## Diagnosis (Case 1 with amplifier)

`az containerapp show` output on 2026-04-10 confirms:

**customereq-api container env:**
- `REDIS_URL` = `rediss://default:***@modern-seagull-84293.upstash.io:6379` — provisioned Upstash Redis, paid-for
- `QUEUE_MODE` = `inline` — **explicitly set**, overriding the code default of `redis`

**customereq-worker container env:**
- `REDIS_URL` = same Upstash endpoint
- `QUEUE_MODE` = `inline` — **also explicitly set**

### What this means

1. `apps/api/src/plugins/redis.ts` checks `QUEUE_MODE === 'inline'` first and returns `fastify.redis = null`. The healthz endpoint then reports `redis: skipped`.
2. `apps/api/src/queues/bullmq.ts` also gates on `QUEUE_MODE === 'inline'` — in inline mode, every enqueue runs the processor logic synchronously on the API request thread.
3. The worker (`apps/worker/src/index.ts`) does **not** read `QUEUE_MODE` at all. It always boots 9 BullMQ `Worker` instances that connect to Redis and poll queues. In prod today, the worker is happily connected to Upstash — but the API never enqueues anything, so the worker has been idling, doing **zero** distributed work. (Cron/scheduled jobs do still produce to queues from the API via `bullmq.ts`, but inline mode short-circuits those producers too.)

Net effect: Redis is provisioned and connected, but paid for nothing. The architectural invariant in `project_rules.md` rule #5 ("Every loyalty action must flow through the BullMQ event queue") is violated in prod. My Issue #113 connector retry path (`ConnectorRateLimitError` rethrow for BullMQ to retry) is non-functional under inline mode — the rethrow bubbles up as a 500 to the caller.

**This is Case 1**: Redis is provisioned, but `QUEUE_MODE=inline` was set on the API (and worker) container as a leftover — likely from a bootstrap phase where Upstash wasn't wired yet.

## Fix

### Container env fix (primary)
Remove `QUEUE_MODE=inline` from both container apps, OR set `QUEUE_MODE=redis`. Code default is `redis`, so removing the var is sufficient. A GitHub Actions deploy step does not currently set env vars on the container — env is managed directly via `az containerapp update --set-env-vars` one-time. We need a deploy-workflow patch that enforces `QUEUE_MODE=redis` (and `REDIS_URL` secret ref) on every deploy so the invariant is not drift-prone.

### Code fix (guardrail)
`apps/api/src/plugins/redis.ts` default fallback says `'redis'` but the architecture doc says the fallback is `inline`. The doc is wrong and encourages misconfig. Update the doc and keep the code default as `redis` (safer — missing env should not silently disable async processing in prod).

### Architecture doc fix
Update §2 table row for Cache/Queue and §3.3 to correctly describe prod topology: Redis+BullMQ is the production default; inline is for dev/test/CI only.

### Guardrail test
Add a plugin unit test (`apps/api/src/plugins/redis.test.ts`) asserting both code paths:
1. `QUEUE_MODE=inline` -> `fastify.redis === null` and healthz reports `skipped`
2. `QUEUE_MODE=redis` (or unset) -> `fastify.redis !== null`

## Implementation Checklist

- [x] Diagnose with `az containerapp show`
- [ ] `.github/workflows/deploy.yml` — add `--set-env-vars QUEUE_MODE=redis` to both API and Worker deploy steps so every deploy enforces the invariant
- [ ] `apps/api/src/plugins/redis.test.ts` — new test file asserting plugin behavior for both QUEUE_MODE values
- [ ] `docs/architecture/architecture.md` §2 row + §3.3 — rewrite to say prod runs BullMQ+Redis, inline is dev-only
- [ ] `docs/operations/production-queue-mode.md` — new doc: queue mode meanings, impact on retries, how to verify
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke` pass
- [ ] PR created with Case 1 diagnosis, fix, and post-merge verification steps

## Validation Requirements
- Unit: plugin test asserts both modes
- No UI touched
- Manual: after merge + deploy, `curl https://customereq-api.../healthz` returns `redis: ok`

## Out of Scope / Follow-ups
- Actually removing `QUEUE_MODE=inline` from the running prod container — will be done post-merge when the next deploy runs with the new workflow. (The deploy step adds `--set-env-vars QUEUE_MODE=redis` which overrides the existing `inline` value.)
- Worker healthcheck / idle detection — the worker has been silently idling; a separate follow-up issue should add a "is my queue actually draining" observable metric.
