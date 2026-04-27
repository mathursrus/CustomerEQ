'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { AlertRuleForm, type AlertRuleFormInitialData } from '@/components/alert-rules/AlertRuleForm'
import { ViewOnlyBanner } from '@/components/ui/view-only-banner'

export default function ViewAlertRulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { getToken } = useAuth()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [initialData, setInitialData] = useState<AlertRuleFormInitialData | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getAuthToken(getToken)
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/alert-rules/${id}`, { cache: 'no-store', headers })
        if (!res.ok) {
          setLoadError(res.status === 404 ? 'Alert rule not found.' : `Failed to load rule (${res.status})`)
          return
        }
        setInitialData((await res.json()) as AlertRuleFormInitialData)
      } catch {
        setLoadError('Failed to load alert rule. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load().catch(() => {})
  }, [id, getToken])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        Loading rule…
      </div>
    )
  }

  if (loadError || !initialData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/admin/alerts/rules" className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline">
            &larr; Back to Alert Rules
          </Link>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError ?? 'Alert rule not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <ViewOnlyBanner entityLabel="Alert Rule" onEdit={() => router.push(`/admin/alerts/rules/${id}/edit`)} />
      </div>
      <AlertRuleForm mode="view" ruleId={id} initialData={initialData} />
    </div>
  )
}
