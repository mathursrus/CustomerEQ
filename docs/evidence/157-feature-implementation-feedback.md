# Feedback for Issue #157 — feature-implementation Workflow (PR 1, Lead)

## Round 1 Feedback
*Received: 2026-04-21T06:02:56Z*

### Comment 1 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **PR**: https://github.com/mathursrus/CustomerEQ/pull/160
- **File**: `apps/web/src/components/ui/view-only-banner.tsx`
- **Line**: 26
- **Comment**: "Changes are not allowed, correct? Shouldn't the message says, click edit to make changes?"
- **Status**: ADDRESSED

**Analysis**: The old copy said "Changes are not saved" which implies the user could make changes that would silently fail to persist. In view mode, every input/select/textarea/toggle has `disabled={isViewOnly}` — changes literally cannot be entered. The message should instead direct the user to the Edit action.

**Fix applied**: Changed the banner message from `"You are viewing this {entityLabel.toLowerCase()} in read-only mode. Changes are not saved."` to `"You are viewing this {entityLabel.toLowerCase()} in read-only mode. Click Edit to make changes."`

**Commit**: to be linked after push
