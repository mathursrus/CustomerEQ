// Issue #231 R18 — audit-only enrollment-signal capture.
//
// On auto-enroll the server captures a small audit trail in
// LoyaltyEvent.payload.enrollmentSignals = { ipHash, ipCountryIso, capturedAt }.
// The raw IP is never stored or logged; only its salted SHA-256 hash. The
// salt is the brand id, so the same IP across two brands does not collide.
//
// The hash gives auditors a way to correlate "the same anonymous responder
// hit two surveys" within a brand without ever revealing the IP itself, and
// the ISO country code provides jurisdictional inference (Art. 6(1)(f)
// legitimate interest — security, audit, and downstream localization).

import crypto from 'node:crypto'

export interface EnrollmentSignals {
  ipHash: string | null
  ipCountryIso: string | null
  capturedAt: string
}

export function hashIpForBrand(ip: string | null | undefined, brandId: string): string | null {
  if (!ip || typeof ip !== 'string' || ip.length === 0) return null
  return crypto.createHmac('sha256', brandId).update(ip).digest('hex')
}

export interface BuildEnrollmentSignalsArgs {
  ip: string | null | undefined
  brandId: string
  ipCountryIso: string | null
  capturedAt?: Date
}

export function buildEnrollmentSignals(args: BuildEnrollmentSignalsArgs): EnrollmentSignals {
  return {
    ipHash: hashIpForBrand(args.ip, args.brandId),
    ipCountryIso: args.ipCountryIso,
    capturedAt: (args.capturedAt ?? new Date()).toISOString(),
  }
}
