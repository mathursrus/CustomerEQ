'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { OrganizationSettingsForm } from './components/OrganizationSettingsForm'
import type { ProfileResponse } from './lib/types'

// Issue #292 Slice 4 — /admin/settings/organization route entry.
// Client component (matches existing /admin/settings/themes pattern).
// First GET lazily upserts the Brand row server-side (Slice 3 GET handler),
// so a fresh admin lands here after Clerk's afterCreateOrganizationUrl
// redirect and the page paints with a real Brand row on first call.

export default function OrganizationSettingsPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getAuthToken(getToken)
        const res = await fetch(`${API_URL}/v1/admin/brand/profile`, {
          cache: 'no-store',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Best-effort hints for first-run lazy-upsert defaults. The
            // server already falls back to UTC / en-US if these are absent.
            'X-Timezone-Hint':
              typeof Intl !== 'undefined'
                ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
                : 'UTC',
            'X-Locale-Hint':
              typeof navigator !== 'undefined' && navigator.language
                ? navigator.language
                : 'en-US',
          },
        })
        if (!res.ok) throw new Error(`Failed to load profile (HTTP ${res.status})`)
        const json = (await res.json()) as ProfileResponse
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load organization settings')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-sm text-gray-500" aria-busy="true">
        Loading organization settings…
      </div>
    )
  }

  return <OrganizationSettingsForm initial={data} />
}
