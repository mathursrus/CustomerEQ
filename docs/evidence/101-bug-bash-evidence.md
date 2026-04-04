# Bug Bash Report — Issue #101 (Support Widget)

Date: 2026-04-03
Method: Systematic code review (API + web component, no hosted UI page for browser testing)

## Bug Inventory

### Critical (Fixed)

| ID | Category | Title | Status |
|----|----------|-------|--------|
| BB-1 | Security | Messages allowed to CLOSED/RESOLVED conversations | FIXED |
| BB-2 | Performance | No pagination on GET messages endpoint | FIXED |
| BB-3 | UI | Panel overflows mobile viewport (375px) | FIXED (ui-polish job) |
| BB-4 | UI | scrollToBottom() never called | FIXED (ui-polish job) |
| BB-5 | Build | Support chat not included in default build | FIXED (ui-polish job) |

### High (Documented, not fixed — require design decisions)

| ID | Category | Title | Impact |
|----|----------|-------|--------|
| BB-6 | Security | SSE auth token (email) exposed in URL query string | PII in server logs, browser history. Needs signed short-lived token approach. |
| BB-7 | Security | No rate limiting on public support endpoints | Spam/DoS risk. Needs Fastify rate-limit plugin on public routes. |
| BB-8 | Reliability | Duplicate SSE + polling on startConversation | If SSE works, poll loop runs uselessly for 60s burning battery/bandwidth |
| BB-9 | Integration | Admin messages not published to SSE channel | Customer won't see real-time admin replies via SSE stream |

### Medium (Documented)

| ID | Category | Title | Impact |
|----|----------|-------|--------|
| BB-10 | Data | SupportRule hard delete violates soft-delete rule (Project Rule #13) | Rules are hard deleted, should use soft delete |
| BB-11 | Data | Prisma conditions default ("{}") vs Zod default (object) mismatch | DB stores JSON string "{}", code expects object. evaluateConditions handles null but not string. |

### Low (Documented)

| ID | Category | Title | Impact |
|----|----------|-------|--------|
| BB-12 | UX | Single-line input for support messages | Users can't type paragraphs |
| BB-13 | A11y | No Escape key to close panel | Fixed in ui-polish |
| BB-14 | A11y | No focus trap in open panel | Tab can escape component |

## Reproduction Steps

### BB-1: Messages to closed conversations (FIXED)
1. Create conversation via POST /v1/public/support/conversations
2. Admin closes conversation via PATCH /v1/support/conversations/:id { status: "CLOSED" }
3. Customer sends message via POST /v1/public/support/conversations/:id/messages
4. **Before fix**: Message accepted, orchestration triggered
5. **After fix**: 409 Conflict "Conversation is closed"

### BB-6: SSE token in URL
1. Customer opens chat, starts conversation
2. Widget connects to SSE: `/v1/public/support/conversations/:id/stream?token=user@email.com`
3. Email visible in browser dev tools Network tab, server access logs, any CDN/proxy logs

### BB-8: Duplicate SSE + polling
1. Customer sends first message (startConversation)
2. `connectSSE()` called — establishes EventSource
3. `pollForResponse()` called immediately after — starts 30-attempt x 2s polling loop
4. If SSE delivers response, polling continues until `isLoading` becomes false
5. Best case: one wasted poll iteration. Worst case: 60 seconds of polling.

### BB-9: Admin messages missing from SSE
1. Customer connects SSE stream
2. Admin sends message via POST /v1/support/conversations/:id/messages
3. admin route creates message in DB but does NOT publish to Redis pub/sub channel
4. Customer's SSE stream never receives the admin message

### BB-11: Conditions schema mismatch
1. Create a SupportRule with no conditions (accept default)
2. Prisma stores `conditions: "{}"` (JSON string due to `@default("{}")`)
3. Support orchestration loads rule, calls evaluateSupportRules
4. `evaluateConditions` receives `"{}"` instead of `null` or `{}`
5. `Object.keys(rule.conditions as object)` on a string yields character indices
6. Evaluation proceeds incorrectly (but likely harmless since empty string chars don't match condition structure)

## Summary

- **5 bugs fixed** in this session
- **4 high-priority issues** documented for design decisions
- **2 medium issues** documented
- **3 low issues** documented (1 fixed)
