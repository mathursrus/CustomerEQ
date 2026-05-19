// Issue #241 Slice 4b (#336) — /admin/surveys/new — thin Server Component (§J item 11).
// Issue #371 — production regression fix: every external call (auth/getToken
// and both fetches) is now wrapped in try/catch so an underlying rejection
// (DNS, connection reset, Clerk infra blip) becomes an operator-visible
// redirect to /admin/surveys?error=<reason> instead of bubbling up as the
// cryptic "Server Components render error" with a digest. Matches the
// defensive pattern already in apps/web/src/app/(admin)/admin/campaigns/page.tsx
// and .../admin/programs/[id]/page.tsx. redirect() calls live outside the try
// blocks so NEXT_REDIRECT (which redirect() throws to short-circuit) is never
// swallowed.
//
// Operator never sees content on this route — it just:
//   1. auth()  → bearer token
//   2. GET /v1/programs  → resolve default programId (or redirect if zero)
//   3. POST /v1/surveys  → create DRAFT row with NPS preset questions
//   4. redirect to /admin/surveys/[id]/edit?tab=basics
//
// No operator-visible content. Per Spec §1 ("+ New survey CTA creates a draft
// and routes to the editor") + work-list §C.3 row 15.

import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

import { API_URL } from '@/lib/config'

import { freshPresetFor } from '../_helpers/presets'

interface Program {
  id: string
  name: string
}

interface ProgramsResponse {
  data?: Program[]
  programs?: Program[]
}

interface SurveyCreatedResponse {
  survey?: { id: string }
  id?: string
}

// `null` distinguishes "fetch failed" (network/auth blip — route should
// redirect with error=programs-fetch-failed) from `[]` ("brand has zero
// programs" — redirect with error=no-program). The list page only shows the
// fresh-brand empty state for the second case.
async function fetchPrograms(token: string | null): Promise<Program[] | null> {
  try {
    const res = await fetch(`${API_URL}/v1/programs`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    const body = (await res.json()) as ProgramsResponse
    return body.data ?? body.programs ?? []
  } catch {
    return null
  }
}

async function createDraftSurvey(
  token: string | null,
  programId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/v1/surveys`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        // Issue #241 — name starts empty so the operator sees the placeholder
        // ("e.g. NPS Q3 launch") rather than "Untitled survey" as a pre-fill.
        // R23 activation gate enforces non-empty before the survey can go live.
        name: '',
        programId,
        type: 'NPS',
        // Issue #371 — call freshPresetFor per-request (not at module load).
        // Previously the question IDs were frozen at import time, so every
        // survey created via this route shared the same q_<random> IDs.
        questions: freshPresetFor('NPS'),
      }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as SurveyCreatedResponse
    return body.survey?.id ?? body.id ?? null
  } catch {
    return null
  }
}

export default async function NewSurveyPage() {
  // Auth resolution is its own try/catch: if Clerk's session lookup fails
  // we want a clean redirect rather than an unhandled render error.
  let token: string | null = null
  let authOk = true
  try {
    const { getToken } = await auth()
    token = await getToken()
  } catch {
    authOk = false
  }
  if (!authOk) {
    redirect('/admin/surveys?error=auth-failed')
  }

  const programs = await fetchPrograms(token)
  if (programs === null) {
    redirect('/admin/surveys?error=programs-fetch-failed')
  }
  if (programs.length === 0) {
    redirect('/admin/surveys?error=no-program')
  }

  const programId = programs[0].id
  const surveyId = await createDraftSurvey(token, programId)
  if (!surveyId) {
    redirect('/admin/surveys?error=create-failed')
  }

  redirect(`/admin/surveys/${surveyId}/edit?tab=basics`)
}
