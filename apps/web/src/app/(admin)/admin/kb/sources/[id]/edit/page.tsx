'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { SourceForm, type KBSource } from '../../_components/source-form'

export default function KBSourceEditPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [source, setSource] = useState<KBSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/kb/sources" className="font-medium hover:text-gray-700 transition-colors">
          Knowledge Sources
        </Link>
        <span>/</span>
        <Link href={`/admin/kb/sources/${id}`} className="font-medium hover:text-gray-700 transition-colors">
          {source.title}
        </Link>
        <span>/</span>
        <span className="text-gray-700">Edit</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Source</h1>
        <p className="mt-1 text-sm text-gray-500">{source.title}</p>
      </div>

      <SourceForm mode="edit" initial={source} />
    </div>
  )
}
