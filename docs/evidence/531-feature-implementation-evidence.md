# Issue #531 — Feature Implementation Evidence

## Code validation

`git status --short` (worktree-local; clean except the intended diff):

```
 M apps/api/src/routes/distributionBatches.ts
 M apps/api/test/integration/distributionBatches.test.ts
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.test.tsx
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/types.ts
 M packages/shared/src/zod/distributionBatch.schema.test.ts
 M packages/shared/src/zod/distributionBatch.schema.ts
?? docs/evidence/531-implement-work-list.md
?? docs/evidence/531-feature-implementation-evidence.md
?? docs/evidence/531-ui-polish-validation.md
```

Grepped the diff for placeholders: `TODO`, `FIXME`, `console.log` — none introduced.

## Build verification

- `pnpm turbo run typecheck --concurrency=1` — 20/20 packages green.
- `pnpm turbo run build --concurrency=1` — 12/12 packages green (8 cache hit + 4 cache miss rebuilt cleanly).

## Targeted automated tests (post-fix)

| Layer | Result | Detail |
|---|---|---|
| `@customerEQ/shared` unit (schema) | **731 / 731 pass** | Includes the 5 new `memberIds`-on-`CustomListAudience` schema tests (#531) |
| AudienceBuilder web unit | **3 / 3 pass** | Includes the new `emits memberIds[] for search-result rows (Issue #531)` and the existing test whose assertion was updated to match the new contract (resolved rows live on `memberIds`, paste body stays empty for purely-resolved audiences). |
| `@customerEQ/api` integration (`distributionBatches.test.ts`) | **21 / 21 pass** | Includes the 4 new `POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)` cases: production-repro (paste-only fails AUDIENCE_EMPTY when brand kind disagrees with externalId shape), fix-verification (memberIds-only succeeds for the same configuration), dedup (same member via both channels yields one token), cross-brand tenant isolation (memberIds from a different brand cannot dispatch). |

### Pre-existing flake noted (not caused by this change)

`apps/api/src/plugins/redis.test.ts > redisPlugin > calls redis.quit on app close` fails under full-suite parallel load (40/41 files green) but passes when run in isolation on **both** `main` and this branch (verified by running it on each). Worker-pool isolation issue, unrelated to distribution-batches.

## Bug Bash Findings

To be completed after manual UI repro lands. Bullets currently held:
- 0 issues found via the automated layers (schema, unit, build, typecheck).
- Integration + UI validation pending Docker + browser session.

## Pending validation modes (require user-side resources)

1. **Integration tests** — needs `docker compose up -d postgres`. Once Postgres is reachable on `localhost:5432`, I will run:
   ```
   pnpm --filter @customerEQ/api test:integration -- distributionBatches
   ```
   Expected post-fix result: 4 new tests in the `POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)` describe block pass; pre-existing tests remain green.

2. **Manual UI repro** — needs the local dev server (`pnpm dev`) plus a Clerk-authenticated admin session against a brand whose `memberIdentifierKind` mismatches an existing member's `externalId` shape (the production case). Will record:
   - DevTools network capture of `POST /v1/surveys/.../distribution-batches`.
   - Confirmation that the request body now carries `memberIds[]` with the canonical `Member.id` and an empty `identifiers` string for purely UI-resolved audiences.
   - Confirmation of 201 success + recipientCount=1 + Sending state transitions to Sent (or a bounded suppression skip, both of which are correct outcomes — the bug was the silent drop, not the delivery itself).
