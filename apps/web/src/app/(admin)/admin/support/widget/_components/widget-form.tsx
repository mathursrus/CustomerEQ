'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import type { WidgetConfig, WidgetPosition } from './widget-preview'

interface WidgetFormProps {
  initial: WidgetConfig
  onChange: (config: WidgetConfig) => void
}

const POSITION_OPTIONS: { value: WidgetPosition; label: string }[] = [
  { value: 'BOTTOM_RIGHT', label: 'Bottom right' },
  { value: 'BOTTOM_LEFT', label: 'Bottom left' },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[12.5px] font-semibold text-gray-700">{children}</label>
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] text-gray-500">{children}</p>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">
      {title}
    </h3>
  )
}

const inputCls =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

interface SegmentedProps {
  value: WidgetPosition
  onChange: (v: WidgetPosition) => void
}

function Segmented({ value, onChange }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Launcher position"
      className="inline-flex gap-0.5 rounded-md border border-gray-300 bg-gray-50 p-0.5"
    >
      {POSITION_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded px-3 py-1.5 text-[12.5px] font-medium transition ${
              active
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

interface ToggleProps {
  label: string
  help: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, help, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 hover:border-gray-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`relative mt-0.5 inline-block h-[18px] w-[30px] shrink-0 rounded-full transition ${
          checked ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition ${
            checked ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="leading-tight">
        <span className="block text-[12.5px] font-semibold text-gray-900">{label}</span>
        <span className="block text-[11.5px] text-gray-500">{help}</span>
      </span>
    </label>
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

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e) }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {error && (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Launcher */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="mb-2.5"><SectionHeader title="Launcher" /></div>
        <div className="grid grid-cols-[1.2fr_1fr_0.7fr] gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Position</FieldLabel>
            <Segmented value={values.position} onChange={(v) => update('position', v)} />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Launcher icon URL</FieldLabel>
            <input
              type="url"
              value={values.launcherIconUrl ?? ''}
              onChange={(e) => update('launcherIconUrl', e.target.value || null)}
              className={inputCls}
              placeholder="https://example.com/icon.png"
            />
            <Help>Leave blank for default chat-bubble icon.</Help>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>CSAT timeout</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={600}
                value={values.csatTimeoutSeconds}
                onChange={(e) => update('csatTimeoutSeconds', Math.min(600, Math.max(5, Number(e.target.value))))}
                className={`${inputCls} max-w-[90px]`}
              />
              <Help>sec (5–600)</Help>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="mb-2.5"><SectionHeader title="Messages" /></div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Greeting message</FieldLabel>
            <textarea
              value={values.greeting}
              onChange={(e) => update('greeting', e.target.value)}
              rows={2}
              className={`${inputCls} min-h-[60px] resize-y`}
              placeholder="Hi! How can we help?"
            />
            <Help>First message the AI sends to visitors.</Help>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Offline message</FieldLabel>
            <textarea
              value={values.offlineMessage}
              onChange={(e) => update('offlineMessage', e.target.value)}
              rows={2}
              className={`${inputCls} min-h-[60px] resize-y`}
              placeholder="We're not online right now..."
            />
            <Help>Shown when no agents are available.</Help>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>CSAT prompt text</FieldLabel>
            <input
              type="text"
              value={values.csatPromptText}
              onChange={(e) => update('csatPromptText', e.target.value)}
              className={inputCls}
              placeholder="Did this help?"
            />
            <Help>Question shown after an AI response.</Help>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Escalate button text</FieldLabel>
            <input
              type="text"
              value={values.escalateButtonText}
              onChange={(e) => update('escalateButtonText', e.target.value)}
              className={inputCls}
              placeholder="Talk to a human"
            />
            <Help>Label for the human-handoff button.</Help>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="mb-2.5"><SectionHeader title="Behavior" /></div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          <Toggle
            label="Show CSAT after AI response"
            help="Display thumbs-up/down after AI answers."
            checked={values.showCsatAfterAi}
            onChange={(v) => update('showCsatAfterAi', v)}
          />
          <Toggle
            label="Auto dark mode"
            help="Match the visitor's OS preference."
            checked={values.darkModeAuto}
            onChange={(v) => update('darkModeAuto', v)}
          />
          <Toggle
            label="Allow anonymous visitors"
            help="Let visitors chat without signing in."
            checked={values.anonAllowed}
            onChange={(v) => update('anonAllowed', v)}
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 bg-gray-50 px-5 py-3">
        <span
          className={`inline-flex items-center gap-1.5 text-[12px] ${success ? 'text-green-700' : 'text-gray-500'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${success ? 'bg-green-500' : 'bg-gray-300'}`}
          />
          {success ? 'Saved' : 'Unsaved changes'}
        </span>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save widget settings'}
        </button>
      </div>
    </form>
  )
}
