# Evidence Document — Issue #113 Technical Design

## Summary

Completed FRAIM `technical-design` authoring for issue `#113` on branch `feature/issue-113-social-review-ingestion-design`.

## Inputs Reviewed

- Issue `#113`
- `docs/feature-specs/113-social-review-ingestion.md`
- `docs/feature-specs/mocks/113-view.html`
- `docs/rfcs/98-customer-360-search-kyc.md`
- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/routes/members.ts`
- `apps/api/src/routes/analytics.ts`
- `apps/api/src/queues/bullmq.ts`
- `apps/worker/src/index.ts`
- `packages/database/prisma/schema.prisma`
- `packages/shared/src/zod/member.schema.ts`
- `apps/web/src/app/(admin)/admin/integrations/page.tsx`
- `apps/web/src/app/(admin)/admin/analytics/cx/page.tsx`
- `apps/web/src/app/(admin)/admin/members/[id]/page.tsx`

## Ambiguity Assessment

| Topic | Assessment | Resolution |
|---|---|---|
| Internal architecture fit | Low | Existing webhook, queue, analytics, and 360 patterns are sufficient |
| Source registry data model | Low | New additive `ExternalSignalSource` and `ExternalSignal` models |
| Customer 360 exposure | Low | Extend existing `GET /v1/members/:id/360` response with `externalSignals` |
| Analytics exposure | Low | Add external-signal endpoint and aggregate extension rather than faking survey rows |
| Provider-specific feasibility | Medium | Constrain v1 to documented provider scopes plus generic webhook/API fallback |
| Identity matching policy | Medium | Deterministic matching only in v1; unmatched by default |

Result: no High-uncertainty item remained after provider verification, so the design proceeded as a standard RFC rather than a spike.

## Output

- RFC created: `docs/rfcs/113-social-review-ingestion.md`
- RFC updated with `Architecture Analysis` covering followed patterns, missing architecture coverage, and alignment fixes

## Issue State

- Labels after design update: `status:needs-review`, `phase:design`

## Architecture Gap Review

### Patterns Correctly Followed

- Queue-first event processing
- `brandId`-scoped multi-tenancy
- Shared Zod/types/queue constants in `packages/shared`
- Reuse of `/v1/integrations/webhooks/*`
- Standard pagination envelope for list endpoints
- Azure Key Vault-aligned secret reference pattern

### Patterns Missing From Architecture

- External signal source registry model and admin routes
- External signal normalized store
- External signal sync and ingestion workers
- Customer 360 external signal collection
- CX analytics external-signal feed

### Incorrectly Followed Patterns

- None after aligning the RFC’s secret-handling language to the existing architecture standard

## Provider Documentation Used

- Google Business Profile APIs: https://developers.google.com/my-business/
- LinkedIn Community Management APIs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-social-action-notifications?view=li-lms-2025-10
- Reddit API docs: https://www.reddit.com/dev/api/
- X Search Posts docs: https://docs.x.com/x-api/posts/search/introduction
