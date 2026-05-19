'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'

interface KBSource {
  id: string
  kind: 'MANUAL' | 'URL' | 'SITEMAP'
  url: string | null
  title: string
  status: 'ACTIVE' | 'DISABLED'
  crawlCron: string | null
  lastCrawledAt: string | null
  lastError: string | null
  createdAt: string
}

interface KBSourcesResponse {
  sources: KBSource[]
  total: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function KindBadge({ kind }: { kind: KBSource['kind'] }) {
  const styles: Record<KBSource['kind'], string> = {
    MANUAL: 'bg-gray-100 text-gray-700',
    URL: 'bg-blue-100 text-blue-700',
    SITEMAP: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[kind]}`}>
      {kind}
    </span>
  )
}

function StatusBadge({ status }: { status: KBSource['status'] }) {
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Disabled
    </span>
  )
}

export default function KBSourcesPage() {
  const { getToken } = useAuth()

  const [sources, setSources] = useState<KBSource[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [crawlingId, setCrawlingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/kb/sources`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        setSources([])
        return
      }
      const json: KBSourcesResponse = await res.json()
      setSources(json.sources ?? [])
    } catch {
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  async function handleCrawlNow(source: KBSource) {
    setActionError(null)
    setCrawlingId(source.id)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/kb/sources/${source.id}/crawl`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 202 || res.ok) {
        showToast('Crawl enqueued')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        setActionError(err.message ?? `Failed to enqueue crawl (${res.status})`)
      }
    } catch {
      setActionError('Network error — please try again')
    } finally {
      setCrawlingId(null)
    }
  }

  async function handleDelete(source: KBSource) {
    if (!confirm(`Delete source "${source.title}"? This cannot be undone.`)) return
    setActionError(null)
    setDeletingId(source.id)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/kb/sources/${source.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        await fetchSources()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        setActionError(err.message ?? `Failed to delete source (${res.status})`)
      }
    } catch {
      setActionError('Network error — please try again')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Sources</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data sources that populate the knowledge base
          </p>
        </div>
        <Link
          href="/admin/kb/sources/new"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + New Source
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Error */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading…
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-500">No knowledge sources yet.</p>
            <Link
              href="/admin/kb/sources/new"
              className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
            >
              Add your first source
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Title', 'Kind', 'URL', 'Status', 'Last Crawled', 'Last Error', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-gray-50 transition-colors">
                  {/* Title */}
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/kb/sources/${source.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {source.title}
                    </Link>
                  </td>
                  {/* Kind */}
                  <td className="px-4 py-3 text-sm">
                    <KindBadge kind={source.kind} />
                  </td>
                  {/* URL */}
                  <td className="px-4 py-3 text-sm max-w-xs">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.url}
                        className="block truncate text-indigo-600 hover:underline"
                      >
                        {source.url}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={source.status} />
                  </td>
                  {/* Last Crawled */}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {source.lastCrawledAt ? timeAgo(source.lastCrawledAt) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  {/* Last Error */}
                  <td className="px-4 py-3 text-sm max-w-xs">
                    {source.lastError ? (
                      <span className="block truncate text-red-600" title={source.lastError}>
                        {source.lastError}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/kb/sources/${source.id}`}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/kb/sources/${source.id}/edit`}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </Link>
                      {source.kind !== 'MANUAL' && (
                        <button
                          type="button"
                          disabled={crawlingId === source.id}
                          onClick={() => { void handleCrawlNow(source) }}
                          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          {crawlingId === source.id ? 'Enqueuing…' : 'Crawl Now'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === source.id}
                        onClick={() => { void handleDelete(source) }}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === source.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
