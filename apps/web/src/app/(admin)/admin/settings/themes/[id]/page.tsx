'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

interface ThemeForm {
  name: string
  isDefault: boolean
  logoUrl: string
  brandName: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  accentColor: string
  fontFamily: string
  headingSize: 'sm' | 'md' | 'lg'
  bodySize: 'sm' | 'md' | 'lg'
  cardStyle: 'flat' | 'shadow' | 'border'
  borderRadius: 'none' | 'sm' | 'md' | 'lg'
  maxWidth: 'sm' | 'md' | 'lg'
  thankYouMessage: string
  thankYouRedirectUrl: string
  showIncentivePoints: boolean
}

const fontOptions = ['system-ui', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins']

const headingSizeMap: Record<string, string> = { sm: '1.125rem', md: '1.5rem', lg: '2rem' }
const bodySizeMap: Record<string, string> = { sm: '0.8125rem', md: '0.9375rem', lg: '1.0625rem' }
const borderRadiusMap: Record<string, string> = { none: '0px', sm: '4px', md: '8px', lg: '16px' }
const maxWidthMap: Record<string, string> = { sm: '480px', md: '640px', lg: '800px' }

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono"
        placeholder="#000000"
      />
      <span className="text-xs text-gray-500 w-28 truncate">{label}</span>
    </div>
  )
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function SurveyPreview({ theme }: { theme: ThemeForm }) {
  const radius = borderRadiusMap[theme.borderRadius]
  const mw = maxWidthMap[theme.maxWidth]
  const cardShadow =
    theme.cardStyle === 'shadow'
      ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)'
      : 'none'
  const cardBorder = theme.cardStyle === 'border' ? `1px solid ${theme.accentColor}33` : 'none'

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}
    >
      <div style={{ maxWidth: mw, margin: '0 auto' }}>
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />
          ) : (
            <div
              className="h-10 w-10 rounded flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: theme.primaryColor, color: theme.buttonTextColor }}
            >
              {(theme.brandName || 'B').charAt(0).toUpperCase()}
            </div>
          )}
          <span
            style={{
              color: theme.textColor,
              fontSize: headingSizeMap[theme.headingSize],
              fontWeight: 700,
            }}
          >
            {theme.brandName || 'Brand Name'}
          </span>
        </div>

        {/* NPS Question */}
        <div
          className="mb-4 p-5"
          style={{
            borderRadius: radius,
            boxShadow: cardShadow,
            border: cardBorder,
            backgroundColor: theme.backgroundColor,
          }}
        >
          <p
            style={{
              color: theme.textColor,
              fontSize: headingSizeMap[theme.headingSize],
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            How likely are you to recommend us?
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                className="flex items-center justify-center text-xs font-medium transition-colors"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: radius,
                  backgroundColor: i === 9 ? theme.buttonColor : `${theme.primaryColor}15`,
                  color: i === 9 ? theme.buttonTextColor : theme.textColor,
                  border: `1px solid ${theme.primaryColor}30`,
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <div
            className="flex justify-between mt-1.5"
            style={{ fontSize: bodySizeMap[theme.bodySize], color: `${theme.textColor}99` }}
          >
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>

        {/* Text Question */}
        <div
          className="mb-4 p-5"
          style={{
            borderRadius: radius,
            boxShadow: cardShadow,
            border: cardBorder,
            backgroundColor: theme.backgroundColor,
          }}
        >
          <p
            style={{
              color: theme.textColor,
              fontSize: headingSizeMap[theme.headingSize],
              fontWeight: 600,
              marginBottom: '0.75rem',
            }}
          >
            Tell us more about your experience
          </p>
          <textarea
            readOnly
            rows={3}
            placeholder="Type your feedback here..."
            className="w-full resize-none px-3 py-2"
            style={{
              borderRadius: radius,
              border: `1px solid ${theme.primaryColor}40`,
              backgroundColor: `${theme.backgroundColor}`,
              color: theme.textColor,
              fontSize: bodySizeMap[theme.bodySize],
              fontFamily: theme.fontFamily,
            }}
          />
        </div>

        {/* Submit button */}
        <div className="mb-6">
          <button
            type="button"
            className="px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderRadius: radius,
              backgroundColor: theme.buttonColor,
              color: theme.buttonTextColor,
            }}
          >
            Submit Feedback
          </button>
        </div>

        {/* Thank you preview */}
        <div
          className="p-5"
          style={{
            borderRadius: radius,
            boxShadow: cardShadow,
            border: cardBorder,
            backgroundColor: `${theme.accentColor}10`,
          }}
        >
          <p
            style={{
              color: theme.textColor,
              fontSize: headingSizeMap[theme.headingSize],
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            {theme.thankYouMessage || 'Thank you!'}
          </p>
          {theme.showIncentivePoints && (
            <p style={{ color: theme.accentColor, fontSize: bodySizeMap[theme.bodySize], fontWeight: 500 }}>
              You earned loyalty points for your feedback!
            </p>
          )}
          {theme.thankYouRedirectUrl && (
            <p
              className="mt-2"
              style={{ color: `${theme.textColor}80`, fontSize: bodySizeMap[theme.bodySize] }}
            >
              Redirecting to: {theme.thankYouRedirectUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EditThemePage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const themeId = params.id as string

  const [theme, setTheme] = useState<ThemeForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(`${API_URL}/v1/themes/${themeId}`, { cache: 'no-store', headers })
        if (!res.ok) throw new Error('Theme not found')
        const data = await res.json()
        const t = data.theme ?? data
        setTheme({
          name: t.name ?? '',
          isDefault: t.isDefault ?? false,
          logoUrl: t.logoUrl ?? '',
          brandName: t.brandName ?? '',
          primaryColor: t.primaryColor ?? '#6366f1',
          secondaryColor: t.secondaryColor ?? '#8b5cf6',
          backgroundColor: t.backgroundColor ?? '#ffffff',
          textColor: t.textColor ?? '#1f2937',
          buttonColor: t.buttonColor ?? '#6366f1',
          buttonTextColor: t.buttonTextColor ?? '#ffffff',
          accentColor: t.accentColor ?? '#f59e0b',
          fontFamily: t.fontFamily ?? 'system-ui',
          headingSize: t.headingSize ?? 'md',
          bodySize: t.bodySize ?? 'md',
          cardStyle: t.cardStyle ?? 'shadow',
          borderRadius: t.borderRadius ?? 'md',
          maxWidth: t.maxWidth ?? 'md',
          thankYouMessage: t.thankYouMessage ?? 'Thank you for your feedback!',
          thankYouRedirectUrl: t.thankYouRedirectUrl ?? '',
          showIncentivePoints: t.showIncentivePoints ?? false,
        })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load theme')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, themeId])

  function update<K extends keyof ThemeForm>(key: K, value: ThemeForm[K]) {
    setTheme((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!theme || !theme.name.trim()) {
      setError('Theme name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const body = {
        ...theme,
        logoUrl: theme.logoUrl || null,
        brandName: theme.brandName || null,
        thankYouRedirectUrl: theme.thankYouRedirectUrl || null,
      }
      const res = await fetch(`${API_URL}/v1/themes/${themeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update theme')
      }
      router.push('/admin/settings/themes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update theme')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this theme?')) return
    setDeleting(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/themes/${themeId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete theme')
      }
      router.push('/admin/settings/themes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete theme')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSetDefault() {
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/themes/${themeId}/default`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to set as default')
      }
      update('isDefault', true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set as default')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading theme...</p>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 text-sm">{error || 'Theme not found'}</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Left panel - form */}
      <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900">Edit Theme</h1>
            {theme.isDefault && (
              <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                Default
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Brand */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name</label>
                <input
                  type="text"
                  value={theme.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="text"
                  value={theme.logoUrl}
                  onChange={(e) => update('logoUrl', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={theme.brandName}
                  onChange={(e) => update('brandName', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Your Company"
                />
              </div>
            </div>
          </section>

          {/* Colors */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Colors</h2>
            <div className="space-y-2.5">
              <ColorInput label="Primary" value={theme.primaryColor} onChange={(v) => update('primaryColor', v)} />
              <ColorInput label="Secondary" value={theme.secondaryColor} onChange={(v) => update('secondaryColor', v)} />
              <ColorInput label="Background" value={theme.backgroundColor} onChange={(v) => update('backgroundColor', v)} />
              <ColorInput label="Text" value={theme.textColor} onChange={(v) => update('textColor', v)} />
              <ColorInput label="Button" value={theme.buttonColor} onChange={(v) => update('buttonColor', v)} />
              <ColorInput label="Button Text" value={theme.buttonTextColor} onChange={(v) => update('buttonTextColor', v)} />
              <ColorInput label="Accent" value={theme.accentColor} onChange={(v) => update('accentColor', v)} />
            </div>
          </section>

          {/* Typography */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Typography</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={theme.fontFamily}
                  onChange={(e) => update('fontFamily', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {fontOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Heading Size</label>
                <ChipGroup options={['sm', 'md', 'lg']} value={theme.headingSize} onChange={(v) => update('headingSize', v)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Size</label>
                <ChipGroup options={['sm', 'md', 'lg']} value={theme.bodySize} onChange={(v) => update('bodySize', v)} />
              </div>
            </div>
          </section>

          {/* Layout */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Layout</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Card Style</label>
                <ChipGroup options={['flat', 'shadow', 'border']} value={theme.cardStyle} onChange={(v) => update('cardStyle', v)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Border Radius</label>
                <ChipGroup options={['none', 'sm', 'md', 'lg']} value={theme.borderRadius} onChange={(v) => update('borderRadius', v)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Width</label>
                <ChipGroup options={['sm', 'md', 'lg']} value={theme.maxWidth} onChange={(v) => update('maxWidth', v)} />
              </div>
            </div>
          </section>

          {/* Thank You */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Thank You</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={theme.thankYouMessage}
                  onChange={(e) => update('thankYouMessage', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL</label>
                <input
                  type="text"
                  value={theme.thankYouRedirectUrl}
                  onChange={(e) => update('thankYouRedirectUrl', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="https://..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.showIncentivePoints}
                  onChange={(e) => update('showIncentivePoints', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Show incentive points</span>
              </label>
            </div>
          </section>

          {/* Default toggle */}
          <section className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={theme.isDefault}
                onChange={(e) => update('isDefault', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Set as default theme</span>
            </label>
          </section>

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            {!theme.isDefault && (
              <button
                type="button"
                onClick={handleSetDefault}
                className="w-full rounded-lg border border-indigo-600 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Set as Default
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Theme'}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel - preview */}
      <SurveyPreview theme={theme} />
    </div>
  )
}
