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
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">Embed code</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Paste just before <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">&lt;/body&gt;</code> on every page. Brand ID is baked in — no further config.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <pre className="overflow-x-auto rounded-md bg-[#0f1320] px-3 py-3 font-mono text-[12px] leading-relaxed text-[#e9ecf5]">
          <code>{snippet}</code>
        </pre>
      </div>
    </section>
  )
}
