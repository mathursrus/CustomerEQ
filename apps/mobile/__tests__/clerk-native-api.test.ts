/**
 * Regression guard: Clerk Native API must remain enabled.
 *
 * Root cause of v18 TestFlight "error on auth" (issue #513):
 *   Clerk Dashboard had "Native Applications" disabled. Every request from clerk-expo
 *   appends _is_native=1; with the feature off, Clerk returned native_api_disabled
 *   and isLoaded never resolved, triggering the AUTH_TIMEOUT error screen.
 *
 * These tests hit the live Clerk FAPI directly. They FAIL loudly — never skip —
 * if the network is unreachable or if Native API is turned off again.
 *
 * To re-enable if this test fails:
 *   Clerk Dashboard → Configure → Native Applications → toggle "Enable Native API"
 */

import * as https from 'https'

const CLERK_FAPI = 'https://clerk.customereq.wellnessatwork.me'
const TIMEOUT_MS = 15_000

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out after ${TIMEOUT_MS}ms: ${url}`))
    })
    req.on('error', (err) => reject(new Error(`Network error reaching Clerk FAPI: ${err.message}`)))
  })
}

function parseJson(body: string, context: string): any {
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${context} returned non-JSON:\n${body.slice(0, 500)}`)
  }
}

describe('Clerk Native API — regression guard (issue #513)', () => {
  jest.setTimeout(25_000)

  it('accepts _is_native=1 without native_api_disabled error', async () => {
    const { body, status } = await get(`${CLERK_FAPI}/v1/client?_is_native=1`)
    const json = parseJson(body, 'GET /v1/client?_is_native=1')

    const errors: Array<{ code: string }> = json?.errors ?? []
    const disabled = errors.some((e) => e.code === 'native_api_disabled')

    if (disabled) {
      throw new Error(
        'CLERK NATIVE API IS DISABLED — this will break all TestFlight/production logins.\n' +
        'Fix: Clerk Dashboard → Configure → Native Applications → enable "Native API".\n' +
        `FAPI URL: ${CLERK_FAPI}\n` +
        `Response (${status}): ${body.slice(0, 300)}`
      )
    }

    // Any non-network response means the endpoint is reachable and not blocking native calls.
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(600)
    expect(disabled).toBe(false)
  })

  it('FAPI host is reachable', async () => {
    const { status, body } = await get(`${CLERK_FAPI}/v1/environment`)

    if (status === 0) {
      throw new Error(`Cannot reach Clerk FAPI at ${CLERK_FAPI} — DNS or network failure`)
    }

    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(600)

    const json = parseJson(body, 'GET /v1/environment')
    // A valid Clerk environment response is an object, not an array or null
    expect(json).not.toBeNull()
    expect(typeof json).toBe('object')
    expect(Array.isArray(json)).toBe(false)
  })
})
