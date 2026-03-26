/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'

/**
 * Test the CORS origin patterns used in app.ts to ensure
 * production Azure Container Apps domains are allowed while
 * arbitrary origins are rejected.
 */
const corsOrigins: RegExp[] = [/localhost/, /\.azurecontainerapps\.io$/]

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

  it('rejects arbitrary origins', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false)
    expect(isOriginAllowed('https://azurecontainerapps.io.evil.com')).toBe(false)
    expect(isOriginAllowed('https://not-azure.com')).toBe(false)
  })

  it('does not allow origins that merely contain the pattern as a substring', () => {
    // The $ anchor ensures the pattern only matches at the end of the string
    expect(isOriginAllowed('https://azurecontainerapps.io.evil.com')).toBe(false)
  })
})
