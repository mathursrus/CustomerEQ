# Feature: Campaign Edit Page

Issue: #91
Owner: Claude

## Customer

Marketing managers who need to fix typos, adjust probabilities, or update budget caps on existing campaigns without deleting and recreating them.

## Customer Problem Being Solved

Once a campaign is created, there's no way to edit it. Admins must delete and recreate to fix a typo or adjust probabilities. This is especially painful for spin wheel/scratch card/mystery box campaigns with complex actionConfig.

## Requirements

**R1** — `PATCH /v1/campaigns/:id` SHALL update editable fields: name, triggerType, triggerCondition, actionConfig, budgetCap, startDate, endDate.

**R2** — DRAFT and PAUSED campaigns SHALL be fully editable. ACTIVE campaigns SHALL only allow updating name and budgetCap.

**R3** — actionConfig SHALL be validated against the correct schema based on actionType (same superRefine as creation).

**R4** — Edit page at `/admin/campaigns/:id/edit` SHALL pre-fill the form with existing campaign values.

**R5** — For interactive campaigns (spin_wheel, scratch_card, mystery_box), the edit page SHALL show the same segment/prize builder + live preview as the creation page.

**R6** — Campaign list SHALL have an "Edit" link per row.

**R7** — "Save Changes" button calls PATCH endpoint. On success, redirect to campaigns list.

**R8** — If campaign is ACTIVE, non-editable fields SHALL be disabled with a tooltip explaining why.

## Validation Plan

1. API: PATCH campaign name (201), PATCH actionConfig with new probabilities, reject edit on ACTIVE campaign's triggerType
2. E2E: Navigate to edit page, verify form pre-filled, change name, save, verify redirect
3. Manual: Edit a spin wheel campaign's segments, verify preview updates
