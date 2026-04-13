'use client'

// /admin/developer — one-stop integration page. Shows an admin everything
// their team needs to wire CustomerEQ into their own product:
//   - API keys (create, revoke, copy)
//   - Brand ID
//   - Survey embed snippets (copy-able <script> tags per active survey)
//   - External signal webhook URLs
//   - Ready-to-paste curl snippets for /v1/events and /v1/members/enroll
//
// The idea is: an Acme Coffee admin lands here after creating their
// surveys + campaigns, copies three things into their server's .env and
// their HTML, and is live in minutes.

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

interface CreatedKey extends ApiKey {
  key: string
}

interface DevConfig {
  brand: { id: string; name: string }
  apiBaseUrl: string
  surveys: Array<{
    id: string
    name: string
    type: string
    incentivePoints: number | null
    shareUrl: string
    embedSnippet: string
  }>
  externalSignalSources: Array<{
    id: string
    name: string
    sourceType: string
    syncMode: string
    webhookUrl: string
    hasSharedSecret: boolean
  }>
  codeSnippets: {
    curlIngestEvent: string
    curlEnrollMember: string
  }
}

export default function DeveloperPage() {
  const { getToken } = useAuth()
  const [config, setConfig] = useState<DevConfig | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyModal, setNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await getAuthToken(() => getToken())
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [configRes, keysRes] = await Promise.all([
        authedFetch('/v1/developer/config'),
        authedFetch('/v1/api-keys'),
      ])
      if (!configRes.ok) throw new Error(`Config load failed: ${configRes.status}`)
      if (!keysRes.ok) throw new Error(`Keys load failed: ${keysRes.status}`)
      const [configData, keysData] = await Promise.all([configRes.json(), keysRes.json()])
      setConfig(configData)
      setKeys(keysData.keys ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createKey() {
    if (!newKeyName.trim()) return
    const res = await authedFetch('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: newKeyName.trim() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.message ?? err.error ?? `Create failed: ${res.status}`)
      return
    }
    const data = await res.json()
    setCreatedKey(data)
    setNewKeyName('')
    setNewKeyModal(false)
    // Refresh list in background
    load()
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? Any service using it will stop working.')) return
    const res = await authedFetch(`/v1/api-keys/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError(`Revoke failed: ${res.status}`)
      return
    }
    load()
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setError(null)
    const el = document.createElement('div')
    el.textContent = `${label} copied to clipboard`
    el.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>
  if (error && !config) return <div className="p-6 text-red-600">{error}</div>
  if (!config) return null

  const activeKeys = keys.filter((k) => !k.revokedAt)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-gray-900">Developer</h1>
        <p className="mt-1 text-gray-600">
          Everything your engineering team needs to integrate CustomerEQ into your product.
          Copy keys, snippets, and webhook URLs — drop them into your own code and you're live.
        </p>
      </header>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Brand identity ─────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Organization</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Brand Name</div>
            <div className="mt-1 text-sm text-gray-900">{config.brand.name}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Brand ID</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{config.brand.id}</code>
              <button
                onClick={() => copyToClipboard(config.brand.id, 'Brand ID')}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">API Base URL</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{config.apiBaseUrl}</code>
              <button
                onClick={() => copyToClipboard(config.apiBaseUrl, 'API URL')}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── API Keys ───────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Use these with the <code className="text-xs bg-gray-100 px-1 rounded">X-Api-Key</code> header
              to call CustomerEQ from your backend.
            </p>
          </div>
          <button
            onClick={() => setNewKeyModal(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Generate New Key
          </button>
        </div>

        {activeKeys.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            No API keys yet. Click "Generate New Key" to create your first one.
          </div>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{k.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <code className="font-mono">{k.keyPrefix}••••••••••</code>
                    {' · created '}
                    {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium ml-4"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Survey Embeds ──────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Survey Embeds</h2>
        <p className="text-sm text-gray-500 mb-4">
          Drop these <code className="text-xs bg-gray-100 px-1 rounded">&lt;script&gt;</code> tags into
          your own site's HTML — post-checkout pages, thank-you pages, help center, anywhere you
          want CustomerEQ to collect feedback.
        </p>
        {config.surveys.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            No active surveys yet.{' '}
            <a href="/admin/surveys" className="text-indigo-600 hover:text-indigo-700">
              Create one
            </a>
            .
          </div>
        ) : (
          <div className="space-y-4">
            {config.surveys.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {s.type}
                      {s.incentivePoints ? ` · +${s.incentivePoints} pts reward` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(s.embedSnippet, 'Embed snippet')}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Copy Snippet
                  </button>
                </div>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono">
                  {s.embedSnippet}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Webhook URLs ───────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">External Signal Webhooks</h2>
        <p className="text-sm text-gray-500 mb-4">
          Point your Google Business Profile, Reddit polling job, Zendesk trigger, or any other
          review source at these URLs. CustomerEQ normalizes and scores every delivery.
        </p>
        {config.externalSignalSources.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            No external sources configured.{' '}
            <a href="/admin/integrations" className="text-indigo-600 hover:text-indigo-700">
              Add one
            </a>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {config.externalSignalSources.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {s.sourceType} · {s.syncMode}
                      {s.hasSharedSecret && ' · HMAC signed'}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(s.webhookUrl, 'Webhook URL')}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Copy URL
                  </button>
                </div>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono">
                  {s.webhookUrl}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Code Snippets ──────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Quick-Start Snippets</h2>
        <p className="text-sm text-gray-500 mb-4">
          Copy these into your terminal or backend to send your first event + enroll your first member.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-900">Send a loyalty event</div>
              <button
                onClick={() => copyToClipboard(config.codeSnippets.curlIngestEvent, 'Snippet')}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono whitespace-pre">
              {config.codeSnippets.curlIngestEvent}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-900">Enroll a new member (public endpoint)</div>
              <button
                onClick={() => copyToClipboard(config.codeSnippets.curlEnrollMember, 'Snippet')}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono whitespace-pre">
              {config.codeSnippets.curlEnrollMember}
            </pre>
          </div>
        </div>
      </section>

      {/* ── New Key Modal ──────────────────────────────────────────────── */}
      {newKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate New API Key</h3>
            <p className="text-sm text-gray-500 mb-4">
              Give this key a human-readable name so you can remember what it's used for
              (e.g., "Production backend", "Staging", "Zapier integration").
            </p>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setNewKeyModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createKey}
                disabled={!newKeyName.trim()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Created Key Reveal Modal ───────────────────────────────────── */}
      {createdKey && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Key Created</h3>
            <p className="text-sm text-gray-700 mb-1">
              <strong className="text-red-600">This is the only time you'll see this key.</strong>{' '}
              Copy it now and store it somewhere safe.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              If you lose it, revoke it and create a new one — don't try to recover it.
            </p>
            <div className="bg-gray-900 text-gray-100 font-mono text-sm p-3 rounded break-all mb-4">
              {createdKey.key}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => copyToClipboard(createdKey.key, 'API Key')}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                Copy Key
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                className="px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-black text-white rounded-lg"
              >
                I've saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
