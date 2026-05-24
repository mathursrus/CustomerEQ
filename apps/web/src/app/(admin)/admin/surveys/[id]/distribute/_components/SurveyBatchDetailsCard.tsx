// Issue #420 — Survey Batch details card (spec §2.1).
//
// Two inputs the operator sets BEFORE selecting members:
// - `surveyNameInMail` — flows into the CSV's `surveyName` column for
//   SELF_SERVE, and into the default subject + the `{{survey_title}}` mustache
//   variable for MANAGED_EMAIL.
// - `expiryPreset` (24h / 7d / 30d / 90d / custom) — bound to
//   `DistributionBatch.expiresAt`. Custom date-time picker is surfaced when
//   the operator picks the custom option.
//
// Lifted from both SelfServeFlow.tsx and ManagedEmailFlow.tsx into a single
// shared component so the surface stays in lockstep with the spec's "shared,
// defined first" ordering (Round-6 reorder cited in mock lines 393-415).

'use client'

export type ExpiryPreset = '24h' | '7d' | '30d' | '90d' | 'custom'

interface SurveyBatchDetailsCardProps {
  surveyNameInMail: string
  setSurveyNameInMail: (v: string) => void
  expiryPreset: ExpiryPreset
  setExpiryPreset: (p: ExpiryPreset) => void
  customExpiry: string
  setCustomExpiry: (v: string) => void
  brandTimezone: string
}

export function SurveyBatchDetailsCard({
  surveyNameInMail,
  setSurveyNameInMail,
  expiryPreset,
  setExpiryPreset,
  customExpiry,
  setCustomExpiry,
  brandTimezone,
}: SurveyBatchDetailsCardProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Survey Batch details</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Survey name in mail</span>
          <input
            type="text"
            value={surveyNameInMail}
            maxLength={80}
            onChange={(e) => setSurveyNameInMail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Links expire on</span>
          <select
            value={expiryPreset}
            onChange={(e) => setExpiryPreset(e.target.value as ExpiryPreset)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="custom">Custom date+time…</option>
          </select>
          {expiryPreset === 'custom' ? (
            <>
              <input
                type="datetime-local"
                value={customExpiry ? customExpiry.replace('Z', '').slice(0, 16) : ''}
                onChange={(e) =>
                  setCustomExpiry(e.target.value ? new Date(e.target.value).toISOString() : '')
                }
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">All times in {brandTimezone}</p>
            </>
          ) : (
            <p className="mt-1 text-xs text-gray-500">End of day in {brandTimezone}</p>
          )}
        </label>
      </div>
    </section>
  )
}
