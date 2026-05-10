import { CONSENT_TOKEN_RE } from './tokens.js'
import type {
  ConsentTextSegment,
  ConsentToken,
  ConsentTokenKind,
} from './types.js'

export function tokenize(text: string): ConsentToken[] {
  if (text.length === 0) return []
  const out: ConsentToken[] = []
  // String.prototype.matchAll clones the source regex internally, so the
  // exported CONSENT_TOKEN_RE.lastIndex is never mutated by this call.
  for (const m of text.matchAll(CONSENT_TOKEN_RE)) {
    if (m.index === undefined) continue
    const kind = m[1] as ConsentTokenKind
    const inner = m[2]
    out.push({
      kind,
      customLabel: inner === undefined ? null : inner,
      raw: m[0],
      index: m.index,
      length: m[0].length,
    })
  }
  return out
}

export function segments(text: string): ConsentTextSegment[] {
  if (text.length === 0) return []
  const tokens = tokenize(text)
  if (tokens.length === 0) return [{ type: 'text', text }]
  const out: ConsentTextSegment[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.index > cursor) {
      out.push({ type: 'text', text: text.slice(cursor, token.index) })
    }
    out.push({ type: 'token', token })
    cursor = token.index + token.length
  }
  if (cursor < text.length) {
    out.push({ type: 'text', text: text.slice(cursor) })
  }
  return out
}
