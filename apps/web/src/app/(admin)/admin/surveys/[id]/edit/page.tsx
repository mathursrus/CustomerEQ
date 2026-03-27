'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditSurveyPage() {
  const params = useParams()
  const router = useRouter()
  const surveyId = params.id as string

  useEffect(() => {
    router.replace(`/admin/survey-builder?surveyId=${surveyId}`)
  }, [router, surveyId])

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-sm text-gray-500">Redirecting to survey builder...</p>
    </div>
  )
}
