'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { WidgetForm } from './_components/widget-form'
import { WidgetPreview } from './_components/widget-preview'
import { EmbedCode } from './_components/embed-code'
import { BrandThemeCard } from './_components/brand-theme-card'
import type { WidgetConfig } from './_components/widget-preview'

const DEFAULTS: WidgetConfig = {
  position: 'BOTTOM_RIGHT',
  launcherIconUrl: null,
  darkModeAuto: false,
  greeting: 'Hi! How can we help?',
  offlineMessage: "We're not online right now. Leave us a message and we'll get back to you.",
  csatPromptText: 'Did this help?',
  escalateButtonText: 'Talk to a human',
  showCsatAfterAi: true,
  csatTimeoutSeconds: 30,
  anonAllowed: true,
}

export default function WidgetSettingsPage() {
  const { getToken } = useAuth()
  const [config, setConfig] = useState<WidgetConfig>(DEFAULTS)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const token = await getAuthToken(getToken)
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

        const profileRes = await fetch(`${API_URL}/v1/admin/brand/profile`, { headers })
        if (!profileRes.ok) {
          if (!cancelled) setError('Could not load brand profile.')
          return
        }
        const profile = (await profileRes.json()) as { brand?: { id?: string } }
        const resolvedBrandId = profile?.brand?.id
        if (!resolvedBrandId) {
          if (!cancelled) setError('Brand ID not found in profile response.')
          return
        }
        if (!cancelled) setBrandId(resolvedBrandId)

        const cfgRes = await fetch(`${API_URL}/v1/public/support/widget-config?brandId=${encodeURIComponent(resolvedBrandId)}`)
        if (!cfgRes.ok) {
          if (cfgRes.status !== 404 && !cancelled) {
            setError('Could not load widget configuration.')
          }
          return
        }
        const data = (await cfgRes.json()) as { widget?: Partial<WidgetConfig> }
        if (!cancelled && data?.widget) {
          setConfig((prev) => ({ ...prev, ...data.widget }))
        }
      } catch {
        if (!cancelled) setError('Network error loading widget settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadConfig()
    return () => { cancelled = true }
  }, [getToken])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-8 py-6">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-5 grid grid-cols-[1fr_360px] gap-4">
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1fr_420px] gap-4">
          <div className="col-span-2 h-[440px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[520px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 pb-12 pt-6">
      <header className="mb-5 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-gray-900">Widget Settings</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Customize the support chat widget that appears on your site. Changes apply after saving.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Top row: embed code (wider) + brand theme (narrower) */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {brandId ? <EmbedCode brandId={brandId} /> : <div className="h-32 animate-pulse rounded-xl bg-gray-100" />}
        <BrandThemeCard />
      </div>

      {/* Main grid: settings (spans 2) + sticky preview rail */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1fr_420px]">
        <div className="lg:col-span-2">
          <WidgetForm initial={config} onChange={setConfig} />
        </div>
        <div className="sticky top-4 self-start">
          <WidgetPreview config={config} />
        </div>
      </div>
    </div>
  )
}
