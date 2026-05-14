'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { WidgetForm } from './_components/widget-form'
import { WidgetPreview } from './_components/widget-preview'
import { EmbedCode } from './_components/embed-code'
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

        // Step 1: resolve the current brand ID from the admin brand profile endpoint.
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

        // Step 2: load the current widget config (public endpoint, no auth required).
        const cfgRes = await fetch(`${API_URL}/v1/public/support/widget-config?brandId=${encodeURIComponent(resolvedBrandId)}`)
        if (!cfgRes.ok) {
          // 404 is fine — the brand simply hasn't saved a config yet; use defaults.
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
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-[480px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[520px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Widget Settings</h1>
      <p className="mb-6 text-sm text-gray-500">
        Customize the support chat widget that appears on your site. Changes apply after saving.
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Embed code — first thing the brand sees so they know how to install */}
      {brandId && (
        <div className="mb-6">
          <EmbedCode brandId={brandId} />
        </div>
      )}

      {/* Theme & colors callout — colors live on BrandTheme, not duplicated here */}
      <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">Colors, logo, and fonts</h3>
          <p className="mt-1 text-sm text-indigo-800">
            The widget uses your brand theme. To change primary color, accent, fonts, or upload your logo, edit your brand theme.
          </p>
        </div>
        <Link
          href="/admin/settings/themes"
          className="shrink-0 rounded-lg border border-indigo-600 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Manage theme →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: settings form */}
        <div>
          <WidgetForm initial={config} onChange={setConfig} />
        </div>

        {/* Right: live preview */}
        <div className="sticky top-6 self-start">
          <h2 className="mb-3 text-sm font-medium text-gray-600">Live preview</h2>
          <WidgetPreview config={config} />
          <p className="mt-2 text-xs text-gray-400">
            Preview updates as you edit. Colors reflect your brand theme — change them under{' '}
            <Link href="/admin/settings/themes" className="underline">
              Themes
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
