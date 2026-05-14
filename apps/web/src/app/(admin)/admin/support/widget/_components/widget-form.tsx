'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import type { WidgetConfig, WidgetPosition } from './widget-preview'

interface WidgetFormProps {
  initial: WidgetConfig
  onChange: (config: WidgetConfig) => void
}

const POSITION_OPTIONS: { value: WidgetPosition; label: string; description: string }[] = [
  { value: 'BOTTOM_RIGHT', label: 'Bottom right', description: 'Launcher appears in the bottom-right corner' },
  { value: 'BOTTOM_LEFT', label: 'Bottom left', description: 'Launcher appears in the bottom-left corner' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

export function WidgetForm({ initial, onChange }: WidgetFormProps) {
  const { getToken } = useAuth()
  const [values, setValues] = useState<WidgetConfig>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    onChange(next)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      const body = {
        position: values.position,
        launcherIconUrl: values.launcherIconUrl || null,
        darkModeAuto: values.darkModeAuto,
        greeting: values.greeting,
        offlineMessage: values.offlineMessage,
        csatPromptText: values.csatPromptText,
        escalateButtonText: values.escalateButtonText,
        showCsatAfterAi: values.showCsatAfterAi,
        csatTimeoutSeconds: values.csatTimeoutSeconds,
        anonAllowed: values.anonAllowed,
      }

      const res = await fetch(`${API_URL}/v1/support/widget-config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
        setError(err.message ?? err.error ?? `Save failed (${res.status})`)
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50'
  const checkCls = 'h-4 w-4 rounded border-gray-300 accent-indigo-600'

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e) }}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-6"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Widget settings saved successfully.
        </div>
      )}

      {/* Position */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Launcher position</legend>
        <div className="space-y-2">
          {POSITION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <input
                type="radio"
                name="position"
                value={opt.value}
                checked={values.position === opt.value}
                onChange={() => update('position', opt.value)}
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                <span className="block text-xs text-gray-500">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Greeting */}
      <Field label="Greeting message" hint="First message the AI sends to visitors.">
        <textarea
          value={values.greeting}
          onChange={(e) => update('greeting', e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="Hi! How can we help?"
        />
      </Field>

      {/* Offline message */}
      <Field label="Offline message" hint="Shown when no agents are available.">
        <textarea
          value={values.offlineMessage}
          onChange={(e) => update('offlineMessage', e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="We're not online right now..."
        />
      </Field>

      {/* Launcher icon URL */}
      <Field label="Launcher icon URL" hint="Leave blank to use the default chat bubble icon.">
        <input
          type="url"
          value={values.launcherIconUrl ?? ''}
          onChange={(e) => update('launcherIconUrl', e.target.value || null)}
          className={inputCls}
          placeholder="https://example.com/icon.png"
        />
      </Field>

      {/* CSAT prompt text */}
      <Field label="CSAT prompt text" hint="Question shown after an AI response.">
        <input
          type="text"
          value={values.csatPromptText}
          onChange={(e) => update('csatPromptText', e.target.value)}
          className={inputCls}
          placeholder="Did this help?"
        />
      </Field>

      {/* Escalate button text */}
      <Field label="Escalate button text">
        <input
          type="text"
          value={values.escalateButtonText}
          onChange={(e) => update('escalateButtonText', e.target.value)}
          className={inputCls}
          placeholder="Talk to a human"
        />
      </Field>

      {/* CSAT timeout */}
      <Field
        label="CSAT timeout (seconds)"
        hint="How long before the CSAT prompt auto-dismisses. Must be between 5 and 600."
      >
        <input
          type="number"
          min={5}
          max={600}
          value={values.csatTimeoutSeconds}
          onChange={(e) => update('csatTimeoutSeconds', Math.min(600, Math.max(5, Number(e.target.value))))}
          className={inputCls}
        />
      </Field>

      {/* Checkboxes */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.showCsatAfterAi}
            onChange={(e) => update('showCsatAfterAi', e.target.checked)}
            className={`${checkCls} mt-0.5`}
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Show CSAT after AI response</span>
            <span className="block text-xs text-gray-500">
              Display a thumbs-up/thumbs-down prompt after the AI answers.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.darkModeAuto}
            onChange={(e) => update('darkModeAuto', e.target.checked)}
            className={`${checkCls} mt-0.5`}
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Auto dark mode</span>
            <span className="block text-xs text-gray-500">
              Switch to dark theme automatically based on the visitor's OS preference.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.anonAllowed}
            onChange={(e) => update('anonAllowed', e.target.checked)}
            className={`${checkCls} mt-0.5`}
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Allow anonymous visitors</span>
            <span className="block text-xs text-gray-500">
              Let visitors start a chat without signing in. An anonymous ID is stored in a cookie.
            </span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {submitting ? 'Saving…' : 'Save widget settings'}
      </button>
    </form>
  )
}
