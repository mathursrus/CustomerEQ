# Implementation Work List — Issue #231

**Owner**: Claude (FRAIM `feature-implementation` job)
**Date**: 2026-05-03
**Issue**: [#231](https://github.com/mathursrus/CustomerEQ/issues/231) — Survey response data model rework
**Spec**: `docs/feature-specs/231-survey-response-data-model-rework.md`
**RFC**: `docs/rfcs/231-survey-response-data-model-rework.md`

---

## Phase Splitting Decision — RECOMMENDATION FOR USER REVIEW

**Total file count (from RFC change list + tests + architecture-doc updates)**: ~26 files. Exceeds the 15-file FRAIM Phase Splitting threshold.

### Proposed split — 2 PRs ← recommended

| PR | Theme | Scope | File count | Tests | User-visible behavior change? |
|---|---|---|---|---|---|
| **PR1: Foundation** | Schema + GDPR plumbing + service skeletons + collision guard | Schema migration, pre-migration collision-guard script, `Member.enrolledVia` enum, V0 `IpGeoProvider` interface + `AzureMapsIpGeoProvider` impl, GDPR field-list extensions (erasure + dataExport), `Brand` field additions for consent text + URLs, `Survey` field additions for responsePolicy + override + attestation. | ~10 source + 3 unit tests | 3 unit | **No** — additive infra; no endpoint behavior change; existing flows continue to work via backfilled `enrolledVia = MANUAL_API`. |
| **PR2: Behavior** | API endpoints + auto-enroll + consent text + UI + integration/E2E tests + architecture.md updates | Modified `POST /v1/members/enroll` (R6 idempotent upsert, R8 optional consentGivenAt), new `POST /v1/public/surveys/:surveyId/respond`, `memberResolution` service, `consentResolver` service, channel-attribution rule, R10 auto-enroll, R17 attestation paths, web `/enroll` consent rendering, integration tests, E2E tests, architecture.md updates (5 patterns + 3 stale diagrams). | ~10 source + 5 integration + 3 E2E + arch.md | 2 unit + 5 integration + 3 E2E | **Yes** — auto-enrollment shipped; embedded survey path shipped; case-insensitive identifier shipped. |

### Why 2 PRs over 3 or 1

- **Why not 1**: 26 files in one PR is reviewer-hostile; PR1 ships purely additive schema + plumbing that's easy to verify without coupling to behavior changes (lower review-cost-per-file).
- **Why not 3** (foundation / API / web): the API+web split adds a third PR without a clean cut — the web change is one file (`enroll/page.tsx` rendering brand consent text) and ships the same user-visible behavior as the API consent-text resolution. Bundling them keeps PR2 self-validating end-to-end.

### Why this split is safe

- **PR1 does not change any user-visible API behavior.** New columns are nullable or have defaults; new enum values don't affect existing code paths; new services are exposed but not yet wired into any endpoint. Backfilled `enrolledVia = MANUAL_API` is a benign default for existing rows.
- **PR1 unblocks PR2 with no foundation rewrite.** Once PR1 lands, PR2 can branch fresh from main and consume the foundation without coordination overhead.
- **Hero #6 SLA protection** is a PR2 concern (auto-enroll latency budget). PR1 has no synchronous-path changes.
- **GDPR erasure + data export field additions** ship in PR1 — keeps compliance scope bounded to the foundation PR rather than racing with behavior changes.

### Alternatives considered (non-recommended)

- **3-PR split** — adds a third review cycle without a clean architectural seam. Web changes are too thin to stand alone.
- **1 monolithic PR** — exceeds project's L1-validated tight-PR-scope preference (P-HIGH 8.0 / 8 recurrences); would also be hard to review in one pass given schema migration + new endpoint + auto-enroll logic + consent UX + tests + architecture-doc updates.

**Decision needed before implementation begins**: 2 PRs ✅ recommended / 3 PRs / 1 PR / other split.

---

## PR1: Foundation — detailed checklist

### Schema (Prisma)

- [ ] `packages/database/prisma/schema.prisma`:
  - [ ] Add to `Brand`: `memberIdentifierKind MemberIdentifierKind @default(EMAIL)`, `consentMode ConsentMode @default(EXPLICIT)`, `consentTextDefault String?`, `privacyPolicyUrl String?`, `termsUrl String?`
  - [ ] Add to `Member`: `externalId String` (NOT NULL after backfill), `enrolledVia MemberEnrolledVia` (NOT NULL after backfill)
  - [ ] Add to `Survey`: `responsePolicy ResponsePolicy @default(MULTIPLE)`, `consentTextOverride String?`, `consentSuppressedAttestedBy String?`, `consentSuppressedAttestedAt DateTime?`
  - [ ] Add 4 enums: `MemberIdentifierKind` (EMAIL, PHONE, CUSTOMER_ID), `ConsentMode` (EXPLICIT, IMPLIED_ON_SUBMIT), `MemberEnrolledVia` (MANUAL_API, BULK_IMPORT, SURVEY_RESPONSE, EMBEDDED_FORM, CLERK_OAUTH), `ResponsePolicy` (ONCE, MULTIPLE, LATEST_OVERWRITES)
  - [ ] Drop `@@unique([brandId, email])` from `Member`; add `@@unique([brandId, externalId])` and `@@index([brandId, externalId])`
  - [ ] Drop `@@unique([surveyId, memberId])` from `SurveyResponse`; add `@@index([surveyId, memberId])`

### Migration

- [ ] `packages/database/prisma/migrations/{ts}_survey_response_rework/migration.sql` — single transactional migration (per RFC § Schema migration). Use Prisma's `migrate dev` to generate, then hand-review the generated SQL against the RFC for ordering.
- [ ] `packages/database/scripts/check-identifier-collisions.ts` — NEW. Pre-migration guard: query `(brandId, lower(email))` collisions; fail non-zero with CSV report if any exist.
- [ ] CI hook: wire collision-guard into the pre-migration step (`.github/workflows/ci.yml` — Validate Prisma schema or sibling step).

### Services

- [x] `apps/api/src/services/ipGeo.ts` — NEW. `IpGeoProvider` interface + `AzureMapsIpGeoProvider` (V0) + `NoopIpGeoProvider` + `selectIpGeoProvider` factory. Calls `https://atlas.microsoft.com/geolocation/ip/json` with 500ms hard timeout, returns ISO country or null on any failure mode (non-2xx, network, timeout, malformed). Selected via `IP_GEO_PROVIDER` env var (default `azure-maps`). Logger injected per L1 validated pattern. Returns null without making a request when `subscriptionKey` is null — acceptable during PR1 before AZURE_MAPS_KEY is provisioned.
- [x] `apps/api/src/services/ipGeo.test.ts` — NEW. 11 unit tests covering: success path, non-2xx, malformed body, malformed isoCode, network error, timeout (AbortError), disabled-by-null-key, empty-ip guard, NoopIpGeoProvider, factory env-var dispatch.
- [ ] ~~`apps/api/src/services/memberResolution.ts` — skeleton~~ — **dropped from PR1**. Skeleton stubs that throw "not implemented" violate FRAIM Constitution §IV ("No Placeholders: Never commit `TODO`, `FIXME`, or partial implementations"). PR2 creates this file when it has actual logic to ship.
- [ ] ~~`apps/api/src/services/consentResolver.ts` — skeleton~~ — **dropped from PR1** for the same reason.

### GDPR plumbing — DEFERRED to #264

**Discovery during phase-4 pattern scan (2026-05-04)**: the RFC's two GDPR rows assumed `apps/worker/src/jobs/erasure.ts` and `apps/api/src/services/dataExport.ts` existed. They don't — `architecture.md §10` was aspirational on those items. Soft-delete plumbing (`Member.erased`, `deletedAt`) is implemented, but neither the scheduled erasure job nor the data-export endpoint exists.

Re-scoping per user decision (option A): the GDPR plumbing is its own work, filed as **#264 — Build GDPR erasure job + Art. 15 data-export endpoint**. Honoring erasure on the new `Member.externalId` field added in PR1 is blocked on #264 landing first; for V0 (test customers only) this is acceptable.

L0 coaching moment captured: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-04T00-00-00-rfc-claimed-files-not-verified-against-codebase.md` — third occurrence of the *"asserted file/config contents without reading primary source"* family pattern.

PR1 still ships the column additions (`Member.externalId`, `Member.enrolledVia`, etc.); they will be honored by the erasure job once #264 ships.

### Secrets

- [ ] `AZURE_MAPS_KEY` to Azure Key Vault `customereq-kv` (per CLAUDE.md production-secrets policy). Bind on api container app via `secretRef:` env var. Migration script `scripts/migrate-secrets-to-keyvault.sh` is the canonical reference.

### PR1 validation

- [ ] `pnpm build` — green
- [ ] `pnpm typecheck` — green
- [ ] `pnpm lint` — green
- [ ] `pnpm test:smoke` — green (unit + targeted integration)
- [ ] `pnpm prisma migrate dev` — runs cleanly against Docker postgres
- [ ] Pre-migration collision script runs against fresh seed; reports zero collisions
- [ ] Existing demo flow (Maya enrolls) — manually verify no behavior change

---

## PR2: Behavior — detailed checklist

(Populated after PR1 lands; sketched here for reviewer completeness.)

### API endpoints

- [ ] `apps/api/src/routes/members/enroll.ts` — modified per RFC OpenAPI delta
- [ ] `apps/api/src/routes/surveys/respond.ts` — NEW
- [ ] `apps/api/src/schemas/EnrollMemberSchema.ts` — relax `consentGivenAt`, add `memberId` field

### Service implementations

- [ ] `apps/api/src/services/memberResolution.ts` — full `resolveOrEnrollMember` impl (idempotent upsert, identifier-shape validation per `Brand.memberIdentifierKind`, case-insensitive lookup, channel attribution)
- [ ] `apps/api/src/services/consentResolver.ts` — R16 hierarchy + R17 empty-string suppression

### Web

- [ ] `apps/web/src/app/(member)/enroll/page.tsx` — render `Brand.consentTextDefault` with privacy/terms links

### Tests

- [ ] 5 unit test files (per RFC Test Matrix)
- [ ] 5 integration test files
- [ ] 3 E2E test files

### Architecture-doc updates

- [ ] `docs/architecture/architecture.md`:
  - [ ] §6 Design Patterns: 3 new entries (synchronous-fork-of-event-driven for auto-enroll; brand-default-with-survey-override; server-detectable channel attribution)
  - [ ] §4 Member component: rewrite around polymorphic identifier
  - [ ] §5.1 Event Ingestion sequence diagram: fork annotation for survey-response auto-enroll
  - [ ] §5.3 Webhook Ingestion sequence diagram: replace `email + brandId` lookup with `externalId + brandId`

### PR2 validation

- [ ] All PR1 validation gates plus:
- [ ] Synthetic load test: 100 concurrent submits → p99 < 1s (hero #6 SLA)
- [ ] Manual browser validation of demo flow (Maya enrolls, then submits survey)
- [ ] Manual browser validation of embedded-survey-non-member flow

---

## Validation Requirements (R5 of FRAIM scoping skill)

| Mode | Required? | Why |
|---|---|---|
| `unitTesting` | Yes | P0 issue per project rule R9 |
| `integrationTesting` | Yes | Database + Redis required for auto-enroll race + responsePolicy enforcement |
| `e2eTesting` | Yes | P0 issue + UI changes (consent text rendering + embedded-survey flow) |
| `uiValidationRequired` | Yes (PR2 only) | `apps/web/src/app/(member)/enroll/page.tsx` consent text rendering — manual browser check at 375px / 768px / 1280px (responsive sanity) per the L1 preference for browser validation before submit |
| `mobileValidationRequired` | No | No mobile-specific surfaces; responsive browser check covers small viewports |
| `complianceValidationRequired` | Yes | GDPR erasure must zero `externalId`; data-export must include it |
| `migrationValidationRequired` | Yes | Pre-migration collision guard must run as CI gate |

UI Validation evidence file (PR2): `docs/evidence/231-ui-polish-validation.md`.

---

## Pattern Discovery (from this codebase)

- **Environment variables**: `process.env.X` pattern; secrets via Key Vault `secretRef` per CLAUDE.md production-secrets policy. New: `AZURE_MAPS_KEY`, `IP_GEO_PROVIDER`.
- **Service file location**: `apps/api/src/services/*.ts` for business logic above route handlers (existing examples: presumably already conventional).
- **Schema file**: `packages/database/prisma/schema.prisma` (single file).
- **Migrations**: `packages/database/prisma/migrations/{ts}_name/migration.sql` (Prisma's standard).
- **Test conventions**: Vitest unit (`apps/api/src/**/*.test.ts`), Vitest integration with real Postgres+Redis (`apps/api/test/integration/**/*.test.ts`), Playwright E2E (`apps/web/test/e2e/*.spec.ts`).
- **GDPR/CCPA**: erasure job at `apps/worker/src/jobs/erasure.ts`; data export at `apps/api/src/services/dataExport.ts`; per project_rules R13.
- **Multi-tenant rule**: every entity has `brandId`; never accept `brandId` from request body (project_rules R6).
- **BullMQ event flow**: API enqueues; worker processes (project_rules R5). Survey-respond's auto-enroll is the documented synchronous fork (RFC § Architecture Analysis gap #1).

---

## Open Questions / Deferrals

None at scoping time. Five major open questions (Q1-Q5) from the spec phase + the channel-attribution flip + the IP-geo provider pick + the audit-only `Member.location` decision are all resolved in the merged spec/RFC.

---

## Phase 1 (implement-scoping) status

**Awaiting user decision** on the PR-split recommendation before advancing to phase 2 (`implement-tests`). Phase 1 will be marked complete with `findings.issueType: "feature"` once the split is confirmed.
