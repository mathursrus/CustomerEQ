// Issue #423 — URL state codec for the Response section filters. Operators
// share filtered views with colleagues by copying the URL; this codec
// round-trips the state via the same Zod schema the API consumes so
// invalid values silently drop to defaults rather than rendering an error.

import {
  ResponseFiltersSchema,
  type ResponseFilters,
} from '@customerEQ/shared'

/** Serializes filter state into a query string fragment (no leading `?`). */
export function encodeFiltersToQs(state: ResponseFilters): string {
  const params = new URLSearchParams()
  if (state.wave && state.wave !== 'all') params.set('wave', state.wave)
  if (state.submittedFrom) params.set('submittedFrom', state.submittedFrom)
  if (state.submittedTo) params.set('submittedTo', state.submittedTo)
  if (state.scoreBands && state.scoreBands.length > 0) {
    params.set('scoreBands', state.scoreBands.join(','))
  }
  if (state.sentimentBands && state.sentimentBands.length > 0) {
    params.set('sentimentBands', state.sentimentBands.join(','))
  }
  if (state.channels && state.channels.length > 0) {
    params.set('channels', state.channels.join(','))
  }
  return params.toString()
}

/** Decodes a query string back into filter state. Invalid values silently
 * drop to defaults — preserves the spec's "shareable URL never throws" guarantee. */
export function decodeFiltersFromQs(qs: URLSearchParams): ResponseFilters {
  const raw = {
    wave: qs.get('wave') ?? undefined,
    submittedFrom: qs.get('submittedFrom') ?? undefined,
    submittedTo: qs.get('submittedTo') ?? undefined,
    scoreBands: splitCsv(qs.get('scoreBands')),
    sentimentBands: splitCsv(qs.get('sentimentBands')),
    channels: splitCsv(qs.get('channels')),
  }
  const parse = ResponseFiltersSchema.safeParse(raw)
  return parse.success ? parse.data : { wave: 'all' }
}

function splitCsv(value: string | null): string[] | undefined {
  if (!value) return undefined
  return value.split(',').filter(Boolean)
}
