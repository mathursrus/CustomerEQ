import { describe, it, expect } from 'vitest'
import { mintToken, hashToken } from './distributionTokens.js'

describe('mintToken', () => {
  it('produces a base64url-safe plaintext (no +, /, or = chars)', () => {
    for (let i = 0; i < 100; i++) {
      const { plaintext } = mintToken()
      expect(plaintext).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('produces 24 random bytes encoded as base64url (32 chars unpadded)', () => {
    // 24 bytes → ceil(24 / 3) * 4 = 32 chars, but base64url strips trailing '=' padding
    // so the length is 32 (24 bytes is divisible by 3 → no padding needed).
    const { plaintext } = mintToken()
    expect(plaintext).toHaveLength(32)
  })

  it('produces a 64-char hex hash (SHA-256)', () => {
    const { hash } = mintToken()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hash is deterministically derived from the plaintext', () => {
    const { plaintext, hash } = mintToken()
    expect(hashToken(plaintext)).toBe(hash)
  })

  it('prefix is the first 8 characters of plaintext', () => {
    const { plaintext, prefix } = mintToken()
    expect(prefix).toBe(plaintext.slice(0, 8))
    expect(prefix).toHaveLength(8)
  })

  it('produces unique plaintext across many mints (collision check)', () => {
    const seen = new Set<string>()
    const N = 10_000
    for (let i = 0; i < N; i++) {
      const { plaintext } = mintToken()
      seen.add(plaintext)
    }
    // 192 bits of entropy in 10k samples — probability of collision is
    // effectively zero (birthday-paradox bound ≈ 2^-160).
    expect(seen.size).toBe(N)
  })
})

describe('hashToken', () => {
  it('is deterministic — same input maps to same digest', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('different inputs map to different digests', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('produces a 64-char hex string for arbitrary input length', () => {
    expect(hashToken('')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('a'.repeat(1000))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches the known SHA-256 digest of "abc"', () => {
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
