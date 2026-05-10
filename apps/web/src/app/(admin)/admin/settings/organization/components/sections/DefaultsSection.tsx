'use client'

import { useFormContext } from 'react-hook-form'
import type { OrgFormValues } from '../../lib/types'

// Issue #292 Slice 4 — Defaults (timezone + locale). Spec §F15 / §F16.
// V0 surfaces are static; the picker sets a value into Brand.timezone /
// Brand.locale that downstream consumers (SLA reporting, alert escalation)
// will read once they ship.

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: '(UTC−07:00) America/Los_Angeles' },
  { value: 'America/Denver', label: '(UTC−06:00) America/Denver' },
  { value: 'America/Chicago', label: '(UTC−05:00) America/Chicago' },
  { value: 'America/New_York', label: '(UTC−04:00) America/New_York' },
  { value: 'UTC', label: '(UTC) UTC' },
  { value: 'Europe/London', label: '(UTC+01:00) Europe/London' },
  { value: 'Europe/Paris', label: '(UTC+02:00) Europe/Paris' },
  { value: 'Europe/Berlin', label: '(UTC+02:00) Europe/Berlin' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Asia/Tokyo' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Asia/Singapore' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Asia/Kolkata' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Australia/Sydney' },
]

const LOCALES = [
  { value: 'en-US', label: 'English (United States) — en-US' },
  { value: 'en-GB', label: 'English (United Kingdom) — en-GB' },
  { value: 'es-MX', label: 'Español (México) — es-MX' },
  { value: 'es-ES', label: 'Español (España) — es-ES' },
  { value: 'fr-FR', label: 'Français (France) — fr-FR' },
  { value: 'de-DE', label: 'Deutsch (Deutschland) — de-DE' },
  { value: 'pt-BR', label: 'Português (Brasil) — pt-BR' },
  { value: 'ja-JP', label: '日本語 (日本) — ja-JP' },
  { value: 'zh-CN', label: '中文 (简体) — zh-CN' },
  { value: 'it-IT', label: 'Italiano (Italia) — it-IT' },
  { value: 'nl-NL', label: 'Nederlands (Nederland) — nl-NL' },
  { value: 'ko-KR', label: '한국어 (대한민국) — ko-KR' },
]

export function DefaultsSection() {
  const { register, formState } = useFormContext<OrgFormValues>()
  const errors = formState.errors

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-gray-900">
          Time zone
        </label>
        <select
          id="timezone"
          aria-label="Time zone"
          {...register('timezone')}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p className="mt-1 text-xs font-medium text-red-600">{errors.timezone.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          SLA reporting, alerts, and admin timestamps. Defaults to your browser zone on first save.
        </p>
      </div>

      <div>
        <label htmlFor="locale" className="block text-sm font-medium text-gray-900">
          Locale
        </label>
        <select
          id="locale"
          aria-label="Locale"
          {...register('locale')}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {LOCALES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        {errors.locale && (
          <p className="mt-1 text-xs font-medium text-red-600">{errors.locale.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Default language for surveys, emails, and the member portal. Defaults to your browser
          language on first save.
        </p>
      </div>
    </div>
  )
}
