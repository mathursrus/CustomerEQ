// Issue #241 Slice 3 — pure state-machine + action map for the ⋯ row menu.
// Kept JSX-free so tests don't need a React/jsdom harness; the React shell
// (SurveyRowMenu.tsx) imports `buildMenuItems` from here.
//
// Visibility matrix (spec §1):
//   Duplicate    | always
//   Discard      | DRAFT only
//   Pause        | ACTIVE only
//   Stop         | ACTIVE or PAUSED
//   Restart      | STOPPED only
//   Delete       | STOPPED only (with confirm)

export type SurveyState = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED'

export type ApiCaller = (
  path: string,
  init?: { method?: string; body?: unknown },
) => Promise<Response>

export interface MenuItem {
  key: 'duplicate' | 'pause' | 'stop' | 'restart' | 'discard' | 'delete'
  label: string
  visible: (state: SurveyState) => boolean
  confirm?: (name: string) => string
  action: (surveyId: string) => Promise<Response>
}

export function buildMenuItems(callApi: ApiCaller): MenuItem[] {
  return [
    {
      key: 'duplicate',
      label: 'Duplicate',
      visible: () => true,
      action: (id) => callApi(`/v1/surveys/${id}/duplicate`, { method: 'POST' }),
    },
    {
      key: 'pause',
      label: 'Pause',
      visible: (s) => s === 'ACTIVE',
      action: (id) =>
        callApi(`/v1/surveys/${id}/status`, { method: 'PATCH', body: { status: 'PAUSED' } }),
    },
    {
      key: 'stop',
      label: 'Stop',
      visible: (s) => s === 'ACTIVE' || s === 'PAUSED',
      action: (id) =>
        callApi(`/v1/surveys/${id}/status`, { method: 'PATCH', body: { status: 'STOPPED' } }),
    },
    {
      key: 'restart',
      label: 'Restart',
      visible: (s) => s === 'STOPPED',
      action: (id) =>
        callApi(`/v1/surveys/${id}/status`, { method: 'PATCH', body: { status: 'ACTIVE' } }),
    },
    {
      key: 'discard',
      label: 'Discard draft',
      visible: (s) => s === 'DRAFT',
      confirm: (name) => `Discard draft “${name}”? This cannot be undone from the list.`,
      action: (id) => callApi(`/v1/surveys/${id}`, { method: 'DELETE' }),
    },
    {
      key: 'delete',
      label: 'Delete',
      visible: (s) => s === 'STOPPED',
      confirm: (name) => `Delete “${name}”? Responses are preserved but the survey will no longer appear.`,
      action: (id) => callApi(`/v1/surveys/${id}`, { method: 'DELETE' }),
    },
  ]
}
