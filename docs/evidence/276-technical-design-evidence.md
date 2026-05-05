# Issue #276 — Technical Design Evidence

**Issue**: [#276 — \[P0\] Production hotfix: survey-level consent override + migrate existing surveys to IMPLIED_ON_SUBMIT](https://github.com/mathursrus/CustomerEQ/issues/276)
**Workflow**: technical-design (FRAIM)
**Branch**: `feature/276-p0-production-hotfix-survey-level-consent-override-migrate-existing-surveys-to-implied-on-submit`

## Summary

RFC for the data + backend + migration scope. Round 2 narrowed the scope further (per round-1 review): the PATCH endpoint contract, audit-plugin extension, and attestation guard moved to **#241** so they ship as one end-to-end vertical slice with the survey-editor UX.

#276 now ships only:
- **Schema**: two nullable Prisma column adds (`Survey.consentMode: ConsentMode?`, `Survey.consentReason: String? @db.VarChar(500)`)
- **Resolver**: one field add to `SurveyConsentInput` + three string substitutions in `consentResolver.ts`
- **Migrations**: two timestamped files (idempotent schema add + idempotent data backfill)

Confidence 95/100 (up from 92 — smaller surface, less uncertainty). No spike. Round-1 design decisions all answered in PR #282.

## Work Completed

| File | Type | Purpose |
|---|---|---|
| `docs/rfcs/276-survey-level-consent-override.md` | new | RFC: schema/migration/resolver/PATCH/audit/observability + Architecture Analysis (3-bucket) + 4 reviewer decisions |
| `docs/evidence/276-technical-design-evidence.md` | new (this file) | Phase evidence + traceability matrix + arch-gap inventory |

### Approach

1. **requirements-analysis** loaded the spec (post-round-1), the architecture.md design-patterns + compliance sections, and the actual `consentResolver.ts` (~100 lines). Confirmed the override is a single field add to `SurveyConsentInput` plus three string substitutions; confirmed `BrandConsentInput.consentMode` is the field that drives `requiresExplicitConsent` today. Surfaced three known tech risks: migration idempotency (#270/#281 patterns), PATCH atomicity, audit-payload completeness.
2. **design-authoring** spike-decision: no spike. RFC drafted using the TECHSPEC template + the #231 retro convention of an Architecture Analysis 3-bucket section. Decisions for the reviewer surfaced as a numbered table at the end (per L1 "Decision-points-at-PR-body-bottom" pattern).
3. **architecture-gap-review** classified patterns into the three buckets; two gaps in "Missing from Architecture" are carry-overs from the #231 retro queue (brand-default-with-survey-override pattern; attestation-columns unified shape). No "Incorrectly Followed" gaps.
4. **design-completeness-review** (this phase) verifies traceability and records gaps for reviewer surfacing.

## Traceability Matrix

| Spec Requirement | RFC Section / Data Model / Component | Status |
|---|---|---|
| **R1** — `Survey.consentMode: ConsentMode?` (nullable; null = inherit) AND `Survey.consentReason: String?` (justification text) | RFC §"Schema changes" (two nullable column adds on Survey model). Idempotency in §"Schema migration" via `ADD COLUMN IF NOT EXISTS`. | Met |
| **R2** — Resolver resolves effective mode as `survey.consentMode ?? brand.consentMode` and uses it for `requiresExplicitConsent` | RFC §"Resolver change" — `SurveyConsentInput` field add + three branch substitutions in `consentResolver.ts` (existing branches at lines 71, 82, 96). Test plan covers 4 cases. | Met |
| **R3** — Survey-response endpoint honors the resolved mode end-to-end | RFC §"Resolver change" — endpoint already calls the resolver; the resolver change is sufficient. Test plan §"Validation Plan" rows 5+6 cover both directions. | Met |
| **R4** — Embedded form widget continues to function unchanged | RFC §"UI changes" — explicitly notes no widget change required because the resolver-side change is sufficient. Smoke test in §"Validation Plan" row 9. | Met |
| **R5** — Setting more permissive than brand requires BOTH attestation AND non-empty reason; missing returns 422 | **DEFERRED to #241** per round-1 scope re-cut. The schema columns + 500-char cap that #241's PATCH validation will bind to are defined in this RFC's §"Schema changes". | Deferred |
| **R6** — Setting same/stricter clears all four audit columns to NULL | **DEFERRED to #241** (same scope re-cut as R5). | Deferred |
| **R7** — One-shot idempotent data migration sets every NULL row across all orgs to IMPLIED_ON_SUBMIT with `__migration_276__` attribution and a system reason text | RFC §"Data migration" — separate timestamped migration file. `WHERE consentMode IS NULL` for idempotency. Reason text + attribution per spec; fits within the 500-char column cap (191 chars). CI gate from #270 catches non-idempotency. | Met |
| **R8** — Audit log captures attesting user, timestamp, AND reason; queryable months later | **DEFERRED to #241** per round-1 scope re-cut. The data migration (R7) writes the same columns but does not go through the audit plugin — `__migration_276__` in the column itself is the audit signal for migrated rows. | Deferred |
| **R9** — Migration follows #270/#281 idempotency norms; no unguarded DDL | RFC §"Schema migration" — `ADD COLUMN IF NOT EXISTS` for both columns. Risk row #1 in §"Risks & Mitigations" calls this out explicitly. CI gate is the regression catcher. | Met |

**Pass/fail**: 6 requirements **Met** (R1, R2, R3, R4, R7, R9), 3 **Deferred** to #241 (R5, R6, R8) per the round-1 scope re-cut. No `Unmet` rows. The deferral is intentional and binding: #241's PATCH endpoint design must satisfy R5/R6 and #241's audit-plugin extension must satisfy R8.

## Architecture Gap Documentation

Captured in RFC §"Architecture Analysis" with the standard 3-bucket structure. Summary for the reviewer's quick scan:

### Patterns Correctly Followed (4)
- Multi-Tenant Isolation (architecture.md §6) — PATCH preserves brandId-scoped lookup
- GDPR/CCPA by Default (architecture.md §6) — attestation columns + reason strengthen consent
- Centralized Test Infrastructure (architecture.md §6) — all new tests use `@customerEQ/config/test-utils`
- Idempotency (architecture.md §6) — schema migration uses `IF NOT EXISTS`; data migration uses `WHERE consentMode IS NULL`

### Patterns Missing from Architecture (2 — carry-overs from #231 retro queue)
- **Brand-default-with-survey-override storage hierarchy.** Implicit since #231 PR1 (`Brand.consentTextDefault` + `Survey.consentTextOverride`); #276 extends for `consentMode`. Should be a named pattern in architecture.md §6. Was already on the #231 implementation PR's address-feedback list per the #231 retro; appears not yet landed. **Reviewer decision needed**: roll the architecture.md update into #276's implementation PR (one fewer carryover) OR leave it on #231's queue.
- **Attestation columns as a unified audit-shape.** `consentSuppressedAttestedBy/At` (and now `consentReason`) serves both R17 suppression (#231) and override (#276). Worth a one-paragraph note in architecture.md §6 documenting the shared shape so a future reader understands the column purpose isn't tied to the original "suppression" naming. **Reviewer decision needed**: same as above.

### Patterns Incorrectly Followed
None.

## Reviewer Decisions Surfaced

The RFC ends with 4 numbered decisions. None block the design from being shippable; each has a recommended + alternative.

1. **Migration split** — 2 files (recommended) vs 1 combined.
2. **Audit-plugin extension shape** — Option A per-route metadata allowlist (recommended) vs Option B inline call.
3. **`consentReason` max length** — 2000 chars (recommended) vs 500 vs unbounded.
4. **Resolver source label** — don't add `consentModeSource` (recommended) vs add for symmetry with text source.

## Phase Completion

| Phase | Status | Artifact |
|---|---|---|
| requirements-analysis | ✅ | seekMentoring evidence; spec + arch + resolver + PATCH route loaded |
| design-authoring | ✅ | `docs/rfcs/276-survey-level-consent-override.md`; `phase:design` label applied |
| technical-spike | ⏭️ | Not needed — all surfaces low-uncertainty per phase 1 analysis |
| architecture-gap-review | ✅ | RFC §"Architecture Analysis" with 3-bucket classification |
| design-completeness-review | ✅ | This evidence doc; traceability matrix all-Met |
| design-submission | ⏳ | Next: commit + push + PR comment |
| address-feedback | (after submission) | — |
| retrospective | (after feedback closed) | — |
