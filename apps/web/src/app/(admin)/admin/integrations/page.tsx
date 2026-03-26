'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/config'

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

function CopyButton({ value, testId }: { value: string; testId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the text
    }
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={handleCopy}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
    >
      {copied ? (
        <>
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

export default function IntegrationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">Connect your CX tools to CustomerEQ via webhooks</p>
      </div>

      <div className="space-y-4">
        {WEBHOOKS.map((wh) => (
          <div key={wh.slug} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${wh.badgeBg} flex items-center justify-center`}>
                    <span className={`${wh.badgeText} text-xs font-bold`}>{wh.badgeLabel}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{wh.name}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">{wh.description}</p>
                <code
                  data-testid={`webhook-url-${wh.slug}`}
                  className="block rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm font-mono text-gray-800 break-all"
                >
                  {wh.url}
                </code>
              </div>
              <div className="shrink-0 mt-10">
                <CopyButton value={wh.url} testId={`copy-webhook-${wh.slug}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
