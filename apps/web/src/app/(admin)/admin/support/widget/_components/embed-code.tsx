'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/config'

interface EmbedCodeProps {
  brandId: string
}

const CDN_URL =
  process.env.NEXT_PUBLIC_WIDGET_EMBED_URL ??
  'https://cdn.customereq.com/ceq-support-chat.js'

export function EmbedCode({ brandId }: EmbedCodeProps) {
  const [copied, setCopied] = useState(false)

  const snippet = `<script async src="${CDN_URL}"></script>
<ceq-support-chat
  brand-id="${brandId}"
  api-base="${API_URL}"
></ceq-support-chat>`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — ignore
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Embed code</h2>
          <p className="mt-1 text-sm text-gray-500">
            Paste this snippet just before <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">&lt;/body&gt;</code> on every page where you want the widget.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-xs leading-relaxed text-gray-100">
        <code>{snippet}</code>
      </pre>
      <p className="mt-3 text-xs text-gray-400">
        Your brand ID is baked in. The widget will fetch its theme and copy from this site automatically — no further config needed.
      </p>
    </div>
  )
}
