// Issue #241 Slice 4b (#336) — LookFeelTab full impl (§J item 7).
//
// Surface per spec §2.3 / R17 / R18 / R19:
//   - Channel tabs (Standalone link / Embedded widget) — R17.
//   - Per channel: Desktop + Mobile previews rendered side-by-side — R17.
//   - Theme picker shows ALL brand themes (no count cap per R19); no
//     "Manage themes" link (RBAC — R19 + §E hide-vs-stub).
//   - Chrome matrix (3 rows × 2 cols per R18): logo / name / title toggles
//     for each channel propagate via onChange to settings.chromeMatrix.
//
// Defensive shape handling: survey.settings is nullable at the API layer
// (Slice 4a Cluster B). Initial chrome matrix falls back to
// DEFAULT_CHROME_MATRIX when settings or chromeMatrix is missing.

'use client'

import { useMemo, useState } from 'react'

import { PreviewSurvey } from '@/components/survey-form/PreviewSurvey'
import {
  DEFAULT_CHROME_MATRIX,
  type BrandThemeLite,
  type Channel,
  type ChromeMatrix,
  type SurveyResolved,
} from '@/components/survey-form/types'

import type {
  EditorBrand,
  EditorSurvey,
} from '../__fixtures__/editor-fixtures'

export interface LookFeelTabProps {
  survey: EditorSurvey
  brand: EditorBrand
  themes: BrandThemeLite[]
  onChange: (patch: { themeId?: string; settings?: Record<string, unknown> }) => void
  disabled: boolean
}

const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: 'standalone', label: '🔗 Standalone (link)' },
  { id: 'embedded', label: '🧩 Embedded (widget)' },
]

const CHROME_ROWS: Array<{ key: 'logo' | 'name' | 'title'; label: string }> = [
  { key: 'logo', label: 'Brand logo' },
  { key: 'name', label: 'Brand name' },
  { key: 'title', label: 'Survey title' },
]

function resolveChromeMatrix(survey: EditorSurvey): ChromeMatrix {
  return survey.settings?.chromeMatrix ?? DEFAULT_CHROME_MATRIX
}

function toSurveyResolved(survey: EditorSurvey, chromeMatrix: ChromeMatrix): SurveyResolved {
  // PreviewSurvey requires SurveyResolved (non-null settings). Coerce defensively
  // so a fresh draft with settings=null still previews.
  const base = survey.settings ?? {}
  return {
    ...survey,
    settings: { ...base, chromeMatrix },
  } as SurveyResolved
}

export function LookFeelTab({
  survey,
  brand,
  themes,
  onChange,
  disabled,
}: LookFeelTabProps) {
  const [activeChannel, setActiveChannel] = useState<Channel>('standalone')
  const [chromeMatrix, setChromeMatrix] = useState<ChromeMatrix>(() =>
    resolveChromeMatrix(survey),
  )
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(survey.themeId)

  const theme = useMemo<BrandThemeLite | null>(
    () => themes.find((t) => t.id === selectedThemeId) ?? themes[0] ?? null,
    [themes, selectedThemeId],
  )

  const previewSurvey = useMemo(
    () => toSurveyResolved(survey, chromeMatrix),
    [survey, chromeMatrix],
  )

  function handleThemeSelect(themeId: string) {
    if (disabled) return
    setSelectedThemeId(themeId)
    onChange({ themeId })
  }

  function handleChromeToggle(channel: Channel, row: 'logo' | 'name' | 'title') {
    if (disabled) return
    setChromeMatrix((prev) => {
      const next: ChromeMatrix = {
        standalone: { ...prev.standalone },
        embedded: { ...prev.embedded },
      }
      next[channel][row] = !prev[channel][row]
      onChange({ settings: { chromeMatrix: next } })
      return next
    })
  }

  return (
    <div className="space-y-6 p-4">
      <div
        role="tablist"
        aria-label="Channel"
        className="flex items-center gap-1 border-b border-gray-200"
      >
        {CHANNELS.map((c) => {
          const selected = c.id === activeChannel
          return (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActiveChannel(c.id)}
              className={`rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-x border-t border-gray-200 bg-white text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['desktop', 'mobile'] as const).map((viewport) => (
          <div
            key={viewport}
            data-testid={`preview-${viewport}`}
            data-channel={activeChannel}
            data-viewport={viewport}
            className="rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              {viewport === 'desktop' ? 'Desktop preview' : 'Mobile preview (375px)'}
            </p>
            {theme && (
              <PreviewSurvey
                survey={previewSurvey}
                theme={theme}
                brand={brand}
                channel={activeChannel}
                viewport={viewport}
                readOnly
              />
            )}
          </div>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Theme</legend>
        <p className="text-xs text-gray-500">
          Themes come from your brand library. To create or edit themes, go to Organization Settings.
        </p>
        <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-2">
          {themes.map((t) => {
            const selected = t.id === selectedThemeId
            return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  role="radio"
                  name="theme-picker"
                  value={t.id}
                  aria-label={t.name}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => handleThemeSelect(t.id)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: t.primaryColor }}
                  />
                  {t.name}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Chrome</legend>
        <p className="text-xs text-gray-500">
          Toggle which header elements appear in each channel.
        </p>
        <div
          data-testid="chrome-matrix"
          className="overflow-hidden rounded-md border border-gray-200"
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-center bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Element</span>
            <span className="px-3">Standalone</span>
            <span className="px-3">Embedded</span>
          </div>
          {CHROME_ROWS.map((row) => (
            <div
              key={row.key}
              data-row={row.key}
              className="grid grid-cols-[1fr_auto_auto] items-center border-t border-gray-100 px-3 py-2 text-sm"
            >
              <span className="text-gray-900">{row.label}</span>
              {(['standalone', 'embedded'] as Channel[]).map((channel) => (
                <label key={channel} className="flex items-center justify-center px-3">
                  <input
                    type="checkbox"
                    data-testid={`chrome-toggle-${channel}-${row.key}`}
                    aria-label={`${row.label} in ${channel} channel`}
                    checked={chromeMatrix[channel][row.key]}
                    disabled={disabled}
                    onChange={() => handleChromeToggle(channel, row.key)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
