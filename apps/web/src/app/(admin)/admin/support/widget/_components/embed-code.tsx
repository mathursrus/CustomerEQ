'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/config'

interface EmbedCodeProps {
  brandId: string
}

const CDN_URL =
  process.env.NEXT_PUBLIC_WIDGET_EMBED_URL ??
  'https://cdn.customereq.com/ceq-support-chat.js'

type SnippetKey = 'standard' | 'identify' | 'manual'

interface CopyButtonProps {
  text: string
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

interface SnippetBlockProps {
  code: string
}

function SnippetBlock({ code }: SnippetBlockProps) {
  return (
    <pre className="overflow-x-auto rounded-md bg-[#0f1320] px-3 py-3 font-mono text-[12px] leading-relaxed text-[#e9ecf5]">
      <code>{code}</code>
    </pre>
  )
}

export function EmbedCode({ brandId }: EmbedCodeProps) {
  const [active, setActive] = useState<SnippetKey>('standard')

  const standard = `<script async
  src="${CDN_URL}"
  data-brand-id="${brandId}"
  data-api-base="${API_URL}"
></script>`

  const identify = `// In your host page, BEFORE the visitor opens the chat:
window.CEQ = window.CEQ || []
window.CEQ.push(['identify', {
  email: 'user@example.com',
  name: 'Jane Doe',
  externalId: 'your-uid-123',
}])

// Optional — react to widget ready or programmatically open/close:
window.CEQ.push(['onReady', () => console.log('ceq widget ready')])
// window.CEQ.push(['open'])
// window.CEQ.push(['reset'])  // on logout`

  const manual = `<script async src="${CDN_URL}"></script>
<ceq-support-chat
  brand-id="${brandId}"
  api-base="${API_URL}"
></ceq-support-chat>`

  const tabs: { key: SnippetKey; label: string }[] = [
    { key: 'standard', label: 'Standard' },
    { key: 'identify', label: 'Identify users' },
    { key: 'manual', label: 'Manual element' },
  ]

  const activeCode = active === 'standard' ? standard : active === 'identify' ? identify : manual

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">Embed code</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {active === 'standard' && (
              <>Paste this <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">&lt;script&gt;</code> tag anywhere on every page (head or body). Brand ID is baked in.</>
            )}
            {active === 'identify' && (
              <>Pass your logged-in user's identity so the conversation links to their member record. Loyalty events fire on resolution.</>
            )}
            {active === 'manual' && (
              <>Explicit element placement for advanced use cases. Required only if you need multiple widgets on one page.</>
            )}
          </p>
        </div>
        <CopyButton text={activeCode} />
      </div>

      <div className="mt-3 flex items-center gap-1 border-b border-gray-100 px-4">
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`relative -mb-px border-b-2 px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="px-4 pb-4 pt-3">
        <SnippetBlock code={activeCode} />
        {active === 'identify' && (
          <p className="mt-2 text-[11px] text-amber-700">
            ⚠ Identity is host-page-trusted (unsigned email). Anyone with widget access can spoof identities — fine for low-stakes loyalty awards, not for sensitive operations. JWT-signed identify is planned for a follow-up.
          </p>
        )}
      </div>
    </section>
  )
}
