'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

const ALL_EVENTS = ['case.created', 'case.status_changed', 'case.overdue'] as const
type WebhookEvent = (typeof ALL_EVENTS)[number]

interface WebhookEndpoint {
  id: string
  label: string
  url: string
  events: WebhookEvent[]
  active: boolean
  createdAt: string
  updatedAt: string
}

interface DeliveryLog {
  id: string
  event: string
  success: boolean
  httpStatus: number | null
  latencyMs: number
  attempt: number
  deliveredAt: string
  responseBody: string | null
}

const EVENT_LABELS: Record<WebhookEvent, string> = {
  'case.created': 'Case Created',
  'case.status_changed': 'Case Status Changed',
  'case.overdue': 'Case Overdue',
}

function SecretDisplay({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-800 mb-1">Signing Secret — save this now, it will not be shown again</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-amber-100 px-3 py-2 text-xs font-mono text-amber-900 break-all">{secret}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className={`shrink-0 rounded px-3 py-2 text-xs font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-amber-700 text-white hover:bg-amber-800'}`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function DeliveryLogDrawer({ endpoint, onClose, getToken }: { endpoint: WebhookEndpoint; onClose: () => void; getToken: () => Promise<string | null> }) {
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [testFiring, setTestFiring] = useState(false)
  const [testFired, setTestFired] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/webhooks/${endpoint.id}/deliveries`, { headers })
    if (res.ok) {
      const data = await res.json()
      setLogs(data.deliveries ?? [])
    }
    setLoading(false)
  }, [endpoint.id, getToken])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  async function fireTest() {
    setTestFiring(true)
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    await fetch(`${API_URL}/v1/webhooks/${endpoint.id}/test`, { method: 'POST', headers })
    setTestFiring(false)
    setTestFired(true)
    setTimeout(() => { setTestFired(false); void fetchLogs() }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative z-10 flex flex-col w-full max-w-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{endpoint.label}</h2>
            <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{endpoint.url}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fireTest}
              disabled={testFiring}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${testFired ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {testFiring ? 'Firing…' : testFired ? 'Sent!' : 'Send test'}
            </button>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Delivery Log (last 50)</h3>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-400">No deliveries yet. Send a test to get started.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-700">{log.event}</span>
                    <div className="flex items-center gap-2">
                      {log.httpStatus && (
                        <span className="text-xs text-gray-500">HTTP {log.httpStatus}</span>
                      )}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.success ? 'OK' : 'Failed'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{new Date(log.deliveredAt).toLocaleString()}</span>
                    <span>{log.latencyMs} ms</span>
                    <span>attempt {log.attempt}</span>
                  </div>
                  {!log.success && log.responseBody && (
                    <p className="mt-1 text-xs text-red-600 font-mono truncate">{log.responseBody}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EndpointForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<WebhookEndpoint>
  onSave: (data: { label: string; url: string; events: WebhookEvent[] }) => Promise<void>
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [events, setEvents] = useState<WebhookEvent[]>(initial?.events ?? ['case.created'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.startsWith('https://')) { setError('URL must start with https://'); return }
    if (events.length === 0) { setError('Select at least one event'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({ label, url, events })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  function toggleEvent(ev: WebhookEvent) {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev])
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          placeholder="My CRM Webhook"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Endpoint URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://example.com/webhook"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-400">HTTPS required</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Events</label>
        <div className="space-y-2">
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={events.includes(ev)}
                onChange={() => toggleEvent(ev)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">{EVENT_LABELS[ev]}</span>
              <span className="text-xs font-mono text-gray-400">{ev}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function WebhooksPage() {
  const { getToken } = useAuth()
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [logsFor, setLogsFor] = useState<WebhookEndpoint | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchEndpoints = useCallback(async () => {
    setLoading(true)
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/v1/webhooks`, { cache: 'no-store', headers })
    if (res.ok) {
      const data = await res.json()
      setEndpoints(data.endpoints ?? [])
    }
    setLoading(false)
  }, [getToken])

  useEffect(() => { void fetchEndpoints() }, [fetchEndpoints])

  async function createEndpoint(data: { label: string; url: string; events: WebhookEvent[] }) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await fetch(`${API_URL}/v1/webhooks`, { method: 'POST', headers, body: JSON.stringify(data) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to create endpoint')
    }
    const created = await res.json()
    setNewSecret(created.signingSecret)
    setShowCreate(false)
    await fetchEndpoints()
  }

  async function updateEndpoint(id: string, data: { label: string; url: string; events: WebhookEvent[] }) {
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await fetch(`${API_URL}/v1/webhooks/${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) })
    if (!res.ok) throw new Error('Failed to update endpoint')
    setEditingId(null)
    await fetchEndpoints()
  }

  async function toggleActive(endpoint: WebhookEndpoint) {
    setTogglingId(endpoint.id)
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    await fetch(`${API_URL}/v1/webhooks/${endpoint.id}`, { method: 'PATCH', headers, body: JSON.stringify({ active: !endpoint.active }) })
    setTogglingId(null)
    await fetchEndpoints()
  }

  async function deleteEndpoint(id: string) {
    setDeletingId(id)
    const token = await getAuthToken(getToken)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    await fetch(`${API_URL}/v1/webhooks/${id}`, { method: 'DELETE', headers })
    setDeletingId(null)
    await fetchEndpoints()
  }

  const editingEndpoint = endpoints.find((e) => e.id === editingId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-500">Receive real-time case events in your own systems via signed HTTP POST</p>
        </div>
        {!showCreate && (
          <button
            onClick={() => { setShowCreate(true); setNewSecret(null) }}
            data-testid="create-webhook-btn"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Add Endpoint
          </button>
        )}
      </div>

      {/* New secret banner */}
      {newSecret && <SecretDisplay secret={newSecret} />}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">New Endpoint</h2>
          <EndpointForm
            onSave={createEndpoint}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Edit form */}
      {editingId && editingEndpoint && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Edit — {editingEndpoint.label}</h2>
          <EndpointForm
            initial={editingEndpoint}
            onSave={(data) => updateEndpoint(editingId, data)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* Endpoints table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table data-testid="webhooks-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Label</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">URL</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Events</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading…</td>
              </tr>
            ) : endpoints.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No webhook endpoints yet.{' '}
                  <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline">Add your first endpoint</button>
                </td>
              </tr>
            ) : (
              endpoints.map((ep) => (
                <tr key={ep.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{ep.label}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 max-w-xs truncate">{ep.url}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {ep.events.map((ev) => (
                        <span key={ev} className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {EVENT_LABELS[ev] ?? ev}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(ep)}
                      disabled={togglingId === ep.id}
                      data-testid={`toggle-active-${ep.id}`}
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${ep.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {ep.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {new Date(ep.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setLogsFor(ep)}
                        data-testid={`logs-${ep.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => { setEditingId(ep.id); setShowCreate(false) }}
                        data-testid={`edit-webhook-${ep.id}`}
                        className="text-xs font-medium text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${ep.label}"?`)) void deleteEndpoint(ep.id) }}
                        disabled={deletingId === ep.id}
                        data-testid={`delete-webhook-${ep.id}`}
                        className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        {deletingId === ep.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delivery log drawer */}
      {logsFor && (
        <DeliveryLogDrawer
          endpoint={logsFor}
          onClose={() => setLogsFor(null)}
          getToken={getToken}
        />
      )}
    </div>
  )
}
