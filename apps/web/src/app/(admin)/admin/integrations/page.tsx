'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import {
  DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM,
  ExternalSignalSourceForm,
  type SourceType,
  type SyncMode,
} from './external-signal-source-form'

const WEBHOOKS = [
  {
    name: 'Salesforce',
    slug: 'salesforce',
    url: `${API_URL}/v1/integrations/webhooks/salesforce`,
    description: 'Configure this URL as a Salesforce workflow outbound message or apex callout.',
    badgeLabel: 'SF',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  {
    name: 'HubSpot',
    slug: 'hubspot',
    url: `${API_URL}/v1/integrations/webhooks/hubspot`,
    description: 'Use this URL in HubSpot workflow webhook actions to send CX events to CustomerEQ.',
    badgeLabel: 'HS',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
  },
] as const

interface ExternalSignalSource {
  id: string
  name: string
  sourceType: SourceType
  connectionMethod: string
  syncMode: SyncMode
  enabled: boolean
  healthStatus: string
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastImportCount: number | null
  lastError: string | null
  scopeConfig: Record<string, unknown>
  webhookPath: string
}

interface ExternalSignalPreview {
  externalId: string
  body: string
  summary: string | null
  rating: number | null
  sentiment: number | null
  topics: string[]
}

function parseJsonField(value: string): Record<string, unknown> {
  if (!value.trim()) return {}
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON config must be an object')
  }
  return parsed as Record<string, unknown>
}

function CopyButton({ value, testId }: { value: string; testId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard failures in unsupported environments.
    }
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={handleCopy}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className =
    normalized === 'healthy'
      ? 'bg-green-100 text-green-700'
      : normalized === 'error'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-700'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function IntegrationsPage() {
  const { getToken } = useAuth()
  const [sources, setSources] = useState<ExternalSignalSource[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ExternalSignalPreview[]>([])
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM)

  async function getHeaders() {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  async function loadSources() {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources?page=1&pageSize=50`, {
        headers,
      })
      if (!res.ok) throw new Error('Failed to load external signal sources')
      const json = await res.json()
      setSources(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load external signal sources')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSources()
  }, [])

  const formHint =
    form.syncMode === 'WEBHOOK'
      ? 'Webhook sources can ingest immediately via the generated source URL.'
      : form.syncMode === 'POLL'
        ? 'Polling sources use samplePayloads for the initial implementation path.'
        : 'Manual sources can be previewed and synced on demand.'

  async function handleCreateSource(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const headers = await getHeaders()
      const payload = {
        name: form.name.trim(),
        sourceType: form.sourceType,
        connectionMethod: form.connectionMethod.trim(),
        syncMode: form.syncMode,
        enabled: form.enabled,
        scopeConfig: parseJsonField(form.scopeConfig),
        filterConfig: parseJsonField(form.filterConfig),
        matchingConfig: parseJsonField(form.matchingConfig),
        credentialRef: form.credentialRef.trim() || null,
      }

      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? body.message ?? 'Failed to create source')
      }

      setForm(DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM)
      setMessage('Source created')
      await loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTestSource(sourceId: string) {
    setError(null)
    setMessage(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources/${sourceId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to test source')
      const json = await res.json()
      setPreview(json.samples ?? [])
      setPreviewSourceId(sourceId)
      setMessage('Connection test returned preview data')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test source')
    }
  }

  async function handleSyncSource(sourceId: string) {
    setError(null)
    setMessage(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources/${sourceId}/sync`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Failed to queue source sync')
      setMessage('Source sync queued')
      await loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue source sync')
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure inbound CX webhooks and brand-scoped review or social signal sources.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-4">
        {WEBHOOKS.map((webhook) => (
          <div key={webhook.slug} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${webhook.badgeBg}`}>
                    <span className={`${webhook.badgeText} text-xs font-bold`}>{webhook.badgeLabel}</span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{webhook.name}</h2>
                </div>
                <p className="mb-3 text-xs text-gray-500">{webhook.description}</p>
                <code
                  data-testid={`webhook-url-${webhook.slug}`}
                  className="block break-all rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-800"
                >
                  {webhook.url}
                </code>
              </div>
              <div className="mt-10 shrink-0">
                <CopyButton value={webhook.url} testId={`copy-webhook-${webhook.slug}`} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Review and Social Sources</h2>
              <p className="mt-1 text-sm text-gray-500">
                Brand-scoped registry for external review, owned social, and webhook-backed sources.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {sources.length} configured
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No external sources configured yet.
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div
                  key={source.id}
                  data-testid={`external-source-row-${source.id}`}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{source.name}</h3>
                        <StatusBadge status={source.healthStatus} />
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                          {source.sourceType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {source.connectionMethod} via {source.syncMode.toLowerCase()} {source.enabled ? '- active' : '- paused'}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        Last sync: {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'never'} - Last import: {source.lastImportCount ?? 0}
                      </p>
                      {source.lastError && (
                        <p className="mt-2 text-xs text-red-600">{source.lastError}</p>
                      )}
                      <code className="mt-3 block break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                        {API_URL}
                        {source.webhookPath}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={`${API_URL}${source.webhookPath}`} testId={`copy-source-${source.id}`} />
                      <button
                        type="button"
                        data-testid={`test-source-${source.id}`}
                        onClick={() => void handleTestSource(source.id)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        data-testid={`sync-source-${source.id}`}
                        onClick={() => void handleSyncSource(source.id)}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        Sync now
                      </button>
                    </div>
                  </div>

                  {previewSourceId === source.id && preview.length > 0 && (
                    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <h4 className="text-sm font-semibold text-indigo-900">Test connection preview</h4>
                      <div className="mt-3 space-y-3">
                        {preview.map((item) => (
                          <div key={item.externalId} className="rounded-lg border border-indigo-100 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-indigo-700">{item.externalId}</span>
                              {item.rating != null && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  rating {item.rating}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-gray-700">{item.body}</p>
                            {item.topics.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.topics.map((topic) => (
                                  <span key={topic} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Add Source</h2>
          <p className="mt-1 text-sm text-gray-500">
            Use sample payloads in `scopeConfig` for preview and manual sync during the initial rollout.
          </p>

          <ExternalSignalSourceForm
            form={form}
            formHint={formHint}
            submitting={submitting}
            setForm={setForm}
            onSubmit={handleCreateSource}
          />
        </div>
      </section>
    </div>
  )
}
