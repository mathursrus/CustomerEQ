'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { ProgramWizardLoader } from '../_components/program-wizard-loader'

export default function ProgramViewPage() {
  const params = useParams()
  const { getToken } = useAuth()
  const programId = params.id as string
  const [program, setProgram] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadProgram() {
      try {
        const token = await getAuthToken(getToken)
        const res = await fetch(`${API_URL}/v1/programs/${programId}`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          if (!cancelled) {
            setProgram(null)
          }
          return
        }

        const data = await res.json()
        if (!cancelled) {
          setProgram(data as Record<string, unknown>)
        }
      } catch {
        if (!cancelled) {
          setProgram(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProgram()

    return () => {
      cancelled = true
    }
  }, [getToken, programId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading program...</p>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 text-sm">Program not found</p>
      </div>
    )
  }

  return <ProgramWizardLoader mode="view" programId={programId} program={program as never} />
}
