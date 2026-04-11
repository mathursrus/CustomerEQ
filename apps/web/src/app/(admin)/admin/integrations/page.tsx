'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
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
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
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
      : normalized === 'error' || normalized === 'auth_error'
        ? 'bg-red-100 text-red-700'
        : normalized === 'pending'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-700'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const PROVIDER_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  GOOGLE_BUSINESS_PROFILE: { label: 'G', bg: 'bg-blue-100', text: 'text-blue-700' },
  LINKEDIN_ORG: { label: 'Li', bg: 'bg-sky-100', text: 'text-sky-700' },
  REDDIT: { label: 'R', bg: 'bg-orange-100', text: 'text-orange-700' },
  X: { label: 'X', bg: 'bg-gray-900', text: 'text-white' },
  GENERIC_WEBHOOK: { label: 'WH', bg: 'bg-gray-100', text: 'text-gray-700' },
  GENERIC_API: { label: 'API', bg: 'bg-purple-100', text: 'text-purple-700' },
}

function ProviderBadge({ sourceType }: { sourceType: string }) {
  const badge = PROVIDER_BADGES[sourceType] ?? { label: '?', bg: 'bg-gray-100', text: 'text-gray-700' }
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${badge.bg}`}>
      <span className={`${badge.text} text-[10px] font-bold`}>{badge.label}</span>
    </div>
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
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [actionSourceId, setActionSourceId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [googleLocations, setGoogleLocations] = useState<Array<{ accountId: string; accountName: string; locationId: string; locationName: string; address: string }>>([])
  const [loadingLocations, setLoadingLocations] = useState(false)

  // Provider-specific form state
  const [redditForm, setRedditForm] = useState({ name: '', mode: 'search' as 'search' | 'subreddit', subreddits: '', keywords: '' })
  // X form disabled — paid API, coming soon
  // const [xForm, setXForm] = useState({ name: '', searchQuery: '' })
  const [googleForm, setGoogleForm] = useState({ name: '' })
  const [linkedinForm, setLinkedinForm] = useState({ name: '', organizationUrn: '' })

  // Check for OAuth callback params
  const searchParams = useSearchParams()
  const connectedProvider = searchParams.get('connected')
  const connectedSourceId = searchParams.get('sourceId')
  const oauthError = searchParams.get('error')

  async function getHeaders() {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  async function loadSources(): Promise<ExternalSignalSource[]> {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources?page=1&pageSize=50`, {
        headers,
      })
      if (!res.ok) throw new Error('Failed to load external signal sources')
      const json = await res.json()
      const data = (json.data ?? []) as ExternalSignalSource[]
      setSources(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load external signal sources')
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSources()
  }, [])

  async function loadGoogleLocationsForSource(sourceId: string) {
    setLoadingLocations(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/integrations/oauth/google/locations?sourceId=${sourceId}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load locations')
      }
      const data = await res.json()
      setGoogleLocations(data.locations ?? [])
      return data.locations as Array<{ accountId: string; accountName: string; locationId: string; locationName: string; address: string }>
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Google Business locations')
      return []
    } finally {
      setLoadingLocations(false)
    }
  }

  // After OAuth callback, auto-open the connected source's edit panel with locations loaded.
  useEffect(() => {
    if (connectedProvider && connectedSourceId) {
      setMessage(`${connectedProvider.charAt(0).toUpperCase() + connectedProvider.slice(1)} account connected — pick a location to start syncing`)
      void (async () => {
        const freshSources = await loadSources()
        const justConnected = freshSources.find((s) => s.id === connectedSourceId)
        if (justConnected && connectedProvider === 'google') {
          beginEdit(justConnected)
          const locations = await loadGoogleLocationsForSource(justConnected.id)
          if (locations.length === 1) {
            const loc = locations[0]
            setEditForm((f) => ({
              ...f,
              accountId: loc.accountId,
              locationId: loc.locationId,
              locationLabel: loc.locationName,
            }))
          }
        }
      })()
    } else if (connectedProvider) {
      setMessage(`${connectedProvider.charAt(0).toUpperCase() + connectedProvider.slice(1)} account connected successfully`)
      void loadSources()
    }
    if (oauthError) {
      setError(`OAuth connection failed: ${oauthError}`)
    }
  }, [connectedProvider, connectedSourceId, oauthError])

  const formHint =
    form.syncMode === 'WEBHOOK'
      ? 'Webhook sources can ingest immediately via the generated source URL.'
      : form.syncMode === 'POLL'
        ? 'Polling sources use samplePayloads for the initial implementation path.'
        : 'Manual sources can be previewed and synced on demand.'

  async function createProviderSource(
    sourceType: SourceType,
    name: string,
    scopeConfig: Record<string, unknown>,
    opts?: { redirectToOAuth?: boolean },
  ) {
    setSubmitting(sourceType)
    setMessage(null)
    setError(null)
    try {
      const headers = await getHeaders()
      const payload = {
        name: name.trim(),
        sourceType,
        connectionMethod: sourceType === 'GOOGLE_BUSINESS_PROFILE' || sourceType === 'LINKEDIN_ORG' ? 'oauth' : 'platform_credentials',
        syncMode: 'POLL' as SyncMode,
        enabled: sourceType !== 'GOOGLE_BUSINESS_PROFILE' && sourceType !== 'LINKEDIN_ORG',
        scopeConfig,
      }
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? body.message ?? 'Failed to create source')
      }
      const created = await res.json()

      if (opts?.redirectToOAuth && created.id) {
        const provider = sourceType === 'GOOGLE_BUSINESS_PROFILE' ? 'google' : 'linkedin'
        // Fetch the OAuth authorize URL via authenticated API call, then redirect
        const authRes = await fetch(
          `${API_URL}/v1/admin/integrations/oauth/${provider}/authorize?sourceId=${created.id}`,
          { headers, redirect: 'manual' },
        )
        // The API returns a 302 — extract the Location header
        // But fetch with redirect:'manual' gives us an opaque redirect response in browsers.
        // Instead, have the API return the URL as JSON.
        if (!authRes.ok && authRes.status !== 302) {
          const body = await authRes.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to start OAuth flow')
        }
        const authData = await authRes.json().catch(() => null)
        if (authData?.authorizationUrl) {
          window.location.href = authData.authorizationUrl
          return
        }
        throw new Error('Failed to get OAuth authorization URL')
      }

      setMessage('Source created and enabled')
      await loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source')
    } finally {
      setSubmitting(null)
    }
  }

  async function handleCreateSource(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting('GENERIC')
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
      setSubmitting(null)
    }
  }

  async function handleTestSource(sourceId: string) {
    setError(null)
    setMessage(null)
    setActionSourceId(sourceId)
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
    } finally {
      setActionSourceId(null)
    }
  }

  async function handleSyncSource(sourceId: string) {
    setError(null)
    setMessage(null)
    setActionSourceId(sourceId)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources/${sourceId}/sync`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Failed to queue source sync')
      setMessage('Source sync queued')
      setSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, lastSyncAt: new Date().toISOString() } : s))
      void loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue source sync')
    } finally {
      setActionSourceId(null)
    }
  }

  function beginEdit(source: ExternalSignalSource) {
    const sc = source.scopeConfig ?? {}
    const fields: Record<string, string> = { name: source.name, enabled: String(source.enabled) }

    if (source.sourceType === 'REDDIT') {
      fields.mode = (sc.mode as string) ?? 'search'
      fields.subreddits = Array.isArray(sc.subreddits) ? (sc.subreddits as string[]).join(', ') : ''
      fields.keywords = Array.isArray(sc.keywords) ? (sc.keywords as string[]).join(', ') : ''
    } else if (source.sourceType === 'X') {
      fields.searchQuery = (sc.searchQuery as string) ?? ''
    } else if (source.sourceType === 'GOOGLE_BUSINESS_PROFILE') {
      fields.accountId = (sc.accountId as string) ?? ''
      fields.locationId = (sc.locationId as string) ?? ''
      fields.locationLabel = (sc.locationLabel as string) ?? ''
    } else if (source.sourceType === 'LINKEDIN_ORG') {
      fields.organizationUrn = (sc.organizationUrn as string) ?? ''
    }

    setEditForm(fields)
    setEditingSourceId(source.id)
  }

  async function handleSaveEdit(source: ExternalSignalSource) {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const headers = await getHeaders()
      const sc = { ...(source.scopeConfig ?? {}) }

      if (source.sourceType === 'REDDIT') {
        sc.mode = editForm.mode
        sc.subreddits = editForm.subreddits?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? []
        sc.keywords = editForm.keywords?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? []
      } else if (source.sourceType === 'X') {
        sc.searchQuery = editForm.searchQuery?.trim()
      } else if (source.sourceType === 'GOOGLE_BUSINESS_PROFILE') {
        sc.accountId = editForm.accountId?.trim()
        sc.locationId = editForm.locationId?.trim()
        sc.locationLabel = editForm.locationLabel?.trim()
      } else if (source.sourceType === 'LINKEDIN_ORG') {
        sc.organizationUrn = editForm.organizationUrn?.trim()
      }

      const payload: Record<string, unknown> = {
        name: editForm.name?.trim(),
        enabled: editForm.enabled === 'true',
        scopeConfig: sc,
      }

      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to update source')
      }
      setEditingSourceId(null)
      setMessage('Source updated')
      await loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSource(sourceId: string, sourceName: string) {
    if (!confirm(`Delete "${sourceName}" and all its imported signals? This cannot be undone.`)) return
    setError(null)
    setMessage(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API_URL}/v1/admin/external-signal-sources/${sourceId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Failed to delete source')
      setMessage('Source deleted')
      setEditingSourceId(null)
      await loadSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source')
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
              <div className="shrink-0 self-end">
                <CopyButton value={webhook.url} testId={`copy-webhook-${webhook.slug}`} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
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
                        <ProviderBadge sourceType={source.sourceType} />
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
                      {(source.sourceType === 'GENERIC_WEBHOOK' || source.sourceType === 'GENERIC_API') && (
                        <code className="mt-3 block break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          {`${API_URL}${source.webhookPath}`}
                        </code>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(source.sourceType === 'GENERIC_WEBHOOK' || source.sourceType === 'GENERIC_API') && (
                        <CopyButton value={`${API_URL}${source.webhookPath}`} testId={`copy-source-${source.id}`} />
                      )}
                      <button
                        type="button"
                        onClick={() => editingSourceId === source.id ? setEditingSourceId(null) : beginEdit(source)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {editingSourceId === source.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        data-testid={`test-source-${source.id}`}
                        disabled={actionSourceId === source.id}
                        onClick={() => void handleTestSource(source.id)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {actionSourceId === source.id ? 'Testing...' : 'Test'}
                      </button>
                      {(() => {
                        const sc = (source.scopeConfig ?? {}) as Record<string, unknown>
                        const needsLocation = source.sourceType === 'GOOGLE_BUSINESS_PROFILE' && (!sc.locationId || !sc.accountId)
                        const needsOrg = source.sourceType === 'LINKEDIN_ORG' && !sc.organizationUrn
                        const notReady = needsLocation || needsOrg
                        return (
                          <button
                            type="button"
                            data-testid={`sync-source-${source.id}`}
                            disabled={actionSourceId === source.id || notReady}
                            title={notReady ? (needsLocation ? 'Click Edit to pick a Google business location first' : 'Click Edit to enter your LinkedIn organization URN first') : ''}
                            onClick={() => void handleSyncSource(source.id)}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionSourceId === source.id ? 'Syncing...' : 'Sync now'}
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  {editingSourceId === source.id && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">Source name</label>
                          <input
                            value={editForm.name ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        {source.sourceType === 'REDDIT' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500">Mode</label>
                              <select
                                value={editForm.mode ?? 'search'}
                                onChange={(e) => setEditForm((f) => ({ ...f, mode: e.target.value }))}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="search">Search across Reddit</option>
                                <option value="subreddit">Monitor specific subreddits</option>
                              </select>
                            </div>
                            {editForm.mode === 'subreddit' && (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-500">Subreddits (comma-separated)</label>
                                <input
                                  value={editForm.subreddits ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, subreddits: e.target.value }))}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            )}
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500">Keywords (comma-separated)</label>
                              <input
                                value={editForm.keywords ?? ''}
                                onChange={(e) => setEditForm((f) => ({ ...f, keywords: e.target.value }))}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </>
                        )}

                        {source.sourceType === 'X' && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500">Search query</label>
                            <input
                              value={editForm.searchQuery ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, searchQuery: e.target.value }))}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        {source.sourceType === 'GOOGLE_BUSINESS_PROFILE' && (
                          <>
                            {(source.scopeConfig as Record<string, unknown>)?.credentials ? (
                              <>
                                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                                  Google account connected
                                </div>
                                <button
                                  type="button"
                                  disabled={loadingLocations}
                                  onClick={() => void loadGoogleLocationsForSource(source.id)}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {loadingLocations ? 'Loading locations...' : 'Load business locations'}
                                </button>
                                {googleLocations.length > 0 && (
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Select a location</label>
                                    <select
                                      value={editForm.locationId ?? ''}
                                      onChange={(e) => {
                                        const loc = googleLocations.find((l) => l.locationId === e.target.value)
                                        if (loc) {
                                          setEditForm((f) => ({
                                            ...f,
                                            accountId: loc.accountId,
                                            locationId: loc.locationId,
                                            locationLabel: loc.locationName,
                                          }))
                                        }
                                      }}
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="">Choose a location...</option>
                                      {googleLocations.map((loc) => (
                                        <option key={loc.locationId} value={loc.locationId}>
                                          {loc.locationName} — {loc.address}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {googleLocations.length === 0 && !loadingLocations && editForm.locationId && (
                                  <p className="text-xs text-gray-400">Location: {editForm.locationLabel || editForm.locationId}</p>
                                )}
                              </>
                            ) : (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                Not connected — click &quot;Connect Google Account&quot; in the Add Integration section below, or re-authorize via Edit.
                              </div>
                            )}
                          </>
                        )}

                        {source.sourceType === 'LINKEDIN_ORG' && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500">Organization URN</label>
                            <input
                              value={editForm.organizationUrn ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, organizationUrn: e.target.value }))}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editForm.enabled === 'true'}
                              onChange={(e) => setEditForm((f) => ({ ...f, enabled: String(e.target.checked) }))}
                            />
                            Enabled
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleSaveEdit(source)}
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSourceId(null)}
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSource(source.id, source.name)}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewSourceId === source.id && preview.length > 0 && (
                    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-indigo-900">Test connection preview</h4>
                        <button
                          type="button"
                          onClick={() => setPreviewSourceId(null)}
                          className="rounded p-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
                        >
                          <span className="sr-only">Close preview</span>
                          &times;
                        </button>
                      </div>
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

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Integration</h2>

          {/* Reddit Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <ProviderBadge sourceType="REDDIT" />
              <h3 className="text-sm font-semibold text-gray-900">Reddit</h3>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">No credentials needed</span>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Source name (e.g., Brand mentions)"
                value={redditForm.name}
                onChange={(e) => setRedditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={redditForm.mode}
                onChange={(e) => setRedditForm((f) => ({ ...f, mode: e.target.value as 'search' | 'subreddit' }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="search">Search across Reddit</option>
                <option value="subreddit">Monitor specific subreddits</option>
              </select>
              {redditForm.mode === 'subreddit' && (
                <input
                  placeholder="Subreddits (comma-separated, e.g., SaaS, startups)"
                  value={redditForm.subreddits}
                  onChange={(e) => setRedditForm((f) => ({ ...f, subreddits: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
              <input
                placeholder="Keywords (comma-separated, e.g., your brand, product name)"
                value={redditForm.keywords}
                onChange={(e) => setRedditForm((f) => ({ ...f, keywords: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                disabled={submitting === 'REDDIT' || !redditForm.name.trim() || !redditForm.keywords.trim()}
                onClick={() => void createProviderSource('REDDIT', redditForm.name, {
                  mode: redditForm.mode,
                  subreddits: redditForm.subreddits.split(',').map((s) => s.trim()).filter(Boolean),
                  keywords: redditForm.keywords.split(',').map((s) => s.trim()).filter(Boolean),
                })}
                className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {submitting === 'REDDIT' ? 'Saving...' : 'Save & Enable'}
              </button>
            </div>
          </div>

          {/* X Card — Paid API, coming soon */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 opacity-75">
            <div className="mb-3 flex items-center gap-2">
              <ProviderBadge sourceType="X" />
              <h3 className="text-sm font-semibold text-gray-900">X (Twitter)</h3>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Paid Plan Coming Soon</span>
            </div>
            <p className="text-xs text-gray-500">
              X/Twitter requires a paid API plan ($100+/month) for search access. We&apos;re working on making this available as part of a premium tier.
            </p>
          </div>

          {/* Google Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <ProviderBadge sourceType="GOOGLE_BUSINESS_PROFILE" />
              <h3 className="text-sm font-semibold text-gray-900">Google Business Profile</h3>
            </div>
            <p className="mb-3 text-xs text-gray-500">Connect your Google account and we&apos;ll find your business locations automatically.</p>
            <div className="space-y-3">
              <input
                placeholder="Source name (e.g., My Store Reviews)"
                value={googleForm.name}
                onChange={(e) => setGoogleForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                disabled={submitting === 'GOOGLE_BUSINESS_PROFILE' || !googleForm.name.trim()}
                onClick={() => void createProviderSource('GOOGLE_BUSINESS_PROFILE', googleForm.name, {}, { redirectToOAuth: true })}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting === 'GOOGLE_BUSINESS_PROFILE' ? 'Connecting...' : 'Connect Google Account'}
              </button>
              <p className="text-[11px] text-gray-400">After connecting, we&apos;ll list your business locations so you can pick which one to pull reviews from.</p>
            </div>
          </div>

          {/* LinkedIn Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <ProviderBadge sourceType="LINKEDIN_ORG" />
              <h3 className="text-sm font-semibold text-gray-900">LinkedIn</h3>
            </div>
            <p className="mb-3 text-xs text-gray-500">Connect your LinkedIn company page to import post comments and engagement.</p>
            <div className="space-y-3">
              <input
                placeholder="Source name (e.g., Company Page Comments)"
                value={linkedinForm.name}
                onChange={(e) => setLinkedinForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                placeholder="Organization URN (e.g., urn:li:organization:12345678)"
                value={linkedinForm.organizationUrn}
                onChange={(e) => setLinkedinForm((f) => ({ ...f, organizationUrn: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                disabled={submitting === 'LINKEDIN_ORG' || !linkedinForm.name.trim() || !linkedinForm.organizationUrn.trim()}
                onClick={() => void createProviderSource('LINKEDIN_ORG', linkedinForm.name, {
                  organizationUrn: linkedinForm.organizationUrn.trim(),
                }, { redirectToOAuth: true })}
                className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {submitting === 'LINKEDIN_ORG' ? 'Connecting...' : 'Connect LinkedIn'}
              </button>
            </div>
          </div>

          {/* Advanced / Generic */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-left text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {showAdvanced ? 'Hide' : 'Show'} advanced (generic webhook/API)
            </button>
            {showAdvanced && (
              <div className="mt-4">
                <ExternalSignalSourceForm
                  form={form}
                  formHint={formHint}
                  submitting={submitting === 'GENERIC'}
                  setForm={setForm}
                  onSubmit={handleCreateSource}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
