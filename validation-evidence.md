# Validation Evidence - Issue 113

Issue: `113`
Feature: Social review ingestion and external signal hub

## Scenario Coverage

| User Scenario | Expected outcome | Validation method | Evidence |
|---|---|---|---|
| Admin creates a Google review source | Source row saved with brand scope, config, health state | API integration test | Covered by `apps/api/test/integration/external-signals.test.ts` via `pnpm --filter @customerEQ/api test:integration -- external-signals.test.ts webhooks.test.ts members.test.ts`. |
| Admin tests a source before enabling | Preview result or actionable error returned without activation | API integration test | Covered by `apps/api/test/integration/external-signals.test.ts`; the source test endpoint uses preview payloads without activation. |
| Generic webhook source receives a payload twice | One normalized signal row persists due to dedupe | API integration test | Covered by `apps/api/test/integration/webhooks.test.ts` plus `apps/worker/src/processors/externalSignalIngestion.test.ts`; duplicate deliveries keep one normalized signal row. |
| X or Reddit source sync polls provider successfully | Signals stored under the correct brand and source | Worker integration test | Covered by `apps/worker/src/processors/externalSignalIngestion.test.ts` and sync flow validation in `apps/api/test/integration/external-signals.test.ts`; signals are stored under the correct brand and source. |
| Unmatched signal is ingested | Visible in CX analytics, absent from Customer 360 | API integration test | Covered by `apps/api/test/integration/external-signals.test.ts` and CX analytics validation in `apps/api/src/routes/analytics.ts`; unmatched signal remains visible in CX analytics and absent from Customer 360. |
| Deterministically matched signal is ingested | Appears in member 360 `externalSignals` block | API integration test | Covered by `apps/api/test/integration/members.test.ts` and `apps/worker/src/processors/externalSignalIngestion.test.ts`; matched signal appears in member 360 `externalSignals`. |
| Active source starts failing auth | Integrations page shows degraded health and last error | Browser validation + API integration test | Covered by `apps/api/test/integration/external-signals.test.ts` for degraded health and last error, plus browser validation on `apps/web/src/app/(admin)/admin/integrations/page.tsx` in `pnpm --filter @customerEQ/web test:e2e -- --grep "Workflow 7: External Signal Sources"`. |
| Analytics page filters external signals by source type | Operator sees narrowed result set with provenance badges | Browser validation | Covered by `apps/web/test/e2e/workflows.spec.ts` and `apps/web/test/e2e/external-signals-mobile.spec.ts`; the analytics page filters external signals by source type and shows provenance badges. |

## Commands Run

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:smoke`
- `pnpm --filter @customerEQ/shared test -- externalSignal.schema.test.ts member.schema.test.ts`
- `pnpm --filter @customerEQ/worker test -- src/processors/externalSignalIngestion.test.ts`
- `pnpm --filter @customerEQ/api test:integration -- external-signals.test.ts webhooks.test.ts members.test.ts`
- `pnpm --filter @customerEQ/web test:e2e -- --grep "Workflow 7: External Signal Sources"`
- `pnpm --filter @customerEQ/web test:e2e -- external-signals-mobile.spec.ts`
- `pnpm test`
- `pnpm exec turbo run test --concurrency=1`

## Regression Notes

- `pnpm test` under Turbo's default parallel execution reports `@customerEQ/ai` as failed on this Windows environment with exit code `-1073741819`, even though all `@customerEQ/ai` tests pass in the same run output.
- `pnpm --filter @customerEQ/ai test` passes in isolation.
- `pnpm exec turbo run test --concurrency=1` passes across the full repo, which isolates the failure to the parallel test harness rather than issue `113` behavior.

## UI Evidence

- `docs/evidence/ui-polish/113/integrations-iphone13-portrait.png`
- `docs/evidence/ui-polish/113/analytics-cx-iphone13-portrait.png`
- `docs/evidence/ui-polish/113/member-360-iphone13-portrait.png`
