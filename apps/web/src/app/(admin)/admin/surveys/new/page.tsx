import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { API_URL } from '@/lib/config'

// Issue #241 Slice 3 — `/admin/surveys/new` is a thin Server Component that
// POSTs a minimum-valid Survey row and redirects to the editor (per RFC §"Surveys list"
// and ADR 0001 preservation). Replaces the 462-line client-side wizard.
//
// Flow:
//   1. Resolve the brand's first program (the API requires programId — onboarding
//      always seeds at least one). If zero programs exist, redirect back to the
//      list with an error query so the operator sees an inline notice.
//   2. POST /v1/surveys with minimum body: { name, programId, type: 'NPS' }. Server
//      defaults responsePolicy=MULTIPLE, consentMode=null (inherits brand),
//      thankYouMessage=DEFAULT.
//   3. redirect() to /admin/surveys/[id]/edit?tab=basics — the user lands on the
//      editor with required fields highlighted until filled.
//
// No form rendered. The route exists but renders nothing operator-visible — it's
// purely the POST + redirect handoff. This preserves ADR 0001's four-route layout
// while eliminating the duplicate-draft surface at the protocol level: the row is
// created exactly once at the click of "+ New survey" rather than per-Next-POST.

interface Program {
  id: string
}

interface ProgramsResponse {
  data?: Program[]
  programs?: Program[]
}

async function resolveFirstProgramId(token: string | null): Promise<string | null> {
  const res = await fetch(`${API_URL}/v1/programs`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return null
  const json = (await res.json()) as ProgramsResponse | Program[]
  const list = Array.isArray(json) ? json : (json.data ?? json.programs ?? [])
  return list[0]?.id ?? null
}

async function createDraftSurvey(token: string | null, programId: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/v1/surveys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: 'Untitled survey',
      programId,
      type: 'NPS',
    }),
  })
  if (!res.ok) return null
  const created = (await res.json()) as { id?: string }
  return created.id ?? null
}

export default async function NewSurveyPage() {
  const { getToken } = await auth()
  const token = await getToken()

  const programId = await resolveFirstProgramId(token)
  if (!programId) {
    redirect('/admin/surveys?error=no-program')
  }

  const surveyId = await createDraftSurvey(token, programId)
  if (!surveyId) {
    redirect('/admin/surveys?error=create-failed')
  }

  redirect(`/admin/surveys/${surveyId}/edit?tab=basics`)
}
