// Issue #241 Slice 4b (#336) — /admin/surveys/new — thin Server Component (§J item 11).
//
// Replaces the legacy 462-line client wizard (TriggerStep / RuleBuilderStep /
// ReviewLaunchStep). Operator never sees content on this route — it just:
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

// Initial NPS preset for newly-created drafts. Sourced from the shared
// preset module so /new and the BasicsTab type-swap stay in lock-step,
// including the isScoreField=true flag on the standard rating question.
const DEFAULT_NPS_QUESTIONS = freshPresetFor('NPS')

async function fetchPrograms(token: string | null): Promise<Program[]> {
  const res = await fetch(`${API_URL}/v1/programs`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  const body = (await res.json()) as ProgramsResponse
  return body.data ?? body.programs ?? []
}

async function createDraftSurvey(
  token: string | null,
  programId: string,
): Promise<string | null> {
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
      questions: DEFAULT_NPS_QUESTIONS,
    }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as SurveyCreatedResponse
  return body.survey?.id ?? body.id ?? null
}

export default async function NewSurveyPage() {
  const { getToken } = await auth()
  const token = await getToken()

  const programs = await fetchPrograms(token)
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
