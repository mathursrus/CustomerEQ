// Issue #241 Slice 4a — admin detail page rewrite.
// 3 collapsible sections (Distribution · Response · Configuration summary) per
// spec §7 + RFC §"Detail page". Reads survey + theme + brand + program-name and
// composes the renderer family for the Configuration preview.

'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { API_URL, getAuthToken } from '@/lib/config'
import type {
  BrandLite,
  BrandThemeLite,
  SurveyResolved,
} from '@/components/survey-form/types'

import { ConfigurationSummarySection } from './components/ConfigurationSummarySection'
import { DistributionSection } from './components/DistributionSection'
import { LoopMonitorSection } from './components/LoopMonitorSection'
import { ResponseSection } from './components/ResponseSection'
import { SurveyDetailShell } from './components/SurveyDetailShell'

type SurveyState = SurveyResolved['status']

interface SurveyApiShape extends SurveyResolved {
  _count?: { responses: number }
  responsesCount?: number
  updatedAt?: string
}

const DEFAULT_THEME: BrandThemeLite = {
  id: 'thm_default',
  name: 'Default theme',
  primaryColor: '#6366f1',
  secondaryColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#6366f1',
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  maxWidth: 'md',
  borderRadius: 'md',
  cardStyle: 'shadow',
  backgroundImageUrl: null,
}

export default function SurveyDetailPage() {
  const params = useParams()
  const surveyId = params.id as string
  const { getToken } = useAuth()

  const [survey, setSurvey] = useState<SurveyApiShape | null>(null)
  const [theme, setTheme] = useState<BrandThemeLite | null>(null)
  const [brand, setBrand] = useState<BrandLite | null>(null)
  const [programName, setProgramName] = useState<string | null>(null)
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

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const surveyRes = await callApi(`/v1/surveys/${surveyId}`)
      if (!surveyRes.ok) throw new Error(`Failed to load survey (${surveyRes.status})`)
      const surveyData = await surveyRes.json()
      const loadedSurvey: SurveyApiShape = surveyData.survey ?? surveyData
      setSurvey(loadedSurvey)

      const [themeRes, brandRes, programsRes] = await Promise.all([
        loadedSurvey.themeId
          ? callApi(`/v1/brand-themes/${loadedSurvey.themeId}`).catch(() => null)
          : Promise.resolve(null),
        callApi(`/v1/me`).catch(() => null),
        callApi(`/v1/programs`).catch(() => null),
      ])

      if (themeRes && themeRes.ok) {
        const themeData = await themeRes.json()
        setTheme(themeData.theme ?? themeData)
      } else {
        setTheme(DEFAULT_THEME)
      }

      if (brandRes && brandRes.ok) {
        const brandData = await brandRes.json()
        setBrand(brandData.brand ?? brandData)
      }

      if (programsRes && programsRes.ok) {
        const programsData = await programsRes.json()
        const list: Array<{ id: string; name: string }> = programsData.data ?? programsData ?? []
        const match = list.find((p) => p.id === loadedSurvey.programId)
        setProgramName(match?.name ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [callApi, surveyId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'Survey not found'}
      </div>
    )
  }

  const responsesCount = survey._count?.responses ?? survey.responsesCount ?? 0
  const status = survey.status as SurveyState
  const effectiveTheme = theme ?? DEFAULT_THEME
  const effectiveBrand: BrandLite =
    brand ?? {
      id: 'brand-unknown',
      name: 'Your brand',
      logoUrl: null,
      consentMode: 'EXPLICIT',
      consentTextDefault: null,
      termsUrl: null,
      privacyPolicyUrl: null,
      memberIdentifierKind: 'email',
    }

  return (
    <SurveyDetailShell
      surveyId={surveyId}
      surveyName={survey.name}
      surveyType={survey.type}
      description={survey.description}
      programName={programName}
      status={status}
      hasConsentOverride={Boolean(survey.consentMode)}
      callApi={callApi}
      onActionComplete={loadAll}
    >
      <DistributionSection
        surveyId={surveyId}
        status={status}
        responsesCount={responsesCount}
        apiUrl={API_URL}
        memberIdentifierKind={effectiveBrand.memberIdentifierKind}
      />
      <LoopMonitorSection
        surveyId={surveyId}
        surveyStatus={status}
        getToken={getToken}
      />
      <ResponseSection
        surveyId={surveyId}
        responsesCount={responsesCount}
      />
      <ConfigurationSummarySection
        survey={survey}
        brand={effectiveBrand}
        theme={effectiveTheme}
        programName={programName}
        responsesCount={responsesCount}
      />
    </SurveyDetailShell>
  )
}
