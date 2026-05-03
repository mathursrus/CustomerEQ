# Feedback for Issue #231 — technical-design Workflow

## Round 1 Feedback
*Received: 2026-05-03 (PR #259 inline review on RFC commit `d143b99`)*

### Summary

12 inline review comments on `docs/rfcs/231-survey-response-data-model-rework.md`. Two real corrections + 7 "Agreed" acknowledgments on the architecture-gap section.

**Corrective findings**:
1. **Channel-attribution naming flipped** (4 comments — lines 107, 125, 127, 283): user pointed out four times that `SURVEY_RESPONSE` and `EMBEDDED_FORM` are inverted. Names should describe the *channel*: `EMBEDDED_FORM` = host-application embedded survey (host SDK supplies identity via URL param) → URL query attribution; `SURVEY_RESPONSE` = standalone survey link/email (responder self-identifies on the form) → body attribution. Captured as L0 coaching moment `manohar.madhira@outlook.com-2026-05-03T20-30-00-channel-attribution-named-by-channel-not-trust.md`.
2. **Auto-enroll conflated with `responsePolicy`** (1 comment — line 246): the RFC's failure-modes table row read "`responsePolicy = ONCE` and a prior response exists | 409 ... endpoint does not auto-enroll a new member if the resolved member already has a response on this survey." User flagged: *"Why is this only on responsePolicy = ONCE? Member should not need to be auto-rolled if they already exist on Brand+Program. ResponsePolicy plays no role in auto-enroll process."* Auto-enrollment is decided purely by member existence (`(brandId, externalId)` resolution); `responsePolicy` is enforced afterward, on the response insert. Two orthogonal decisions; the RFC row conflated them.

**Agreed acknowledgments** (7 comments — lines 368, 370, 372, 374, 376, 382, 384): the 5 "Patterns Missing from Architecture" candidates and 2 of the 3 "Patterns Incorrectly Followed" stale-after-#231 architecture.md updates. No RFC change — these are tracked as architecture.md updates that land in the implementation PR.

### Comment 1 — ADDRESSED in this round
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 107 (channel attribution rule)
- **Comment**: "Is this logic flipped or correct? Why would host knew the responder goto SURVEY_RESPONSE?"
- **Action**: Swap detection→enum mapping. URL query → `EMBEDDED_FORM`. Form body → `SURVEY_RESPONSE`.

### Comment 2 — ADDRESSED in this round
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 125 ("What this rule is NOT" — iframe example)
- **Comment**: "Same question about logic flip. member_id via URL query would mean embedded, correct?"
- **Action**: Rewrite the iframe example to reflect the corrected mapping.

### Comment 3 — ADDRESSED in this round
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 127 (Future hardening — signed URL params)
- **Comment**: "again if customer knew the identity it would be embedded form not survey_response"
- **Action**: Update the future-hardening paragraph: signed `member_id` query param verifies and tags `enrolledVia = EMBEDDED_FORM` (not `SURVEY_RESPONSE`) with a separate `memberIdentitySignedBy` field.

### Comment 4 — ADDRESSED in this round
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 246 (Failure modes table)
- **Comment**: "Why is this only on responsePolicy = ONCE? Member should not need to be auto-rolled if they already exist on Brand+Program. ResponsePolicy plays no role in auto-enroll process."
- **Action**: Rewrite the row to separate auto-enroll resolution from `responsePolicy` enforcement. Auto-enroll = "member exists by `(brandId, externalId)`?" — independent of `responsePolicy`. The 409 row is purely about `responsePolicy = ONCE` enforcement on an *already-resolved* member, regardless of whether that resolution required auto-enroll. Add a separate explicit row clarifying "member already exists → no auto-enroll, regardless of `responsePolicy`."

### Comment 5 — ADDRESSED in this round
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 283 (Validation Plan table — Embedded survey URL-param row)
- **Comment**: "Consistently SURVEY_RESPONSE and EMBEDDED_FORM seem to be flipped"
- **Action**: Swap the expected `enrolledVia` values in the two adjacent Validation Plan rows. URL-param row → `EMBEDDED_FORM`. Form-input row → `SURVEY_RESPONSE`. Mirror the same fix in the spec's Validation Plan and in any other place that names a specific enrolledVia value bound to a detection path.

### Comment 6 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 368 (Architecture gap #1 — Synchronous-fork-of-event-driven-default)
- **Comment**: "Agreed."
- **Status**: Tracked for `docs/architecture/architecture.md` §6 update during the implementation PR.

### Comment 7 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 370 (Architecture gap #2 — Polymorphic identifier with brand-level identifier kind)
- **Comment**: "Agreed"
- **Status**: Tracked for architecture.md §4 Member component update during the implementation PR.

### Comment 8 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 372 (Architecture gap #3 — Brand-default-with-survey-override pattern)
- **Comment**: "Agreed."
- **Status**: Tracked for architecture.md §6 Design Patterns update during the implementation PR.

### Comment 9 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 374 (Architecture gap #4 — Audit log via dedicated row on the source entity)
- **Comment**: "Agreed"
- **Status**: Tracked for architecture.md §6 Design Patterns update during the implementation PR.

### Comment 10 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 376 (Architecture gap #5 — Server-detectable channel attribution rule)
- **Comment**: "Agreed"
- **Status**: Tracked for architecture.md §6 Design Patterns update during the implementation PR.

### Comment 11 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 382 (Stale-architecture #1 — §5.3 Webhook Ingestion sequence diagram)
- **Comment**: "Agreed"
- **Status**: Tracked for architecture.md §5.3 sequence-diagram update during the implementation PR (lookup-by-externalId not email).

### Comment 12 — ACKNOWLEDGED (no RFC change)
- **File**: `docs/rfcs/231-survey-response-data-model-rework.md`
- **Line**: 384 (Stale-architecture #2 — §5.1 Event Ingestion sequence diagram)
- **Comment**: "Agreed"
- **Status**: Tracked for architecture.md §5.1 sequence-diagram update during the implementation PR (auto-enroll fork annotation for survey-response events).

---

## Round 1 Resolution Plan

**Direct RFC edits** (one commit):
- (Comments 1, 2, 3, 5) Swap detection→enum mapping in RFC § Channel attribution: URL query = `EMBEDDED_FORM`, body = `SURVEY_RESPONSE`.
- (Comment 5) Swap the two enrolledVia values in the spec's Validation Plan rows + the RFC's Validation Plan rows.
- (Comment 4) Rewrite RFC failure-modes table to separate auto-enroll resolution from `responsePolicy` enforcement; add a clarifying row.

**Cross-doc consistency check**: grep for every occurrence of `SURVEY_RESPONSE` and `EMBEDDED_FORM` in the spec + RFC + mock + evidence, and reverse the binding wherever it's tied to a specific detection path. Verify the spec's R10 ("Auto-enrollment via survey response SHALL set... `enrolledVia = SURVEY_RESPONSE`") still makes sense — it does, since the responder filling out a standalone survey link IS the SURVEY_RESPONSE channel.

**No new L1 patterns from comments 6-12** — they're confirmations of architecture.md gaps already enumerated in the RFC's Architecture Analysis section. They will land as architecture.md commits in the implementation PR.
