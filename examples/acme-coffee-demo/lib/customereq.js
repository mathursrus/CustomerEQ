// Tiny SDK wrapper around the CustomerEQ HTTP API.
//
// This file is intentionally dependency-free and ~150 lines so that any
// integrator can copy-paste it into their own backend (Node, Deno, Bun) as
// a starting point. In a real integration you'd likely turn this into a
// proper npm package, add retries, types, etc. — but the API surface is
// small enough that the raw fetch calls are easy to read.

import { setTimeout as sleep } from 'node:timers/promises'

const DEFAULT_RETRIES = 3
const DEFAULT_BACKOFF_MS = 500

export class CustomerEQ {
  constructor({ apiUrl, apiKey, brandId }) {
    if (!apiUrl) throw new Error('CustomerEQ: apiUrl is required')
    if (!apiKey) throw new Error('CustomerEQ: apiKey is required')
    if (!brandId) throw new Error('CustomerEQ: brandId is required')
    this.apiUrl = apiUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.brandId = brandId
  }

  async request(method, path, { body, query, publicRoute = false, retries = DEFAULT_RETRIES } = {}) {
    const url = new URL(`${this.apiUrl}${path}`)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
      }
    }

    const headers = { 'Content-Type': 'application/json' }
    if (!publicRoute) {
      headers['X-Api-Key'] = this.apiKey
      headers['X-Brand-Id'] = this.brandId
    }

    let attempt = 0
    let lastErr
    while (attempt < retries) {
      attempt++
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
        if (res.status >= 500 && attempt < retries) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1))
          continue
        }
        const text = await res.text()
        const data = text ? JSON.parse(text) : null
        if (!res.ok) {
          const err = new Error(`CustomerEQ ${method} ${path} → ${res.status}: ${text}`)
          err.status = res.status
          err.body = data
          throw err
        }
        return data
      } catch (err) {
        lastErr = err
        if (attempt >= retries || (err.status && err.status < 500)) throw err
        await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1))
      }
    }
    throw lastErr
  }

  // ── Members ────────────────────────────────────────────────────────────
  enrollMember({ email, firstName, lastName, programId }) {
    return this.request('POST', '/v1/members/enroll', {
      publicRoute: true,
      body: {
        email,
        firstName,
        lastName,
        programId,
        consentGiven: true,
        consentGivenAt: new Date().toISOString(),
      },
    })
  }

  getMember(memberId) {
    return this.request('GET', `/v1/members/${memberId}`)
  }

  getMemberBalance(memberId) {
    return this.request('GET', `/v1/members/${memberId}/balance`)
  }

  getMember360(memberId) {
    return this.request('GET', `/v1/members/${memberId}/360`)
  }

  // ── Loyalty events (the heart of any integration) ─────────────────────
  ingestEvent({ memberId, eventType, payload, idempotencyKey }) {
    return this.request('POST', '/v1/events', {
      body: { memberId, eventType, payload, idempotencyKey },
    })
  }

  // ── Programs & rewards ────────────────────────────────────────────────
  getProgramBySlug(slug) {
    return this.request('GET', `/v1/public/programs/by-slug/${slug}`, { publicRoute: true })
  }

  listRewards() {
    return this.request('GET', '/v1/rewards')
  }

  redeemReward({ rewardId, memberId }) {
    return this.request('POST', '/v1/redemptions', { body: { rewardId, memberId } })
  }

  // ── Surveys ───────────────────────────────────────────────────────────
  triggerSurvey({ memberEmail, surveyId, source = 'acme-coffee' }) {
    return this.request('POST', '/v1/public/surveys/trigger', {
      publicRoute: true,
      body: { memberEmail, surveyId, source },
    })
  }

  // ── CRM notes ─────────────────────────────────────────────────────────
  addMemberNote({ memberId, body, category = 'note', sentiment = 'neutral', author }) {
    return this.request('POST', `/v1/members/${memberId}/notes`, {
      body: { body, category, sentiment, author },
    })
  }

  // ── External signals (reviews from Google, Reddit, X, ...) ────────────
  // This is a PUBLIC webhook endpoint: Acme forwards review payloads it
  // receives from its own integrations (Google Business Profile, Reddit
  // API, etc.) straight to CustomerEQ. The sourceId + shared secret is
  // provisioned per-source in CustomerEQ admin.
  pushExternalSignal({ sourceId, sourceSecret, payload }) {
    const url = new URL(`${this.apiUrl}/v1/integrations/webhooks/external-signals/${sourceId}`)
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sourceSecret ? { 'X-Source-Secret': sourceSecret } : {}),
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const text = await res.text()
      if (!res.ok) throw new Error(`External signal push ${res.status}: ${text}`)
      return text ? JSON.parse(text) : null
    })
  }

  // ── KB / RAG (used by Acme support pages) ─────────────────────────────
  searchKnowledgeBase({ query, limit = 5 }) {
    return this.request('GET', '/v1/kb/search', { query: { q: query, limit } })
  }

  // ── Analytics (the customer's ops team would call these) ──────────────
  // startDate + endDate are required by the API. Default to trailing 30 days
  // if caller doesn't supply them.
  getCxAnalytics({ startDate, endDate } = {}) {
    const end = endDate ?? new Date().toISOString()
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    return this.request('GET', '/v1/analytics/cx', { query: { startDate: start, endDate: end } })
  }
}
