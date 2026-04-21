'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL } from '@/lib/config'

export interface ThemeFormInitialData {
  name?: string
  isDefault?: boolean
  logoUrl?: string | null
  brandName?: string | null
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  textColor?: string
  buttonColor?: string
  buttonTextColor?: string
  accentColor?: string
  fontFamily?: string
  headingSize?: 'sm' | 'md' | 'lg'
  bodySize?: 'sm' | 'md' | 'lg'
  cardStyle?: 'flat' | 'shadow' | 'border'
  borderRadius?: 'none' | 'sm' | 'md' | 'lg'
  maxWidth?: 'sm' | 'md' | 'lg'
  thankYouMessage?: string
  thankYouRedirectUrl?: string | null
  showIncentivePoints?: boolean
}

interface ThemeFormState {
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

const DEFAULT_THEME: ThemeFormState = {
  name: '',
  isDefault: false,
  logoUrl: '',
  brandName: '',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  accentColor: '#f59e0b',
  fontFamily: 'system-ui',
  headingSize: 'md',
  bodySize: 'md',
  cardStyle: 'shadow',
  borderRadius: 'md',
  maxWidth: 'md',
  thankYouMessage: 'Thank you for your feedback!',
  thankYouRedirectUrl: '',
  showIncentivePoints: false,
}

const FONT_OPTIONS = ['system-ui', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins']
const HEADING_SIZE_MAP: Record<string, string> = { sm: '1.125rem', md: '1.5rem', lg: '2rem' }
const BODY_SIZE_MAP: Record<string, string> = { sm: '0.8125rem', md: '0.9375rem', lg: '1.0625rem' }
const BORDER_RADIUS_MAP: Record<string, string> = { none: '0px', sm: '4px', md: '8px', lg: '16px' }
const MAX_WIDTH_MAP: Record<string, string> = { sm: '480px', md: '640px', lg: '800px' }

function fromInitialData(data: ThemeFormInitialData | undefined): ThemeFormState {
  if (!data) return DEFAULT_THEME
  return {
    name: data.name ?? '',
    isDefault: data.isDefault ?? false,
    logoUrl: data.logoUrl ?? '',
    brandName: data.brandName ?? '',
    primaryColor: data.primaryColor ?? '#6366f1',
    secondaryColor: data.secondaryColor ?? '#8b5cf6',
    backgroundColor: data.backgroundColor ?? '#ffffff',
    textColor: data.textColor ?? '#1f2937',
    buttonColor: data.buttonColor ?? '#6366f1',
    buttonTextColor: data.buttonTextColor ?? '#ffffff',
    accentColor: data.accentColor ?? '#f59e0b',
    fontFamily: data.fontFamily ?? 'system-ui',
    headingSize: data.headingSize ?? 'md',
    bodySize: data.bodySize ?? 'md',
    cardStyle: data.cardStyle ?? 'shadow',
    borderRadius: data.borderRadius ?? 'md',
    maxWidth: data.maxWidth ?? 'md',
    thankYouMessage: data.thankYouMessage ?? 'Thank you for your feedback!',
    thankYouRedirectUrl: data.thankYouRedirectUrl ?? '',
    showIncentivePoints: data.showIncentivePoints ?? false,
  }
}

function ColorInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-500"
        placeholder="#000000"
      />
      <span className="text-xs text-gray-500 w-28 truncate">{label}</span>
    </div>
  )
}

function ChipGroup<T extends string>({ options, value, onChange, disabled }: { options: T[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
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

function SurveyPreview({ theme }: { theme: ThemeFormState }) {
  const radius = BORDER_RADIUS_MAP[theme.borderRadius]
  const mw = MAX_WIDTH_MAP[theme.maxWidth]
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
          <span style={{ color: theme.textColor, fontSize: HEADING_SIZE_MAP[theme.headingSize], fontWeight: 700 }}>
            {theme.brandName || 'Brand Name'}
          </span>
        </div>

        <div
          className="mb-4 p-5"
          style={{ borderRadius: radius, boxShadow: cardShadow, border: cardBorder, backgroundColor: theme.backgroundColor }}
        >
          <p style={{ color: theme.textColor, fontSize: HEADING_SIZE_MAP[theme.headingSize], fontWeight: 600, marginBottom: '1rem' }}>
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
          <div className="flex justify-between mt-1.5" style={{ fontSize: BODY_SIZE_MAP[theme.bodySize], color: `${theme.textColor}99` }}>
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>

        <div
          className="mb-4 p-5"
          style={{ borderRadius: radius, boxShadow: cardShadow, border: cardBorder, backgroundColor: theme.backgroundColor }}
        >
          <p style={{ color: theme.textColor, fontSize: HEADING_SIZE_MAP[theme.headingSize], fontWeight: 600, marginBottom: '0.75rem' }}>
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
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
              fontSize: BODY_SIZE_MAP[theme.bodySize],
              fontFamily: theme.fontFamily,
            }}
          />
        </div>

        <div className="mb-6">
          <button
            type="button"
            className="px-6 py-2.5 text-sm font-medium transition-colors"
            style={{ borderRadius: radius, backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
          >
            Submit Feedback
          </button>
        </div>

        <div
          className="p-5"
          style={{ borderRadius: radius, boxShadow: cardShadow, border: cardBorder, backgroundColor: `${theme.accentColor}10` }}
        >
          <p style={{ color: theme.textColor, fontSize: HEADING_SIZE_MAP[theme.headingSize], fontWeight: 600, marginBottom: '0.5rem' }}>
            {theme.thankYouMessage || 'Thank you!'}
          </p>
          {theme.showIncentivePoints && (
            <p style={{ color: theme.accentColor, fontSize: BODY_SIZE_MAP[theme.bodySize], fontWeight: 500 }}>
              You earned loyalty points for your feedback!
            </p>
          )}
          {theme.thankYouRedirectUrl && (
            <p className="mt-2" style={{ color: `${theme.textColor}80`, fontSize: BODY_SIZE_MAP[theme.bodySize] }}>
              Redirecting to: {theme.thankYouRedirectUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface ThemeFormProps {
  mode: 'create' | 'edit' | 'view'
  themeId?: string
  initialData?: ThemeFormInitialData
}

export function ThemeForm({ mode, themeId, initialData }: ThemeFormProps) {
  const { getToken } = useAuth()
  const router = useRouter()
  const isViewOnly = mode === 'view'

  const [theme, setTheme] = useState<ThemeFormState>(() => fromInitialData(initialData))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) setTheme(fromInitialData(initialData))
  }, [initialData])

  function update<K extends keyof ThemeFormState>(key: K, value: ThemeFormState[K]) {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (isViewOnly) return
    if (!theme.name.trim()) {
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
      const url = mode === 'edit' ? `${API_URL}/v1/themes/${themeId}` : `${API_URL}/v1/themes`
      const method = mode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Failed to ${mode === 'edit' ? 'update' : 'create'} theme`)
      }
      router.push('/admin/settings/themes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'edit' ? 'update' : 'create'} theme`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (isViewOnly || mode !== 'edit' || !themeId) return
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
        throw new Error((data as { error?: string }).error ?? 'Failed to delete theme')
      }
      router.push('/admin/settings/themes')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete theme')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSetDefault() {
    if (isViewOnly || mode !== 'edit' || !themeId) return
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/v1/themes/${themeId}/default`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to set as default')
      }
      update('isDefault', true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set as default')
    }
  }

  const heading = mode === 'create' ? 'Create Theme' : mode === 'edit' ? 'Edit Theme' : 'Theme'

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <fieldset disabled={isViewOnly} className="border-0 p-0 m-0 min-w-0">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold text-gray-900">{heading}</h1>
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

            <section className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name</label>
                  <input
                    type="text"
                    value={theme.name}
                    onChange={(e) => update('name', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={theme.logoUrl}
                    onChange={(e) => update('logoUrl', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={theme.brandName}
                    onChange={(e) => update('brandName', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Your Company"
                  />
                </div>
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Colors</h2>
              <div className="space-y-2.5">
                <ColorInput label="Primary" value={theme.primaryColor} onChange={(v) => update('primaryColor', v)} disabled={isViewOnly} />
                <ColorInput label="Secondary" value={theme.secondaryColor} onChange={(v) => update('secondaryColor', v)} disabled={isViewOnly} />
                <ColorInput label="Background" value={theme.backgroundColor} onChange={(v) => update('backgroundColor', v)} disabled={isViewOnly} />
                <ColorInput label="Text" value={theme.textColor} onChange={(v) => update('textColor', v)} disabled={isViewOnly} />
                <ColorInput label="Button" value={theme.buttonColor} onChange={(v) => update('buttonColor', v)} disabled={isViewOnly} />
                <ColorInput label="Button Text" value={theme.buttonTextColor} onChange={(v) => update('buttonTextColor', v)} disabled={isViewOnly} />
                <ColorInput label="Accent" value={theme.accentColor} onChange={(v) => update('accentColor', v)} disabled={isViewOnly} />
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Typography</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                  <select
                    value={theme.fontFamily}
                    onChange={(e) => update('fontFamily', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Heading Size</label>
                  <ChipGroup options={['sm', 'md', 'lg']} value={theme.headingSize} onChange={(v) => update('headingSize', v)} disabled={isViewOnly} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Size</label>
                  <ChipGroup options={['sm', 'md', 'lg']} value={theme.bodySize} onChange={(v) => update('bodySize', v)} disabled={isViewOnly} />
                </div>
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Layout</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Card Style</label>
                  <ChipGroup options={['flat', 'shadow', 'border']} value={theme.cardStyle} onChange={(v) => update('cardStyle', v)} disabled={isViewOnly} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Border Radius</label>
                  <ChipGroup options={['none', 'sm', 'md', 'lg']} value={theme.borderRadius} onChange={(v) => update('borderRadius', v)} disabled={isViewOnly} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Width</label>
                  <ChipGroup options={['sm', 'md', 'lg']} value={theme.maxWidth} onChange={(v) => update('maxWidth', v)} disabled={isViewOnly} />
                </div>
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Thank You</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={theme.thankYouMessage}
                    onChange={(e) => update('thankYouMessage', e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL</label>
                  <input
                    type="text"
                    value={theme.thankYouRedirectUrl}
                    onChange={(e) => update('thankYouRedirectUrl', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="https://..."
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.showIncentivePoints}
                    onChange={(e) => update('showIncentivePoints', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  <span className="text-sm text-gray-700">Show incentive points</span>
                </label>
              </div>
            </section>

            <section className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.isDefault}
                  onChange={(e) => update('isDefault', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                />
                <span className="text-sm font-medium text-gray-700">Set as default theme</span>
              </label>
            </section>

            {!isViewOnly && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Save Theme'}
                </button>

                {mode === 'edit' && !theme.isDefault && (
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    className="w-full rounded-lg border border-indigo-600 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    Set as Default
                  </button>
                )}

                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Theme'}
                  </button>
                )}
              </div>
            )}
          </div>
        </fieldset>
      </div>

      <SurveyPreview theme={theme} />
    </div>
  )
}
