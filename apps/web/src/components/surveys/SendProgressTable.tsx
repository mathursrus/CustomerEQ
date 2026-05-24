// Spec §2.6b + §3.2 — recipient-level send-progress table. Same shape on the
// live Sending state (ManagedEmailFlow) and the historical Wave Detail view
// (post-send audit). Driven by GET /v1/surveys/:id/distribution-batches/:batchId
// /send-progress (the existing 2s-polled endpoint).

'use client'

import type { SendProgressResponse } from '@customerEQ/shared'

type SendingStatus = SendProgressResponse['recipients'][number]['status']

const STATUS_VARIANTS: Record<SendingStatus, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-gray-100 text-gray-700' },
  sending: { label: 'Sending', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Sent', cls: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
}

export function SendProgressStatusPill({ status }: { status: SendingStatus }) {
  const v = STATUS_VARIANTS[status]
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}
      data-testid={`send-progress-status-${status}`}
    >
      {v.label}
    </span>
  )
}

export function SendProgressTable({
  recipients,
  brandTimezone,
  brandLocale,
}: {
  recipients: SendProgressResponse['recipients']
  /** When provided, deliveredAt / failedAt timestamps render in the brand's tz.
   *  ManagedEmailFlow's live Sending state passes nothing and falls back to
   *  locale time (the existing #420 behavior). */
  brandTimezone?: string
  brandLocale?: string
}) {
  return (
    <div
      className="max-h-96 overflow-y-auto rounded border border-gray-200"
      data-testid="send-progress-table-wrap"
    >
      <table className="w-full text-xs" data-testid="send-progress-table">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium text-gray-700">Recipient</th>
            <th className="px-3 py-2 font-medium text-gray-700">Status</th>
            <th className="px-3 py-2 font-medium text-gray-700">Detail</th>
          </tr>
        </thead>
        <tbody>
          {recipients.map((r) => (
            <tr key={r.memberId} className="border-t border-gray-100">
              <td className="px-3 py-2">
                {r.firstName ?? ''} {r.lastName ?? ''}{' '}
                <span className="text-gray-500">{r.identifier}</span>
              </td>
              <td className="px-3 py-2">
                <SendProgressStatusPill status={r.status} />
              </td>
              <td className="px-3 py-2 text-gray-600">
                {r.failureReason ?? formatTimestamp(r.deliveredAt, brandTimezone, brandLocale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatTimestamp(
  iso: string | null,
  timezone: string | undefined,
  locale: string | undefined,
): string {
  if (!iso) return '—'
  try {
    const opts: Intl.DateTimeFormatOptions = timezone
      ? {
          timeZone: timezone,
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }
      : { hour: 'numeric', minute: '2-digit' }
    return new Date(iso).toLocaleString(locale ?? 'en-US', opts)
  } catch {
    return iso
  }
}
