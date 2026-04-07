# Feature Implementation Evidence - Issue #113: Social Review Ingestion and External Signal Hub

Issue: `113`
Branch: `feature/issue-113-social-review-ingestion-spec`
Spec: `docs/feature-specs/113-social-review-ingestion.md`
RFC: `docs/rfcs/113-social-review-ingestion.md`
PR: `#114` (`https://github.com/mathursrus/CustomerEQ/pull/114`)

## Summary

Implemented a brand-scoped external signal platform that adds:

- a source registry for review and social channels
- a normalized `ExternalSignal` persistence model
- queue-first sync and ingestion processors
- an admin external-signal feed plus CX analytics exposure
- matched external signals in Customer 360
- admin and operator UI for integrations, analytics, and member context

The implementation intentionally keeps provider realism within repo-feasible boundaries for v1: source testing and sync use configured `samplePayloads` / `seedSignals`, the generic webhook path supports real inbound deliveries, and the shared model remains extensible for future native connectors. The completed implementation was folded into the existing canonical review branch for PR `#114` instead of opening a second implementation PR.

## Files Changed

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added external source/signal enums, models, and `Brand` / `Member` relations |
| `packages/database/prisma/migrations/20260407133000_add_external_signals/migration.sql` | Added additive migration SQL for external signal tables and enums |
| `packages/shared/src/externalSignals.ts` | Added shared external-signal types, helpers, and normalization exports |
| `packages/shared/src/zod/externalSignal.schema.ts` | Added source CRUD, test, list-query, and external-signal query schemas |
| `packages/shared/src/zod/member.schema.ts` | Extended Customer 360 query/response with `externalSignals` |
| `packages/shared/src/queues.ts` | Added queue names for external signal sync and ingestion |
| `packages/shared/src/index.ts` | Exported new schemas, helpers, and queue constants |
| `packages/config/src/test-utils/factories/externalSignals.factory.ts` | Added external source/signal factories with source-health metadata support |
| `packages/config/src/test-utils/index.ts` | Exported new factories |
| `packages/config/src/test-utils/mocks/database.mock.ts` | Extended Prisma mock coverage for external signal models |
| `apps/api/src/routes/externalSignals.ts` | Added admin source registry, source testing, sync enqueue, and external-signal feed routes |
| `apps/api/src/routes/webhooks.ts` | Added generic external signal webhook receiver |
| `apps/api/src/routes/analytics.ts` | Added external-signal feed endpoint and CX aggregate extensions |
| `apps/api/src/routes/members.ts` | Added matched external-signal support to Customer 360 |
| `apps/api/src/queues/bullmq.ts` | Added external signal sync/ingestion producers and inline handling |
| `apps/api/src/app.ts` | Registered external signal routes |
| `apps/api/test/integration/external-signals.test.ts` | Added source CRUD, preview, sync, analytics, unmatched-signal, and source-health coverage |
| `apps/api/test/integration/webhooks.test.ts` | Added generic external signal webhook coverage |
| `apps/api/test/integration/members.test.ts` | Extended Customer 360 integration coverage for matched external signals |
| `apps/worker/src/processors/externalSignalSync.ts` | Added source sync processor |
| `apps/worker/src/processors/externalSignalIngestion.ts` | Added normalization, dedupe, persistence, and source-health updates |
| `apps/worker/src/processors/externalSignalSync.test.ts` | Added sync queueing and source-health failure coverage |
| `apps/worker/src/processors/externalSignalIngestion.test.ts` | Added normalization, dedupe, and conservative matching coverage |
| `apps/worker/src/queues/producers.ts` | Added worker-side producer helpers for external signal jobs |
| `apps/worker/src/index.ts` | Registered external signal workers |
| `apps/web/src/app/(admin)/admin/integrations/page.tsx` | Added review/social source registry, health badges, preview, and sync UI |
| `apps/web/src/app/(admin)/admin/integrations/external-signal-source-form.tsx` | Extracted source form to keep the page maintainable |
| `apps/web/src/app/(admin)/admin/analytics/cx/page.tsx` | Added external signal counts, filters, and analytics feed UI |
| `apps/web/src/app/(admin)/admin/members/[id]/page.tsx` | Added matched external signals to Customer 360 |
| `apps/web/test/e2e/workflows.spec.ts` | Added external signal source admin workflow coverage |
| `apps/web/test/e2e/external-signals-mobile.spec.ts` | Added mobile validation for integrations, analytics, and Customer 360 |

## Traceability Matrix

| Requirement | Implemented File/Function | Proof (Test/Evidence) | Status |
|---|---|---|---|
| R1: Brand admin can create multiple external signal sources per brand | `apps/api/src/routes/externalSignals.ts` (`POST /admin/external-signal-sources`, `GET /admin/external-signal-sources`) | `external-signals.test.ts > creates and lists multiple brand-scoped external signal sources` | Met |
| R2: Source config captures type, connection method, scope, sync mode, filters, enabled state | `packages/shared/src/zod/externalSignal.schema.ts` and `apps/api/src/routes/externalSignals.ts` | `externalSignal.schema.test.ts` plus successful source create/list integration flow | Met |
| R3: Google, LinkedIn, Reddit, X/generic channels can be represented in the source registry | `packages/shared/src/externalSignals.ts`, `packages/database/prisma/schema.prisma`, `apps/web/src/app/(admin)/admin/integrations/page.tsx` | Source picker and schema coverage include `GOOGLE_BUSINESS_PROFILE`, `LINKEDIN_ORG`, `REDDIT`, `X`, `GENERIC_WEBHOOK`, `GENERIC_API`; `externalSignal.schema.test.ts > accepts all supported source types in the registry` | Met |
| R4: Ingested items normalize into a common external signal record with provenance | `apps/worker/src/processors/externalSignalIngestion.ts`, `packages/shared/src/externalSignals.ts` | `externalSignalIngestion.test.ts > creates a new matched external signal from an incoming delivery` | Met |
| R5: Deduplicate by source plus provider-native ID | `packages/database/prisma/schema.prisma` (`@@unique([sourceId, externalId])`) and `apps/worker/src/processors/externalSignalIngestion.ts` | `externalSignalIngestion.test.ts > updates an existing signal and appends provider status history` | Met |
| R6: Support brand-level unresolved storage and optional member/product association | `apps/api/src/routes/analytics.ts`, `apps/api/src/routes/members.ts`, `apps/worker/src/processors/externalSignalIngestion.ts` | `external-signals.test.ts > returns unmatched signals in analytics while preserving source health and canonical metadata` | Met |
| R7: Expose normalized external signals in CX analytics | `apps/api/src/routes/analytics.ts`, `apps/web/src/app/(admin)/admin/analytics/cx/page.tsx` | `external-signals.test.ts > lists external signals and includes them in CX analytics summaries`; `external-signals-mobile.spec.ts` | Met |
| R8: Customer 360 includes matched external signals | `apps/api/src/routes/members.ts`, `apps/web/src/app/(admin)/admin/members/[id]/page.tsx` | `members.test.ts` matched external-signal coverage and mobile Customer 360 evidence | Met |
| R9: Source health shows last sync, import count, and last error | `apps/api/src/routes/externalSignals.ts`, `apps/worker/src/processors/externalSignalSync.ts`, `apps/web/src/app/(admin)/admin/integrations/page.tsx` | `external-signals.test.ts > returns unmatched signals in analytics while preserving source health and canonical metadata`; `externalSignalSync.test.ts > marks the source unhealthy when no sample payloads are configured` | Met |
| R10: Preserve canonical link to original content | `apps/worker/src/processors/externalSignalIngestion.ts`, `apps/api/src/routes/analytics.ts`, `apps/api/src/routes/members.ts` | `external-signals.test.ts > returns unmatched signals in analytics while preserving source health and canonical metadata` | Met |
| R11: Queue-first normalization and downstream work | `apps/api/src/queues/bullmq.ts`, `apps/worker/src/processors/externalSignalSync.ts`, `apps/worker/src/processors/externalSignalIngestion.ts` | `external-signals.test.ts > queues a manual source sync job`; `webhooks.test.ts > accepts a valid external signal webhook and queues ingestion`; `externalSignalSync.test.ts > queues normalized deliveries from configured sample payloads` | Met |
| R12: Support source-specific preview testing before activation | `apps/api/src/routes/externalSignals.ts` (`POST /admin/external-signal-sources/:id/test`), `apps/web/src/app/(admin)/admin/integrations/page.tsx` | `external-signals.test.ts > tests a source and returns normalized preview records`; `workflows.spec.ts > Workflow 7: External Signal Sources > creates a source and previews sample payloads` | Met |
| R13: All source and signal records are `brandId` scoped | `packages/database/prisma/schema.prisma`, `apps/api/src/routes/externalSignals.ts`, `apps/api/src/routes/analytics.ts`, `apps/api/src/routes/members.ts` | API integration tests operate on authenticated brand scope only; cross-brand member access remains 404 in `members.test.ts` | Met |
| R14: Store provider-native identifiers and raw payloads for replay/audit | `packages/database/prisma/schema.prisma`, `apps/worker/src/processors/externalSignalIngestion.ts` | Prisma schema review plus ingestion processor tests that persist normalized deliveries | Met |
| R15: Member matching is optional and conservative | `apps/worker/src/processors/externalSignalIngestion.ts` | Unmatched-signal analytics test plus matched-signal ingestion test show unmatched-by-default behavior when deterministic identity is absent | Met |
| R16: Separate provider-posted and ingestion timestamps | `packages/database/prisma/schema.prisma`, `apps/worker/src/processors/externalSignalIngestion.ts` | Prisma schema defines `postedAt` and `ingestedAt`; integration feed returns posted timestamps | Met |
| R17: Preserve status history across provider updates | `apps/worker/src/processors/externalSignalIngestion.ts` | `externalSignalIngestion.test.ts > updates an existing signal and appends provider status history` | Met |
| R18: Support near-real-time ingestion when webhook notifications exist | `apps/api/src/routes/webhooks.ts`, `apps/api/src/queues/bullmq.ts` | `webhooks.test.ts > accepts a valid external signal webhook and queues ingestion` | Met |
| R19: Registry is extensible for future providers | `packages/database/prisma/schema.prisma`, `packages/shared/src/zod/externalSignal.schema.ts`, `apps/web/src/app/(admin)/admin/integrations/page.tsx` | Schema/type coverage shows source-type extensibility without a provider-specific UX fork | Met |
| R20: Ingestion fails loudly with provider diagnostics | `apps/worker/src/processors/externalSignalSync.ts`, `apps/web/src/app/(admin)/admin/integrations/page.tsx` | `externalSignalSync.test.ts > marks the source unhealthy when no sample payloads are configured`; source-health integration test confirms surfaced diagnostics | Met |

## Validation Results

| Check | Result |
|---|---|
| `pnpm build` | Passed earlier in implementation validation |
| `pnpm typecheck` | Passed earlier in implementation validation; reran after quality refactor and remained green |
| `pnpm lint` | Passed earlier in implementation validation; reran after quality refactor and remained green |
| `pnpm test:smoke` | Passed |
| `pnpm --filter @customerEQ/shared test -- externalSignal.schema.test.ts member.schema.test.ts` | Passed |
| `pnpm --filter @customerEQ/worker test -- src/processors/externalSignalIngestion.test.ts` | Passed earlier in implementation validation |
| `pnpm --filter @customerEQ/worker test -- src/processors/externalSignalIngestion.test.ts src/processors/externalSignalSync.test.ts` | Passed in completeness review |
| `pnpm --filter @customerEQ/api test:integration -- external-signals.test.ts webhooks.test.ts members.test.ts` | Passed in completeness review |
| `pnpm --filter @customerEQ/web test:e2e -- --grep "Workflow 7: External Signal Sources"` | Passed |
| `pnpm --filter @customerEQ/web test:e2e -- external-signals-mobile.spec.ts` | Passed |
| `pnpm exec turbo run test --concurrency=1` | Passed earlier in implementation validation |
| `pnpm dlx tsx "$HOME/.fraim/scripts/verify-test-coverage.ts"` | Passed in completeness review when `GIT_BRANCH=feature/113-social-review-ingestion-implementation` was set for the FRAIM helper |
| `pnpm dlx tsx "$HOME/.fraim/scripts/validate-test-coverage.ts" 113` | Passed in completeness review |

## Validation Requirements Status

| Requirement | Required | Executed | Evidence |
|---|---|---|---|
| Unit tests | Yes | Yes | Shared schema tests plus worker processor tests |
| Integration tests | Yes | Yes | Admin source registry, webhooks, analytics, and Customer 360 integration suites |
| Browser validation | Yes | Yes | Desktop admin workflow plus iPhone 13 evidence for integrations, analytics, and Customer 360 |
| Mobile responsiveness | Yes | Yes | `apps/web/test/e2e/external-signals-mobile.spec.ts` and screenshots in `docs/evidence/ui-polish/113/` |
| Traceability coverage gate | Yes | Yes | FRAIM coverage helpers passed 8/8 validation scenarios |

## Standing Work List Status

Reference: `docs/evidence/113-implement-work-list.md`

- All Phase 1 through Phase 5 checklist items are complete.
- All validation items listed in the work list were executed.
- No remaining unchecked implementation tasks were left open at handoff.

## Feedback History

Source: `docs/evidence/113-feature-implementation-feedback.md`

```md
# Feature Implementation Feedback - Issue 113

Issue: `113`
Phase: `implement-quality`

## Quality Findings

### QUALITY CHECK FAILURE 1

- Status: `ADDRESSED`
- Initial status: `UNADDRESSED`
- File: `apps/web/src/app/(admin)/admin/integrations/page.tsx`
- Finding: The integrations page had grown to 524 lines and mixed route data loading, registry rendering, and the entire add-source form in one file. That crossed the quality job's monolithic-file threshold and duplicated the default form state inline.
- Resolution: Extracted the add-source form into `apps/web/src/app/(admin)/admin/integrations/external-signal-source-form.tsx` and centralized the default form state in `DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM`.
- Evidence:
  - `apps/web/src/app/(admin)/admin/integrations/page.tsx` is now 383 lines.
  - `pnpm typecheck` passed after the refactor.
  - `pnpm --filter @customerEQ/web test:e2e -- --grep "Workflow 7: External Signal Sources"` passed after the refactor.

### QUALITY CHECK FAILURE 2

- Status: `ADDRESSED`
- Initial status: `UNADDRESSED`
- File: `apps/web/src/app/(admin)/admin/integrations/page.tsx`
- Finding: The source metadata row rendered mojibake separators in the admin UI (`Ã¢â‚¬Â¢`) instead of clean readable text.
- Resolution: Replaced the garbled separators with ASCII-safe `-` separators in the rendered source metadata.
- Evidence:
  - Source cards now render `- active` / `- paused`.
  - Source cards now render `Last sync ... - Last import ...`.
  - The same Playwright workflow passed after the cleanup.

## UI Baseline Validation

- Validation standard: generic baseline only, since no separate design-token brief was provided for this phase.
- Surfaces checked:
  - `admin/integrations` via Playwright desktop workflow
  - Existing iPhone 13 evidence for integrations, CX analytics, and member 360 in `docs/evidence/ui-polish/113/`
- Result:
  - No new P0 or P1 layout, clipping, overflow, or CTA discoverability issues were observed on the integrations surface after the refactor.
  - Existing pre-release warnings from Next about synchronous `headers()` usage still appear during Playwright startup, but they are pre-existing and did not block the tested flows.

## Quality Summary

- Addressed failures: `2`
- Remaining unaddressed quality failures introduced by issue `113`: `0`
```

## Feedback Verification

Reference: `docs/evidence/113-feature-implementation-feedback.md`

- Quality findings recorded: `2`
- Quality findings still unaddressed: `0`
- Both quality failures were resolved before completeness review:
  - extracted the integrations source form from the page-level component
  - replaced mojibake separators with ASCII-safe metadata rendering

No additional PR review feedback was pending at the time of this completeness review submission.

## Design Standards Alignment

- The implementation preserves the existing admin product language rather than introducing a new visual system.
- The integrations surface now separates the static platform webhooks from the new review/social source registry, which matches the RFC's intended operator mental model.
- CX analytics keeps survey metrics intact while adding an external-signal feed, instead of forcing public signals into survey semantics.
- Customer 360 only renders matched external signals, which aligns with the spec's conservative identity and compliance requirements.
- Mobile evidence was captured for all three touched surfaces to confirm the UI remained usable beyond the desktop happy path.

## Key Decisions and Deferrals

1. V1 source sync uses configured `samplePayloads` / `seedSignals` plus the generic webhook path, rather than claiming live native ingestion coverage for every provider named in the spec.
2. Matching remains deterministic and conservative in v1. Public content stays unmatched unless a strong identifier exists.
3. The checked-in Prisma migration was generated via `prisma migrate diff` because local `prisma migrate dev` was blocked by shadow-database permissions (`P3014`).
4. Repo-wide `pnpm test` remains flaky in default parallel mode on this Windows environment because `@customerEQ/ai` can exit with `-1073741819` despite passing output; serialized `pnpm exec turbo run test --concurrency=1` passes and was retained as the reliable repo-wide regression check.
5. FRAIM's `verify-test-coverage.ts` helper expects a `feature/<issue>-...` branch pattern; the actual branch uses `feature/issue-113-...`, so the completeness run supplied an issue-number-compatible `GIT_BRANCH` value only for the helper invocation and did not rename the branch.

## Phase Completion

- `implement-scoping`: captured the implementation work list in `docs/evidence/113-implement-work-list.md`
- `implement-tests`: added shared, worker, API integration, and Playwright coverage for the new external-signal surface area
- `implement-code`: implemented the schema, queues, workers, admin routes, analytics feed, Customer 360 support, and UI changes listed in this evidence doc
- `implement-validate`: completed build, typecheck, lint, smoke, targeted integration, and browser validation recorded in `validation-evidence.md`
- `implement-regression`: reran the feature-critical regression suites and kept serialized Turbo test as the reliable full-repo fallback on Windows
- `implement-quality`: fixed the oversized integrations page and mojibake metadata rendering documented in the feedback history above
- `implement-completeness-review`: added the R1-R20 traceability matrix and reran the worker/API proofs plus FRAIM coverage helpers
- `implement-architecture-update`: updated `docs/architecture/architecture.md` and captured the architectural delta in `docs/evidence/113-feature-implementation-architecture-update.md`

## Evidence References

- `docs/evidence/113-implement-work-list.md`
- `docs/evidence/113-feature-implementation-feedback.md`
- `docs/evidence/113-feature-implementation-architecture-update.md`
- `docs/evidence/ui-polish/113/integrations-iphone13-portrait.png`
- `docs/evidence/ui-polish/113/analytics-cx-iphone13-portrait.png`
- `docs/evidence/ui-polish/113/member-360-iphone13-portrait.png`
- `validation-evidence.md`
