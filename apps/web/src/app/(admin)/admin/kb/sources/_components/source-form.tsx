'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

type KBSourceKind = 'MANUAL' | 'URL' | 'SITEMAP'
type KBSourceStatus = 'ACTIVE' | 'DISABLED'

export interface KBSource {
  id: string
  kind: KBSourceKind
  url: string | null
  title: string
  status: KBSourceStatus
  crawlCron: string | null
}

export interface SourceFormProps {
  mode: 'create' | 'edit' | 'view'
  initial?: KBSource
  onSuccess?: () => void
}

const KIND_OPTIONS: { value: KBSourceKind; label: string; description: string }[] = [
  { value: 'MANUAL', label: 'Manual', description: 'Articles added manually via the KB editor' },
  { value: 'URL', label: 'URL', description: 'Crawl a single web page' },
  { value: 'SITEMAP', label: 'Sitemap', description: 'Crawl all URLs listed in a sitemap.xml' },
]

const STATUS_OPTIONS: { value: KBSourceStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
]

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  )
}

export function SourceForm({ mode, initial, onSuccess }: SourceFormProps) {
  const { getToken } = useAuth()
  const router = useRouter()

  const [kind, setKind] = useState<KBSourceKind>(initial?.kind ?? 'MANUAL')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [crawlCron, setCrawlCron] = useState(initial?.crawlCron ?? '')
  const [status, setStatus] = useState<KBSourceStatus>(initial?.status ?? 'ACTIVE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isView = mode === 'view'
  const needsUrl = kind === 'URL' || kind === 'SITEMAP'

  function validate(): boolean {
    const errors: Record<string, string> = {}
    if (!title.trim()) errors.title = 'Title is required'
    if (needsUrl && !url.trim()) errors.url = 'URL is required for this source kind'
    if (url.trim() && needsUrl) {
      try {
        new URL(url.trim())
      } catch {
        errors.url = 'Please enter a valid URL (e.g. https://example.com)'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setError(null)

    try {
      const token = await getAuthToken(getToken)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      const body: Record<string, string | null | undefined> = {
        title: title.trim(),
        status,
        crawlCron: crawlCron.trim() || null,
      }

      if (mode === 'create') {
        body.kind = kind
        if (needsUrl) body.url = url.trim() || null
      } else {
        // edit: kind is immutable; only send mutable fields
        if (needsUrl) body.url = url.trim() || null
      }

      const endpoint =
        mode === 'create'
          ? `${API_URL}/v1/kb/sources`
          : `${API_URL}/v1/kb/sources/${initial!.id}`

      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(body) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
        setError(err.message ?? err.error ?? `Request failed (${res.status})`)
        return
      }

      if (onSuccess) {
        onSuccess()
      } else if (mode === 'create') {
        router.push('/admin/kb/sources')
      } else {
        router.push(`/admin/kb/sources/${initial!.id}`)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------- View mode ---------- */
  if (isView && initial) {
    return (
      <dl className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <ReadOnlyField label="Title" value={initial.title} />
        <ReadOnlyField label="Kind" value={initial.kind} />
        <ReadOnlyField label="URL" value={initial.url} />
        <ReadOnlyField label="Status" value={initial.status} />
        <ReadOnlyField label="Crawl Schedule" value={initial.crawlCron} />
      </dl>
    )
  }

  /* ---------- Create / Edit mode ---------- */
  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Kind — only shown in create mode */}
      {mode === 'create' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">
            Source Kind <span className="text-red-500">*</span>
          </legend>
          <div className="space-y-2">
            {KIND_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  name="kind"
                  value={opt.value}
                  checked={kind === opt.value}
                  onChange={() => { setKind(opt.value); setFieldErrors({}) }}
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
      )}

      {/* Title */}
      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setFieldErrors((p) => ({ ...p, title: '' })) }}
          placeholder="e.g. Product Documentation"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {fieldErrors.title && (
          <p className="text-xs text-red-600">{fieldErrors.title}</p>
        )}
      </div>

      {/* URL — shown only for URL/SITEMAP kinds */}
      {needsUrl && (
        <div className="space-y-1">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">
            URL <span className="text-red-500">*</span>
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setFieldErrors((p) => ({ ...p, url: '' })) }}
            placeholder={kind === 'SITEMAP' ? 'https://example.com/sitemap.xml' : 'https://example.com/docs/page'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {fieldErrors.url && (
            <p className="text-xs text-red-600">{fieldErrors.url}</p>
          )}
        </div>
      )}

      {/* Crawl Cron */}
      <div className="space-y-1">
        <label htmlFor="crawlCron" className="block text-sm font-medium text-gray-700">
          Crawl Schedule
        </label>
        <input
          id="crawlCron"
          type="text"
          value={crawlCron}
          onChange={(e) => setCrawlCron(e.target.value)}
          placeholder="0 2 * * *"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <p className="text-xs text-gray-500">
          Cron expression for scheduled crawls (e.g., &ldquo;0 2 * * *&rdquo; for daily at 2 AM). Leave blank for manual crawl only.
        </p>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as KBSourceStatus)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Source' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
