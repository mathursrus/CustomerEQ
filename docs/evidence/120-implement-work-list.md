# Issue #120 — Implementation Work List
**Bug: no way to edit existing alert rules (Act 4 demo blocker)**

## Scope

Pure frontend bug. API already has full CRUD:
- `GET /v1/alert-rules/:id` — fetches rule (masks webhook URLs with `****{last8}`)
- `PATCH /v1/alert-rules/:id` — updates rule (uses `UpdateAlertRuleSchema = CreateAlertRuleSchema.partial()`)

**No backend or DB changes needed.**

## Issue Type: bug

## Checklist

### Frontend

- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/page.tsx`
  - Add Actions column header
  - Add Edit link (pencil icon) per row → `/admin/alerts/rules/{id}/edit`
  - Update empty-state `colSpan` from 6 → 7

- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/[id]/edit/page.tsx` *(new file)*
  - `useParams()` to get `id`
  - Fetch `GET /v1/alert-rules/:id` on mount, pre-populate form
  - **Masked webhook URL handling**: if API returns a value starting with `****`, the field is set but hidden. Show helper text "Current URL is set — leave blank to keep unchanged". Track `webhookAlreadySet` flags. Only include in PATCH payload if user types a new value.
  - On submit: `PATCH /v1/alert-rules/:id` with only fields that should update (omit masked webhook fields if unchanged)
  - On success: redirect to `/admin/alerts/rules`
  - Back link → `/admin/alerts/rules`

### Tests

- [ ] `apps/api/src/routes/alertRules.test.ts`
  - Add unit test: masked webhook URL value (`****abcd1234`) is NOT a valid URL per `CreateAlertRuleSchema` (i.e. `UpdateAlertRuleSchema.safeParse({ slackWebhookUrl: '****abcd1234' })` → false). Documents why the edit page must not round-trip masked values.

## Validation Requirements

- `uiValidationRequired: true` — edit page must render, pre-populate, and submit correctly
- `mobileValidationRequired: false`
- Browser baseline: Chrome (desktop)
- Evidence artifact: `docs/evidence/120-ui-polish-validation.md`

## Known Constraints

- Webhook URLs are masked in `GET /v1/alert-rules/:id` response. Edit page must never send masked `****` values to PATCH (they fail URL validation).
- `defaultAssignee` is required by `CreateAlertRuleSchema`. `UpdateAlertRuleSchema` makes it optional (`.partial()`), so PATCH is fine sending it or omitting it.
- `surveyTypes` defaults to `[]` — must pre-populate from fetched rule.

## Deferrals

- None. This is a self-contained frontend fix.
