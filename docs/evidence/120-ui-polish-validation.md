# UI Polish Validation — Issue #120
**Bug: no way to edit existing alert rules (Act 4 demo blocker)**

## Validation Summary

| Check | Result | Notes |
|-------|--------|-------|
| No console.log / TODO / FIXME | ✅ PASS | Grepped all changed files — zero matches |
| Git working tree | ✅ CLEAN | Only package-lock.json untracked (from prep script) |
| TypeScript typecheck (web app) | ✅ PASS | `tsc --noEmit` exits 0 — zero errors |
| TypeScript typecheck (api app) | ⚠️ PRE-EXISTING | Errors are pre-existing workspace resolution issues unrelated to this fix |
| Next.js build (main workspace) | ✅ PASS | Build completes cleanly — zero compilation errors |
| Unit tests (alertRules) | ✅ PASS | 16 tests pass (including 4 new masked URL rejection tests) |
| E2E tests authored | ✅ DONE | 5 new tests in closed-loop-alerting.spec.ts |
| Live browser validation | ⚠️ BLOCKED | Dev environment missing Clerk publishableKey — cannot authenticate |

## Code Review Validation

The edit page (`apps/web/src/app/(admin)/admin/alerts/rules/[id]/edit/page.tsx`) was validated against the existing `new/page.tsx` pattern:

| Pattern | new/page.tsx | [id]/edit/page.tsx |
|---------|-------------|---------------------|
| Auth hook | `useAuth()` + `getAuthToken` | ✅ Same |
| Config import | `API_URL` from `@/lib/config` | ✅ Same |
| Form state | `useState<FormData>` | ✅ Same |
| Navigation | `useRouter().push(...)` | ✅ Same |
| Error handling | serverError state | ✅ Same |
| Submit button disabled state | `submitting` flag | ✅ Same |

Additional patterns unique to the edit page:

| Feature | Implementation |
|---------|---------------|
| Route param | `useParams<{ id: string }>()` — standard Next.js 14 pattern |
| Pre-population | `useEffect` fetches `GET /v1/alert-rules/:id` and populates form state |
| Masked webhook URLs | `isMasked()` checks `startsWith('****')`. If masked: show helper text, leave input blank, omit from PATCH unless user types new value |
| Loading state | Shows "Loading rule…" while fetching |
| 404 handling | Displays error message if GET returns non-OK |
| Cancel button | Link to `/admin/alerts/rules` alongside Save Changes |

## Masked Webhook URL Logic Verification

```
API returns: slackWebhookUrl = "****ices/xxx"
isMasked("****ices/xxx") → true
→ slackAlreadySet = true
→ form.slackWebhookUrl = '' (not pre-populated)
→ Placeholder shows: "Current URL is set — leave blank to keep unchanged"
→ Helper text: "A Slack webhook URL is already configured. Enter a new URL to replace it."

On PATCH submit:
  form.slackWebhookUrl = '' AND slackAlreadySet = true → OMIT from payload (preserves existing)
  form.slackWebhookUrl = '' AND slackAlreadySet = false → send null (clears field)
  form.slackWebhookUrl = 'https://...' → send new URL (replaces)
```

Verified inline via Node.js that `UpdateAlertRuleSchema.safeParse({ slackWebhookUrl: '****abcd1234' }).success === false`. ✅

## User Journey Coverage (E2E Tests)

| Journey | Covered By |
|---------|-----------|
| Rules list shows Edit link on each row | `'shows Edit link on each rule row in the list'` |
| Edit link href points to correct rule | `expect(firstHref).toBe('/admin/alerts/rules/rule-1/edit')` |
| Edit page pre-populates rule name | `expect(page.locator('#ruleName')).toHaveValue('NPS Detractor Alert')` |
| Edit page pre-populates SLA hours | `expect(page.locator('#slaHours')).toHaveValue('4')` |
| Edit page pre-populates survey types | `expect(page.getByLabel('NPS')).toBeChecked()` |
| Masked Slack URL shows helper text, not masked value | `expect(page.locator('#slackWebhookUrl')).toHaveValue('')` + helper text |
| PATCH submit redirects to rules list | `page.waitForURL('/admin/alerts/rules')` |
| Cancel navigates back to rules list | `expect(cancelHref).toBe('/admin/alerts/rules')` |

## Responsive Validation

Not applicable — this is a standard admin table/form page. No responsive-specific changes were made. The fix adds an `Actions` column to a table that already exists; the column follows the same padding/sizing as the other 6 columns.

## Evidence Status

- Live Playwright screenshots: Not captured (Clerk auth unavailable in dev environment)
- TypeScript evidence: tsc clean ✅
- Build evidence: Next.js build passes ✅
- Unit test evidence: 16/16 pass ✅
- E2E test code: Written and committed ✅
