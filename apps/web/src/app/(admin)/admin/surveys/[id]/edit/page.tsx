// Issue #241 Slice 4b (#336) — Admin survey editor route.
// Replaces the 20-line redirect stub from Slice 3 with the real editor shell.
//
// Load sequence mirrors the Slice 4a detail page so cache + fixture
// expectations stay consistent across the admin surveys experience:
//   GET /v1/surveys/:id   (survey)
//   GET /v1/brand-themes  (theme library for Look & Feel)
//   GET /v1/me            (brand — consentMode, termsUrl, etc.)
//   GET /v1/programs      (program list + EarningRule for Points tab)

'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'
import type { BrandThemeLite } from '@/components/survey-form/types'

import { SurveyEditorForm } from './components/SurveyEditorForm'
import type { TabId } from './components/TabHeader'
import type {
  EditorBrand,
  EditorSurvey,
  ProgramWithEarningRule,
} from './__fixtures__/editor-fixtures'

const VALID_TABS: ReadonlyArray<TabId> = ['basics', 'questions', 'look-feel', 'points-thank-you']

function parseInitialTab(raw: string | null | undefined): TabId {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) return raw as TabId
  return 'basics'
}

export default function EditSurveyPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken } = useAuth()

  const surveyId = (params?.id ?? '') as string
  const initialTab = parseInitialTab(searchParams?.get('tab'))

  const [survey, setSurvey] = useState<EditorSurvey | null>(null)
  const [brand, setBrand] = useState<EditorBrand | null>(null)
  const [themes, setThemes] = useState<BrandThemeLite[]>([])
  const [programs, setPrograms] = useState<ProgramWithEarningRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const callApi = useCallback(
    async (path: string, init?: { method?: string; body?: unknown }) => {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      return fetch(`${API_URL}${path}`, {
        method: init?.method ?? 'GET',
        headers,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      })
    },
    [getToken],
  )

  const patchSurvey = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      // useAutoSave + SurveyEditorForm pass relative URLs (e.g. /v1/surveys/:id).
      const path = url.startsWith('http') ? url : url
      return callApi(path, { method: 'PATCH', body })
    },
    [callApi],
  )

  const deleteSurvey = useCallback(async () => {
    return callApi(`/v1/surveys/${surveyId}`, { method: 'DELETE' })
  }, [callApi, surveyId])

  const activateSurvey = useCallback(
    async (id: string) =>
      callApi(`/v1/surveys/${id}/status`, { method: 'PATCH', body: { status: 'ACTIVE' } }),
    [callApi],
  )

  const loadAll = useCallback(async () => {
    if (!surveyId) return
    setLoading(true)
    setError(null)
    try {
      const surveyRes = await callApi(`/v1/surveys/${surveyId}`)
      if (!surveyRes.ok) throw new Error(`Failed to load survey (HTTP ${surveyRes.status})`)
      const surveyData = (await surveyRes.json()) as { survey?: EditorSurvey } | EditorSurvey
      const loadedSurvey =
        'survey' in (surveyData as Record<string, unknown>)
          ? ((surveyData as { survey: EditorSurvey }).survey)
          : (surveyData as EditorSurvey)
      setSurvey(loadedSurvey)

      const [themesRes, meRes, programsRes] = await Promise.all([
        callApi('/v1/brand-themes').catch(() => null),
        callApi('/v1/me').catch(() => null),
        callApi('/v1/programs').catch(() => null),
      ])

      if (themesRes && themesRes.ok) {
        const themesData = (await themesRes.json()) as {
          themes?: BrandThemeLite[]
          data?: BrandThemeLite[]
        }
        setThemes(themesData.themes ?? themesData.data ?? [])
      }

      if (meRes && meRes.ok) {
        const meData = (await meRes.json()) as { brand?: EditorBrand }
        if (meData.brand) setBrand(meData.brand)
      }

      if (programsRes && programsRes.ok) {
        const programsData = (await programsRes.json()) as {
          data?: ProgramWithEarningRule[]
          programs?: ProgramWithEarningRule[]
        }
        setPrograms(programsData.data ?? programsData.programs ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [callApi, surveyId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleActivated = useCallback(() => {
    router.push(`/admin/surveys/${surveyId}`)
  }, [router, surveyId])

  const handleDiscarded = useCallback(() => {
    router.push('/admin/surveys')
  }, [router])

  const ready = useMemo(() => survey !== null && brand !== null, [survey, brand])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (error || !ready || !survey || !brand) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'Survey not found'}
      </div>
    )
  }

  return (
    <SurveyEditorForm
      survey={survey}
      brand={brand}
      themes={themes}
      programs={programs}
      initialTab={initialTab}
      patchSurvey={patchSurvey}
      deleteSurvey={deleteSurvey}
      activateSurvey={activateSurvey}
      onActivate={handleActivated}
      onDiscard={handleDiscarded}
    />
  )
}
