/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'

/**
 * Test the CORS origin patterns used in app.ts to ensure
 * production domains (Azure Container Apps + custom domain) are allowed
 * while arbitrary origins are rejected.
 */
const corsOrigins: RegExp[] = [/localhost/, /\.azurecontainerapps\.io$/, /\.wellnessatwork\.me$/]

function isOriginAllowed(origin: string): boolean {
  return corsOrigins.some((pattern) => pattern.test(origin))
}

describe('CORS origin configuration', () => {
  it('allows localhost origins', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true)
    expect(isOriginAllowed('http://localhost:4000')).toBe(true)
    expect(isOriginAllowed('http://localhost')).toBe(true)
  })

  it('allows Azure Container Apps origins', () => {
    expect(
      isOriginAllowed('https://customereq-web.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'),
    ).toBe(true)
    expect(
      isOriginAllowed('https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io'),
    ).toBe(true)
  })

  it('allows custom domain origins', () => {
    expect(isOriginAllowed('https://customereq.wellnessatwork.me')).toBe(true)
    expect(isOriginAllowed('https://api.wellnessatwork.me')).toBe(true)
  })

  it('rejects arbitrary origins', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false)
    expect(isOriginAllowed('https://azurecontainerapps.io.evil.com')).toBe(false)
    expect(isOriginAllowed('https://not-azure.com')).toBe(false)
    expect(isOriginAllowed('https://wellnessatwork.me.evil.com')).toBe(false)
  })

  it('does not allow origins that merely contain the pattern as a substring', () => {
    expect(isOriginAllowed('https://azurecontainerapps.io.evil.com')).toBe(false)
    expect(isOriginAllowed('https://wellnessatwork.me.evil.com')).toBe(false)
  })
})
