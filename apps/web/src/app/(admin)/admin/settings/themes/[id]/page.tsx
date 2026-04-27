'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'
import { ThemeForm, type ThemeFormInitialData } from '@/components/themes/ThemeForm'
import { ViewOnlyBanner } from '@/components/ui/view-only-banner'

export default function ViewThemePage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const themeId = params.id as string

  const [initialData, setInitialData] = useState<ThemeFormInitialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/themes/${themeId}`, { cache: 'no-store', headers })
        if (!res.ok) throw new Error('Theme not found')
        const data = await res.json()
        setInitialData((data.theme ?? data) as ThemeFormInitialData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load theme')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, themeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading theme...</p>
      </div>
    )
  }

  if (!initialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 text-sm">{error || 'Theme not found'}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 pt-4">
        <ViewOnlyBanner entityLabel="Theme" onEdit={() => router.push(`/admin/settings/themes/${themeId}/edit`)} />
      </div>
      <ThemeForm mode="view" themeId={themeId} initialData={initialData} />
    </div>
  )
}
