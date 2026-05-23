// Spec §3.2 — read-only composer snapshot rendered on the Wave Detail page for
// MANAGED_EMAIL batches so operators can audit exactly what was sent for a
// given wave. The body is shown as preformatted text (mono) — rendering the
// stored HTML would open an XSS surface, and the unresolved mustache tokens
// are part of what the operator wants to see anyway.

'use client'

export interface ComposerSnapshot {
  senderName: string
  senderAlias: string
  senderDomain: string
  subject: string
  body: string
  brandLogoUrl: string | null
  brandName: string
}

export function ComposerSnapshotBlock({ snapshot }: { snapshot: ComposerSnapshot }) {
  const fromAddress = `${snapshot.senderAlias}@${snapshot.senderDomain}`
  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
      data-testid="composer-snapshot-block"
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Composer snapshot</h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-gray-500">From</dt>
        <dd className="text-gray-800">
          {snapshot.senderName}{' '}
          <span className="font-mono text-gray-500" data-testid="composer-snapshot-from">
            &lt;{fromAddress}&gt;
          </span>
        </dd>
        <dt className="text-gray-500">Subject</dt>
        <dd className="text-gray-800" data-testid="composer-snapshot-subject">
          {snapshot.subject}
        </dd>
        <dt className="text-gray-500">Brand</dt>
        <dd className="text-gray-800 flex items-center gap-2">
          {snapshot.brandLogoUrl ? (
            <img
              src={snapshot.brandLogoUrl}
              alt={`${snapshot.brandName} logo`}
              className="h-4 w-auto rounded-sm border border-gray-200"
              data-testid="composer-snapshot-brand-logo"
            />
          ) : null}
          <span>{snapshot.brandName}</span>
        </dd>
      </dl>
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Body
        </div>
        <pre
          className="max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800"
          data-testid="composer-snapshot-body"
        >
          {snapshot.body}
        </pre>
        <p className="mt-1 text-[11px] text-gray-500">
          Read-only snapshot taken at send time. Mustache tokens (e.g. {'{{first_name}}'})
          render unresolved here; the worker substitutes them per-recipient at dispatch.
        </p>
      </div>
    </section>
  )
}
