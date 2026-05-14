'use client'

import Link from 'next/link'
import { SourceForm } from '../_components/source-form'

export default function NewKBSourcePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/kb/sources"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Knowledge Sources
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Knowledge Source</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a new source to populate your knowledge base
        </p>
      </div>
      <SourceForm mode="create" />
    </div>
  )
}
