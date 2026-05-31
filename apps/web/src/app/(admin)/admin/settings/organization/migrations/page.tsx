'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { getCurrentMigration } from '@/lib/migrations'

// Issue #524 Slice 1 — migrations entry. There is no list endpoint, so this
// route reads the brand's current (most-recent non-cancelled) migration and
// redirects: to /[id] if one exists, otherwise to /new to begin the wizard.

export default function MigrationsIndexPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const current = await getCurrentMigration(getToken)
        if (cancelled) return
        if (current) {
          router.replace(`/admin/settings/organization/migrations/${current.id}`)
        } else {
          router.replace('/admin/settings/organization/migrations/new')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load migration')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken, router])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-500" aria-busy="true">
      Loading…
    </div>
  )
}
