'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPersonaEmail } from '@/lib/persona'

interface Survey {
  id: string
  name: string
  type: string
}

export default function SurveysPage() {
  const router = useRouter()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    setEmail(getPersonaEmail())
    const handler = () => setEmail(getPersonaEmail())
    window.addEventListener('ceq_persona_changed', handler)
    return () => window.removeEventListener('ceq_persona_changed', handler)
  }, [])

  useEffect(() => {
    fetch('/api/storefront/surveys')
      .then((r) => r.json())
      .then((data: Survey[]) => setSurveys(Array.isArray(data) ? data : []))
      .catch(() => setSurveys([]))
      .finally(() => setLoading(false))
  }, [])

  function takeSurvey(id: string) {
    const params = email ? `?email=${encodeURIComponent(email)}` : ''
    router.push(`/survey/${id}${params}`)
  }

  if (!email) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">📋</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">No persona selected</h2>
        <p className="text-sm text-gray-500">Pick a demo persona from the header to take a survey.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
      </div>
    )
  }

  if (surveys.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-sm text-gray-500">No active surveys right now.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Share your feedback</h1>
      <p className="text-sm text-gray-500 mb-6">Responding as <strong>{email}</strong></p>

      <div className="space-y-3">
        {surveys.map((survey) => (
          <div
            key={survey.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-gray-900 text-sm">{survey.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{survey.type}</p>
            </div>
            <button
              onClick={() => takeSurvey(survey.id)}
              className="shrink-0 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Take survey
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
