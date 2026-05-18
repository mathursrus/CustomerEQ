// Issue #378 — opaque tokens for personalized survey distribution links.
//
// Tokens are 24 random bytes (192 bits of entropy) encoded as base64url so
// they are safe to embed in URL path segments. Only the SHA-256 hash is stored
// at rest (see `tokenHash` on `SurveyDistributionToken`); the plaintext exists
// transiently in the response of `POST /v1/surveys/:id/distribution-batches`
// (and its regenerate counterpart) and never again. This mirrors the
// `ApiKey.keyHash` precedent in `apps/api/src/plugins/auth.ts`.
//
// Server-only — imports `node:crypto`. Consumed via the `@customerEQ/shared/distributionTokens`
// subpath export (matches the `random.ts` pattern). Do not re-export from `index.ts`
// (browser bundlers will fail).

import { randomBytes, createHash } from 'node:crypto'

const TOKEN_BYTES = 24
const PREFIX_LENGTH = 8

export interface MintedToken {
  /** The plaintext token, base64url-encoded. Returned to the operator exactly once. */
  plaintext: string
  /** SHA-256 hex digest of the plaintext. Persisted as `SurveyDistributionToken.tokenHash`. */
  hash: string
  /** First 8 characters of the plaintext. Persisted as `tokenPrefix` for operator-side display. */
  prefix: string
}

export function mintToken(): MintedToken {
  const plaintext = randomBytes(TOKEN_BYTES).toString('base64url')
  const hash = hashToken(plaintext)
  return { plaintext, hash, prefix: plaintext.slice(0, PREFIX_LENGTH) }
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}
