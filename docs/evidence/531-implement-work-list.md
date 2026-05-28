# Issue #531 — Implementation Work List

**Issue type:** Bug (P0, production-blocking)
**Branch:** `feature/531-bug-p0-managed-email-send-fails-with-unprocessable-entity-when-recipient-is-a-registered-member`
**Worktree:** `C:\Github\mathursrus\CustomerEQ - Issue 531`

## 1. Problem (one-line)

Audience-builder's selected-row submission round-trips through a brand-identifier-kind-aware paste parser; when the brand's `memberIdentifierKind` and the member's `externalId` shape disagree, every selected row is silently dropped and the API throws `AUDIENCE_EMPTY` (HTTP 422). Web client surfaces this as bare "Send failed Unprocessable Entity".

Production evidence: `req-1x` on `customereq-api--0000263`, 2026-05-28 18:31:52 UTC, brand `cmp5ud2x2001xw7h2xhgfniru`, survey `cmp9xjc7l000gw8hcxxhrqvqv`.

## 2. Fix shape

Extend `CustomListAudience` so the audience-builder UI can pass **pre-resolved memberIds directly** alongside the existing free-text `identifiers` paste body. Server resolves memberIds by `Member.id` (bypassing the shape-inference parser); paste-body `identifiers` continue to flow through `parsePasteBody` for the genuine auto-enroll path.

Why this shape over alternatives:
- A new top-level audience mode (e.g. `member_ids`) would force the audience-builder to choose: "all resolved" OR "all auto-enroll typed", but the builder legitimately mixes both (search-result rows + typed-but-not-existing rows in the same submit). Splitting into two modes is wrong.
- An extension to `custom_list` is backward-compatible: existing callers (CSV upload, no-UI paste) don't supply `memberIds`; the audience-builder UI does. No version negotiation.
- Resolving by `Member.id` requires no schema migration, no new DB index — Postgres already has the PK.

## 3. Files to change (≤ 15 — single-PR sized)

### Backend

- [ ] `packages/shared/src/zod/distributionBatch.schema.ts` — extend `CustomListAudience` with optional `memberIds: z.array(z.string().cuid()).max(10_000)`.
- [ ] `packages/shared/src/zod/distributionBatch.schema.test.ts` — schema tests for the new field (accepts memberIds-only, identifiers-only, both, exceeds-cap rejection).
- [ ] `apps/api/src/routes/distributionBatches.ts` — `resolveCustomList` accepts `memberIds`, resolves them via `prisma.member.findMany({ where: { id: { in: memberIds }, brandId, erased: false, deletedAt: null }})`, merges into the result set (deduped against paste-parser matches by memberId).
- [ ] `apps/api/test/integration/distributionBatches.test.ts` — integration tests for the memberIds resolution path (the reproduction of #531).

### Frontend

- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/types.ts` — extend `AudienceBuilderState.submitAudience` with `memberIds: string[]`.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx` — split selectableRows into `memberIds` (rows with `memberId !== null`) and `identifiers` (rows with `memberId === null` + `willAutoEnroll`); populate `submitAudience` accordingly.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.test.tsx` — unit test asserting the split.
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` — verify the submit body forwards `submitAudience` unchanged (no logic change expected; verify pass-through).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` — same pass-through verification.

### Evidence

- [ ] `docs/evidence/531-feature-implementation-evidence.md` — implementation evidence doc, including manual UI repro of the original symptom and confirmation the fix lands the send.

**File count: 9** — within the 15-file ceiling. No phase-splitting required.

## 4. What stays the same (explicit non-changes)

- `parsePasteBody` / `parseCsvBody` / `inferIdentifierKind` — unchanged. The brand-kind shape inference is the correct semantics for genuine paste/CSV input; the bug was the audience-builder pretending UI selections were a paste.
- `AUDIENCE_EMPTY` 422 — unchanged. Still fires when the union of memberIds + parsed identifiers resolves to zero members. The UI just stops triggering it spuriously.
- `existing_members` audience mode — unchanged (the random-sample / percent path).
- `Brand.memberIdentifierKind` semantics — unchanged. No data audit, no migration.
- `composer`, sender-domain resolution, suppression gate, worker dispatch — unchanged.
- `Fastify default error formatter`'s bare-"Unprocessable Entity" surface — left alone here. Tracked separately as chore #529; landing it would have made the symptom legible but would not have prevented the failed send.

## 5. Validation plan

### Automated

- `pnpm test:smoke` — unit + schema tests pass.
- `pnpm test:integration` — distributionBatches integration tests, including the new memberIds-path tests.
- `pnpm build` — typecheck + lint pass across all apps.

### Manual (UI required — required per project rule, also per FRAIM `implement-validate`)

- `uiValidationRequired: true`
- Target journey: log in as a FRAIM-brand admin → open `https://customereq.wellnessatwork.me/admin/surveys/cmp9xjc7l000gw8hcxxhrqvqv/distribute?mode=managed-email` (or local equivalent on the feature branch) → search for the same member used in the prod repro → select → fill composer → Send.
- Pre-fix behavior (recorded already from production logs): 422 `AUDIENCE_EMPTY`, web surface "Send failed Unprocessable Entity".
- Post-fix expected: 201 batch created, recipientCount=1, send-progress poll shows sent (or skipped reason if member's suppression status changed since the prod incident).
- Browser baseline: Chrome/Chromium (current dev), single breakpoint (admin web).

### Mobile

- `mobileValidationRequired: false` — admin-only flow, no mobile surface.

## 6. Out of scope (deferred / cross-referenced)

- Fastify `setErrorHandler` normalization → chore **#529**. Not bundled per Rule 21 / Rule 26 (separate acceptance criteria; one PR per issue).
- Brand identifier-kind audit / repair of mismatched data → not needed for this fix; the contract change makes shape inference irrelevant to UI-resolved rows.

## 7. Risks

- **Risk:** Auto-enroll path regression. The audience-builder may now send an empty `identifiers` string for purely-UI-resolved audiences. `parsePasteBody('')` returns `{rows:[], unmatched:[]}` — no auto-enroll attempted, no false matches. Verified safe.
- **Risk:** Dedup edge case where a memberId is also present as an identifier in the paste body (e.g. operator selected a search-result row and also typed its email). The server should dedup so we don't mint two tokens for the same member. Added dedup-by-memberId in resolveCustomList.
- **Risk:** Schema `.strict()` on `PreviewBatchRequestSchema` would reject `memberIds` if missed. The change is to `CustomListAudience` (inside the discriminated union), which is not `.strict()` — verified in `distributionBatch.schema.ts:29-36`.

## 8. Test traceability

| # | Repro / behavior | Layer | File |
|---|---|---|---|
| T1 | Schema accepts `custom_list` with `memberIds` only | Unit | `packages/shared/src/zod/distributionBatch.schema.test.ts` |
| T2 | Schema accepts `custom_list` with both `identifiers` and `memberIds` | Unit | same |
| T3 | Schema rejects `memberIds` longer than 10k entries | Unit | same |
| T4 | `resolveCustomList` resolves passed memberIds by `Member.id` (brandId-scoped, not-erased, not-deleted) | Integration | `apps/api/test/integration/distributionBatches.test.ts` |
| T5 | Empty `identifiers` + non-empty `memberIds` succeeds (the production repro) | Integration | same |
| T6 | Mixed `identifiers` + `memberIds` dedups by memberId | Integration | same |
| T7 | `memberIds` referencing another brand's member → ignored (returns AUDIENCE_EMPTY if alone) | Integration | same |
| T8 | AudienceBuilder splits selectable rows into memberIds + identifiers correctly | Unit | `apps/web/.../audience-builder/AudienceBuilder.test.tsx` |
| T9 | End-to-end manual: Send to single registered member succeeds | Manual | UI repro, evidence doc |
