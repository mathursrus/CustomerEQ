'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { SourceForm, type KBSource } from '../_components/source-form'

export default function KBSourceViewPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [source, setSource] = useState<KBSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const token = await getAuthToken(getToken)
        const res = await fetch(`${API_URL}/v1/kb/sources/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) return
        const json: KBSource = await res.json()
        setSource(json)
      } catch {
        /* network error */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, getToken])

  async function handleCrawlNow() {
    if (!source) return
    setCrawlError(null)
    setCrawling(true)
    try {
      const token = await getAuthToken(getToken)
      const res = await fetch(`${API_URL}/v1/kb/sources/${id}/crawl`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 202 || res.ok) {
        showToast('Crawl enqueued')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        setCrawlError(err.message ?? `Failed to enqueue crawl (${res.status})`)
      }
    } catch {
      setCrawlError('Network error — please try again')
    } finally {
      setCrawling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (notFound || !source) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/kb/sources"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Knowledge Sources
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">Source not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/kb/sources"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Knowledge Sources
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{source.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {source.kind} source
          </p>
        </div>
        <div className="flex items-center gap-3">
          {crawlError && (
            <p className="text-xs text-red-600">{crawlError}</p>
          )}
          {source.kind !== 'MANUAL' && (
            <button
              type="button"
              disabled={crawling}
              onClick={() => { void handleCrawlNow() }}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {crawling ? 'Enqueuing…' : 'Crawl Now'}
            </button>
          )}
          <Link
            href={`/admin/kb/sources/${id}/edit`}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* View form */}
      <SourceForm mode="view" initial={source} />
    </div>
  )
}
