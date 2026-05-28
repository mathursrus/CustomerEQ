# Issue #531 — Feature Implementation Feedback (Quality Check)

## Run summary

- `deep-code-quality-checks` on the diff for commits `84b8cbf..35b7f6c` plus the in-progress quality-phase delta.
- 1 quality issue found and **ADDRESSED**.
- 0 quality issues remaining unaddressed.

## Quality issues

### QC-1 — DRY violation: triple duplication of the 8-field member select shape · **ADDRESSED**

**Tag:** QUALITY CHECK FAILURE
**Severity:** Low (no functional impact; cleanliness)
**Status:** ADDRESSED

**Finding.** `apps/api/src/routes/distributionBatches.ts` contained two `select: { id, externalId, email, firstName, lastName, erased, consentGivenAt, unsubscribedSurveysAt }` blocks before this PR. My initial #531 implementation added a third instance for the new pre-resolved memberIds lookup. The `architecture-standards` rule mandates DRY ("Check for existing utilities, constants, or patterns before creating new ones"). Triple duplication is the threshold where extraction strictly pays for itself.

**Fix applied.** Extracted a top-of-file `const AUDIENCE_MEMBER_SELECT` (with `as const` for type narrowing) and replaced all three call sites:

- `resolveExistingMembers` random-sample fetch
- `resolveCustomList` pre-resolved memberIds fetch (the new #531 path)
- `resolveCustomList` paste-row externalId fetch

Tied a doc comment to the constant that pins the invariant: the select shape must stay in sync with `ResolvedAudienceMember`. Future audience-resolution paths inherit the same shape automatically.

**Verification.** `pnpm turbo run typecheck --filter @customerEQ/api` green. `pnpm --filter @customerEQ/api exec vitest run --config vitest.integration.config.ts test/integration/distributionBatches.test.ts` → 21/21 pass (unchanged).

## Other checks (all passing — no findings to record)

- **Hardcoded values:** No new URLs, API keys, magic numbers, or colors. The schema cap `memberIds.max(10_000)` matches the existing `PASTE_ENTRIES_CAP = 10_000` (intentional — same throughput envelope as the paste path). Not extracted to a shared constant because each one is the cap for a *different* input shape; conflating them would obscure intent.
- **Missed reusability:** None. The new resolution code uses existing Prisma client patterns and the existing `ResolvedAudienceMember` shape.
- **Quality standards compliance (architecture standards rule):**
  - Tenant scoping: ✅ `brandId` is in every `where` clause on the new path.
  - Multi-tenant invariant (project rule 6): ✅ `brandId` is never accepted from the request body — taken from `request.brandId` via the multiTenant plugin.
  - Single responsibility: `resolveCustomList` still does one thing — produce the resolved audience for a `mode: 'custom_list'` audience spec. The two resolution channels (memberIds + paste) are sub-operations of that one responsibility; not worth splitting.
- **Monolithic files:** `distributionBatches.ts` is ~1370 lines, larger than the 500-line guideline. This was the pre-existing state; this PR adds ~60 lines and removes ~25 (after the DRY refactor) for a net +35. Splitting the file is out of scope for a P0 bug fix (Rule 21 + Rule 26). The file's size is a known condition tracked implicitly by the codebase's age, not introduced by #531.
- **Complex logic:** No new nesting depth, no parameter-list growth (`preResolvedMemberIds` is the 6th parameter on `resolveCustomList`, exactly at the architecture-standards 6-parameter soft cap; default value `[]` keeps callers unchanged). Acceptable.
- **Architecture health:** No new imports. No new dependencies. No circular dependency introduced.

## Blocking condition status

- Quality issues `ADDRESSED`: 1 / 1.
- Quality issues `UNADDRESSED`: 0.
- **Phase passes.**
