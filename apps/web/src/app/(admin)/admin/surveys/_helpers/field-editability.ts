// Issue #241 Slice 4b (#336) — Client mirror of FIELD_EDITABILITY in
// apps/api/src/routes/surveys.ts:25. Keep in sync.
//
// Two consumers:
//   1. Editor tabs use it to disable inputs that cannot be saved in the
//      survey's current state — operator never accidentally edits a locked
//      field and hits a 409 on Save / auto-save.
//   2. SurveyEditorForm uses it to filter the PATCH body in
//      handleSaveCurrentTab / flushPendingChanges — belt-and-suspenders so
//      a dirty field that somehow slipped through (e.g. state transition
//      between dirty + save) does not 409 the whole batch.

export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'

interface EditabilityContext {
  responsesCount: number
}

type Rule = (state: SurveyStatus, ctx: EditabilityContext) => boolean

const FIELD_EDITABILITY: Record<string, Rule> = {
  name: (s) => s !== 'STOPPED',
  title: (s) => s !== 'STOPPED',
  description: (s) => s !== 'STOPPED',
  type: (s) => s === 'DRAFT',
  programId: (s) => s === 'DRAFT',
  // R30: locked once any response is collected.
  responsePolicy: (s, ctx) => s === 'DRAFT' && ctx.responsesCount === 0,
  // Spec §State transitions: Pause exists for changing questions on a live
  // survey without losing responses; ACTIVE / STOPPED reject question edits.
  questions: (s) => s === 'DRAFT' || s === 'PAUSED',
  themeId: (s) => s !== 'STOPPED',
  settings: (s) => s !== 'STOPPED',
  thankYouMessage: (s) => s !== 'STOPPED',
  thankYouRedirectUrl: (s) => s !== 'STOPPED',
  consentTextOverride: (s) => s !== 'STOPPED',
}

export function isFieldEditable(
  field: string,
  state: SurveyStatus,
  ctx: EditabilityContext = { responsesCount: 0 },
): boolean {
  const rule = FIELD_EDITABILITY[field]
  if (!rule) return true
  return rule(state, ctx)
}
