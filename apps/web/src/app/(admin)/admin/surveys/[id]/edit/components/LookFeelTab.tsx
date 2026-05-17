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

import { FALLBACK_RESPONDENT_THEME } from '@customerEQ/shared'

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
  /** Canonical brand-default theme id (Brand.defaultThemeId via GET /v1/themes).
   *  Used to (a) preselect when survey.themeId is null and (b) badge the right
   *  theme card. Falls back to themes[0]?.id only if the brand has no default
   *  configured. */
  defaultThemeId?: string | null
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
  defaultThemeId,
  onChange,
  disabled,
}: LookFeelTabProps) {
  const [activeChannel, setActiveChannel] = useState<Channel>('standalone')
  const [chromeMatrix, setChromeMatrix] = useState<ChromeMatrix>(() =>
    resolveChromeMatrix(survey),
  )
  // Preselect order: explicit survey.themeId → brand default → first theme in
  // the library (only used if the brand has no default set yet). GET /v1/themes
  // orders themes by createdAt desc, so themes[0] is the most recent theme
  // and is NOT a reliable default — we read Brand.defaultThemeId instead.
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(
    survey.themeId ?? defaultThemeId ?? themes[0]?.id ?? null,
  )

  const theme = useMemo<BrandThemeLite | null>(
    () => themes.find((t) => t.id === selectedThemeId) ?? themes[0] ?? null,
    [themes, selectedThemeId],
  )

  // Issue #405 — same fallback chain the public renderer uses
  // (`apps/api/src/routes/public.ts` GET handler). When the brand has no
  // themes seeded, the editor preview falls back to the canonical
  // CustomerEQ default (`FALLBACK_RESPONDENT_THEME` from @customerEQ/shared,
  // same source of truth as the seed payload). This unblocks the marketing-
  // manager / survey-creator role: they can iterate on a real preview
  // without waiting on an admin to seed themes. Once an admin seeds, the
  // selected theme takes over.
  const previewTheme: BrandThemeLite = theme ?? FALLBACK_RESPONDENT_THEME

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
    const next: ChromeMatrix = {
      standalone: { ...chromeMatrix.standalone },
      embedded: { ...chromeMatrix.embedded },
    }
    next[channel][row] = !chromeMatrix[channel][row]
    setChromeMatrix(next)
    // Preserve other settings keys (e.g. future ones) when patching chromeMatrix.
    onChange({ settings: { ...(survey.settings ?? {}), chromeMatrix: next } })
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

      {/* Issue #405 — informational banner when the brand has no themes
          configured (pre-#307 brands like ArtistOS, or any future path that
          failed to seed). NOT blocking: the preview below still renders
          using the CustomerEQ default theme (same `FALLBACK_RESPONDENT_THEME`
          the public renderer uses as its third-tier fallback). RBAC-neutral
          copy — survey-creator role may not have access to Organization
          Settings, so we point at the admin role rather than deeplinking. */}
      {themes.length === 0 && (
        <div
          data-testid="themes-empty-state"
          role="status"
          className="rounded-md border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900"
        >
          <p className="font-medium">
            There are no themes defined for your brand. Defaulting to the
            CustomerEQ default theme.
          </p>
          <p className="mt-1">
            Themes can be set by administrators in <strong>Settings → Organization</strong>.
          </p>
        </div>
      )}

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
            <PreviewSurvey
              survey={previewSurvey}
              theme={previewTheme}
              brand={brand}
              channel={activeChannel}
              viewport={viewport}
              readOnly
            />
          </div>
        ))}
      </div>

      {/* Issue #405 — Theme picker only renders when there are themes to
          pick from. When themes=[] the preview above falls back to the
          CustomerEQ default theme and no per-survey override is possible
          until an admin seeds brand themes. */}
      {themes.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-900">Theme</legend>
            <p className="text-xs text-gray-500">
              Pick from any theme defined for your brand. The brand&apos;s default
              theme is selected automatically; you can override per survey.
            </p>
            {/* Color-swatch cards per mock §241 lines 884-917. */}
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
            >
              {themes.map((t) => {
                const selected = t.id === selectedThemeId
                const isBrandDefault =
                  defaultThemeId !== null && defaultThemeId !== undefined && t.id === defaultThemeId
                return (
                  <label
                    key={t.id}
                    data-testid={`theme-card-${t.id}`}
                    className={`flex flex-col gap-1.5 rounded-lg border bg-white px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
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
                      className="sr-only"
                    />
                    <span aria-hidden="true" className="flex gap-1">
                      <span
                        className="h-[18px] w-[18px] rounded"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                      <span
                        className="h-[18px] w-[18px] rounded"
                        style={{ backgroundColor: t.backgroundColor }}
                      />
                      <span
                        className="h-[18px] w-[18px] rounded"
                        style={{ backgroundColor: t.textColor }}
                      />
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                    <span className="text-[11px] text-gray-500">{t.fontFamily}</span>
                    {isBrandDefault && (
                      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600">
                        Brand default
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Chrome</legend>
        <p className="text-xs text-gray-500">
          Toggle which header elements appear in each channel.
        </p>
        {/* Use a real <table> so headers and toggle cells share column widths
            by browser layout — same approach the mock §241 lines 924-947
            uses. Off state contrasts against the row background (gray-400
            track + white knob) so the off pill is still visible. */}
        <table
          data-testid="chrome-matrix"
          className="w-full overflow-hidden rounded-md border border-gray-200 text-sm"
        >
          <thead>
            <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 text-left font-medium">Element</th>
              <th className="px-3 py-2 text-center font-medium">Standalone (link)</th>
              <th className="px-3 py-2 text-center font-medium">Embedded (widget)</th>
            </tr>
          </thead>
          <tbody>
            {CHROME_ROWS.map((row) => (
              <tr key={row.key} data-row={row.key} className="border-t border-gray-100">
                <td className="px-3 py-2.5 text-gray-900">{row.label}</td>
                {(['standalone', 'embedded'] as Channel[]).map((channel) => {
                  const on = chromeMatrix[channel][row.key]
                  return (
                    <td key={channel} className="px-3 py-2.5 text-center">
                      <label
                        className={`inline-flex items-center ${
                          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          data-testid={`chrome-toggle-${channel}-${row.key}`}
                          aria-label={`${row.label} in ${channel} channel`}
                          checked={on}
                          disabled={disabled}
                          onChange={() => handleChromeToggle(channel, row.key)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`relative inline-block h-[18px] w-[32px] rounded-full transition-colors ${
                            on ? 'bg-indigo-600' : 'bg-gray-400'
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-[left] ${
                              on ? 'left-[16px]' : 'left-[2px]'
                            }`}
                          />
                        </span>
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
    </div>
  )
}
