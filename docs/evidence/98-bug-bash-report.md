# Bug Bash Report — Issue #98: CRM Core (Customer 360 API, Search, KYC Synthesis)

**Date**: 2026-04-03
**Tester**: Claude (claude-opus-4-6)
**Method**: Code-level exploratory testing (backend-only issue, no UI surface)

## Summary

Found **5 bugs**: 1 P0 (Critical), 2 P1 (High), 2 P2 (Medium).

## Security Assessment

| Category | Status | Notes |
|---|---|---|
| SQL Injection | PASS | Prisma parameterizes all queries; Zod validates all inputs |
| Auth Checks | PASS | All new endpoints use `request.brandId` from JWT-verified auth plugin |
| Tenant Isolation | PASS | brandId filter on every query; integration tests verify cross-brand 404 |
| OWASP Top 10 | PASS | No injection, broken auth, or SSRF risks found |
| Data Leaks | WARNING | GET /v1/members/:id leaks internal fields (BUG-5) |
| GDPR/CCPA | WARNING | Erased members not PII-masked on GET /v1/members/:id (BUG-5) |

---

## BUG-1: MCP enroll_member tool missing `consentGiven: true` [P0 - Critical]

**Category**: Functionality
**File**: `apps/mcp-server/src/tools/members.ts`, line 20
**Impact**: Every MCP enrollment call fails with 422 CONSENT_REQUIRED

### Description
The `enroll_member` MCP tool constructs the request body with `consentGivenAt` and `consentVersion` but does NOT include `consentGiven: true`. The `EnrollMemberSchema` requires `consentGiven` as `z.literal(true)`. This means every enrollment attempt through the MCP server silently fails.

### Steps to Reproduce
1. Call the `enroll_member` MCP tool with valid parameters
2. The tool sends: `{ ...params, consentGivenAt: new Date().toISOString(), consentVersion: '1.0' }`
3. The API validates with `EnrollMemberSchema.safeParse(request.body)` which requires `consentGiven: true`
4. Returns 422 CONSENT_REQUIRED

### Expected
Enrollment succeeds with 201.

### Actual
Returns 422 CONSENT_REQUIRED because `consentGiven` field is missing from the body.

### Fix
Add `consentGiven: true` to the request body in the MCP tool.

---

## BUG-2: totalPointsRedeemed uses page data instead of DB aggregate [P1 - High]

**Category**: Data Accuracy
**File**: `apps/api/src/routes/members.ts`, lines 331-333
**Impact**: Incorrect stats for members with more redemptions than the page limit

### Description
```typescript
const totalPointsRedeemed = redemptions
  .slice(0, redemptionsLimit)
  .reduce((sum, r) => sum + r.pointsSpent, 0)
```
This sums `pointsSpent` only from the first page of results. If a member has 50 redemptions but `redemptionsLimit` is 10, only the first 10 are summed. Should use a Prisma aggregate query like `totalPointsEarned` already does.

### Fix
Add a `_sum: { pointsSpent: true }` aggregate query to the Promise.all block, similar to the existing `loyaltyEvent.aggregate` for `totalPointsEarned`.

---

## BUG-3: averageSentiment computed from page, not all data [P1 - High]

**Category**: Data Accuracy
**File**: `apps/api/src/routes/members.ts`, lines 334-336
**Impact**: Inaccurate average sentiment for members with many survey responses

### Description
```typescript
const avgSentiment = surveyCount > 0
  ? surveys.slice(0, surveysLimit).reduce((sum, s) => sum + (s.sentiment ?? 0), 0)
    / Math.min(surveys.length, surveysLimit)
  : null
```
Issues:
1. Only averages sentiment from the current page of surveys, not all surveys
2. Treats null sentiments as 0 in the numerator but counts them in the denominator
3. The `stats` aggregate block already exists but doesn't include sentiment aggregation

### Fix
Add a sentiment average aggregation to the Promise.all block using a raw query or Prisma aggregate, or at minimum filter nulls from both numerator and denominator.

---

## BUG-4: responseTimeMs log metric is always ~0 [P2 - Medium]

**Category**: Observability
**File**: `apps/api/src/routes/members.ts`, lines 547-556
**Impact**: Search performance monitoring is broken

### Description
```typescript
const responseTimeStart = Date.now()  // Set AFTER queries complete
fastify.log.info({
  responseTimeMs: Date.now() - responseTimeStart,  // Always ~0
}, 'member.search.executed')
```
The timer starts after the database queries have already completed, so `responseTimeMs` is always near 0.

### Fix
Move `responseTimeStart` to before the `Promise.all` call.

---

## BUG-5: GET /v1/members/:id leaks internal fields and missing PII masking [P2 - Medium]

**Category**: Security / GDPR Compliance
**File**: `apps/api/src/routes/members.ts`, lines 204-218
**Impact**: Internal fields exposed; erased member PII not masked

### Description
The pre-existing `GET /v1/members/:id` endpoint (line 217) does `return reply.status(200).send(member)` which sends the raw Prisma object. This exposes:
- `brandId` (internal identifier)
- `clerkUserId` (auth provider ID)
- `createdAt`, `updatedAt`, `deletedAt` (timestamps)
- `erased` (internal flag)

Additionally, unlike the new 360 and search endpoints which properly mask PII for erased members, this endpoint returns raw PII even for erased members.

**Note**: This is a pre-existing issue not introduced by Issue #98, but the new endpoints correctly handle this, making the inconsistency more visible.

### Fix
Add a `select` clause to limit returned fields, and add PII masking for erased members consistent with the 360 endpoint pattern.

---

## Priority Matrix

| Bug | Severity | Effort | Action |
|---|---|---|---|
| BUG-1 | P0 Critical | Quick fix (1 line) | **Fix immediately** |
| BUG-2 | P1 High | Quick fix (add aggregate) | **Fix immediately** |
| BUG-3 | P1 High | Quick fix (add aggregate) | **Fix immediately** |
| BUG-4 | P2 Medium | Quick fix (move 1 line) | Fix now |
| BUG-5 | P2 Medium | Medium (select + mask) | Schedule (pre-existing) |
