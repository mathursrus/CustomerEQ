# Feature: Social Review Ingestion and External Signal Hub
Issue: #113  
Feature Spec: `docs/feature-specs/113-social-review-ingestion.md`  
PR: https://github.com/mathursrus/CustomerEQ/pull/114

## Summary

- Issue: `#113` — Ingest reviews from social channels
- Workflow type: technical design
- Work completed: authored the RFC, completed architecture-gap review, completed design-vs-spec traceability review, and packaged design evidence for human review
- Branch: `feature/issue-113-social-review-ingestion-spec`

## Work Completed

- Created `docs/rfcs/113-social-review-ingestion.md`
- Created `docs/evidence/113-design-evidence.md`
- Created `docs/evidence/113-technical-design-evidence.md`
- Extended the RFC to cover:
  - additive Prisma models for `ExternalSignalSource` and `ExternalSignal`
  - new admin source-registry routes
  - new sync and ingestion queues/workers
  - Customer 360 `externalSignals`
  - CX analytics external-signal feed
  - source health import counts
  - provider status history preservation
  - architecture-gap analysis

## Completeness Evidence

- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All files committed/synced to branch: Yes

| PR Comment | How Addressed |
|---|---|
| Review thread correction on PR `#114` | Design deliverables were moved onto the existing review thread so the RFC and evidence are visible where the user expected them |

### Traceability Matrix

| Requirement/User Story (from Original Issue/Spec) | RFC Section/Data Model (where it is addressed in the technical design) | Status (Met/Unmet) | Validation Plan Alignment (How will this be verified?) |
|---|---|---|---|
| Issue body: configure social/review channels and make them available alongside surveys for full 360 | UX Flow 1-3; Section 3 `ExternalSignalSource` + `ExternalSignal`; Section 5.3; Section 5.4 | Met | API integration test for source creation + analytics exposure + Customer 360 enrichment |
| UX Flow 4: normalized signals available for downstream clustering, alerting, campaign triggers, and health | Section 6.3; Section 6.4 pipeline; Section 10 and Section 12 | Met | Worker integration test confirms ingested signals persist in the shared signal layer and are available for downstream processors |
| R1: multiple external signal sources per brand | Section 3 `ExternalSignalSource`; Section 5.1 admin source routes | Met | API integration test: create two Google sources and one Reddit source under one `brandId` |
| R2: source configuration captures type, connection method, scope, sync mode, filters, enabled status | Section 3 `ExternalSignalSource`; Section 4 shared schemas; Section 5.1 | Met | API integration test: create source; schema validation rejects missing required fields |
| R3: represent Google, LinkedIn owned comments/mentions, Reddit, and X/Twitter through native or generic connector | Section 1 delivery scope; Section 7 provider strategy; `ExternalSourceType` enum | Met | API integration test: create supported source types; provider adapter tests for Google/native and generic webhook/API fallbacks |
| R4: normalize every ingested item into one common external signal record | Section 3 `ExternalSignal`; Section 6.4 processing pipeline | Met | Integration test: Google review and generic webhook comment land in one normalized store |
| R5: deduplicate by source and provider-native ID | Section 3 `@@unique([sourceId, externalId])`; Section 6.4 dedupe step | Met | Integration test: deliver duplicate payload twice, assert one row |
| R6: store unresolved public content at brand scope and optional product/member association | Section 3 `memberId?`, `subjectType`, `subjectKey`, `subjectLabel`; Section 8 matching | Met | Integration test: unmatched Reddit thread persists with brand/product scope and no member association |
| R7: expose normalized external signals in CX analytics alongside surveys | Section 5.4 analytics route extension; Section 10.2 CX analytics UI | Met | API integration test + browser validation for combined operator workspace filters |
| R8: include matched external signals in Customer 360 | Section 4 `Customer360Response.externalSignals`; Section 5.3; Section 10.3 | Met | Integration test: `GET /v1/members/:id/360` returns matched signals only |
| R9: source health shows last sync, last successful import, and last error | Section 3 `lastSyncAt`, `lastSuccessAt`, `lastImportCount`, `lastError`; Section 10.1; Section 11 | Met | API integration test: failing sync updates health state; browser validation shows degraded card |
| R10: preserve canonical link to original review/social content | Section 3 `canonicalUrl`; Section 10.2 and Section 10.3 | Met | Integration test: stored signal returns canonical URL; browser validation verifies operator CTA renders |
| R11: enqueue normalization and enrichment through queue layer | Section 6 queue and worker changes; Section 6.4 pipeline | Met | Worker/API integration test: webhook and poll routes enqueue jobs rather than mutating state inline |
| R12: preview test before source activation | Section 5.1 `POST /admin/external-signal-sources/:id/test`; test returns sample normalized records | Met | API integration test: test endpoint returns preview without setting `enabled = true` |
| R13: all source configs and signals carry `brandId` | Section 3 both models include `brandId`; Section 9.2 tenant isolation | Met | Compliance validation: stored rows always scoped by `brandId` |
| R14: store provider-native identifiers and raw payloads for audit/replay | Section 3 `externalId`, `rawPayload`, `providerMetadata`; Section 11 traceability/failure modes | Met | Integration test: replay/audit inspection can read provider ID and raw payload |
| R15: member matching is optional and confidence-based | Section 3 `matchStatus`, `matchConfidence`, `matchMethod`; Section 8 matching rules | Met | Integration test: low-confidence handle remains unmatched |
| R16: store immutable ingestion timestamp and separate posted timestamp | Section 3 `postedAt` and `ingestedAt` | Met | Integration test: imported record contains both timestamps |
| R17: preserve status change history such as edited, hidden, deleted | Section 3 `providerStatus` and `statusHistory`; Section 6.3 re-ingest behavior; Section 11 provider lifecycle handling | Met | Worker integration test: second sync updates status and appends status-history entry |
| R18: support near-real-time Google review ingestion when notifications are configured | Section 7.1 Google Business Profile strategy | Met | Worker integration test: notification-driven ingest path targets minutes-level processing |
| R19: extensible registry without new UX model for each provider | Section 1 architecture choice; Section 3 enums/models; Section 7 generic connector strategy | Met | Unit/integration test: add generic API source without changing admin UX contract |
| R20: fail loudly with provider-specific diagnostics | Section 11 failure modes and timeouts; Section 12 observability | Met | Integration test: invalid auth and rate limit surface actionable source-level error state |
| Validation plan alignment: source creation, testing, import, dedupe, health, and 360 support in design | RFC Validation Plan; Sections 5, 6, 10, 11, 12 | Met | Covered by unit, integration, and browser validation rows above |
| Compliance validation alignment: unmatched content, `brandId` scoping, erasure behavior, metadata minimization | Section 8; Section 9; Section 11 | Met | Compliance validation scenarios are directly supported by the proposed model and route behavior |

Pass/Fail Determination: Pass. No `Unmet` rows remain after adding explicit `lastImportCount` and `statusHistory` coverage to the RFC.

## Feedback History

- No technical-design feedback file exists yet for issue `#113`.

## Due Diligence Evidence

- Reviewed feature spec in detail (if feature spec present): Yes
- Reviewed code base in detail to understand and repro the issue: Yes
- Included detailed design, validation plan, test strategy in doc: Yes

## Prototype & Validation Evidence

- [ ] Built simple proof-of-concept that works end-to-end
- [ ] Manually tested complete user flow (browser/curl)
- [ ] Verified solution actually works before designing architecture
- [x] Identified minimal viable implementation
- [x] Documented what works vs. what's overengineered

## Validation

- Validated RFC completeness against the functional spec and original issue body using an explicit traceability matrix
- Validated architecture alignment against `docs/architecture/architecture.md`
- Validation result: pass for design completeness, with architecture documentation gaps recorded for PR review
- No code execution or proof-of-concept was run in this design workflow; this phase produced design artifacts only

## Quality Checks

- Deliverables complete: Yes
- Documentation clear and professional: Yes
- Work ready for review: Yes

## Architectural Gaps For Review

- The architecture document does not yet describe the new `ExternalSignalSource` registry and `ExternalSignal` normalized store.
- The worker inventory does not yet include `external-signal-sync` and `external-signal-ingestion`.
- The architecture doc does not yet mention Customer 360 external-signal collections or the external-signal CX analytics feed.
- These are documentation gaps for PR review, not blockers to the technical design itself.

## Phase Completion

- Requirements-analysis: complete
- Design-authoring: complete
- Architecture-gap-review: complete
- Design-completeness-review: complete
- Challenges: the initial RFC needed more explicit coverage for source health import counts and provider status-history retention; both were added before review submission

## Continuous Learning

| Learning | Agent Rule Updates (what agent rule file was updated to ensure the learning is durable) |
|---|---|
| Technical design for external integrations should explicitly align secret references with the repo’s Azure Key Vault pattern, not generic secret wording | None in this phase |
| Traceability reviews catch real design omissions faster when source health and record lifecycle history are modeled explicitly | None in this phase |
