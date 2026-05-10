/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { inferAction, extractResourceId, filterMetadata } from './audit.js'

// ---------------------------------------------------------------------------
// inferAction — maps HTTP method + route path to an audit action string
// ---------------------------------------------------------------------------

describe('inferAction', () => {
  it('maps POST to resource.create', () => {
    expect(inferAction('POST', '/v1/campaigns')).toBe('campaign.create')
  })

  it('maps PATCH to resource.update', () => {
    expect(inferAction('PATCH', '/v1/programs/:id')).toBe('program.update')
  })

  it('maps DELETE to resource.delete', () => {
    expect(inferAction('DELETE', '/v1/rewards/:id')).toBe('reward.delete')
  })

  it('maps PUT to resource.update', () => {
    expect(inferAction('PUT', '/v1/members/:id')).toBe('member.update')
  })

  it('detects /status sub-resource as status_update', () => {
    expect(inferAction('PATCH', '/v1/campaigns/:id/status')).toBe('campaign.status_update')
  })

  it('detects /rules sub-resource as rule_create', () => {
    expect(inferAction('POST', '/v1/programs/:id/rules')).toBe('program.rule_create')
  })

  it('detects /enroll sub-resource', () => {
    expect(inferAction('POST', '/v1/programs/:id/enroll')).toBe('program.enroll')
  })

  it('handles demo-requests with hyphens', () => {
    expect(inferAction('POST', '/v1/demo-requests')).toBe('demo_request.create')
  })

  it('handles unknown resources', () => {
    expect(inferAction('POST', '/v1/widgets')).toBe('widgets.create')
  })

  it('handles unknown methods', () => {
    expect(inferAction('OPTIONS', '/v1/campaigns')).toBe('campaign.unknown')
  })
})

// ---------------------------------------------------------------------------
// extractResourceId — extracts :id param value from URL
// ---------------------------------------------------------------------------

describe('extractResourceId', () => {
  it('extracts id from /v1/campaigns/:id', () => {
    expect(extractResourceId('/v1/campaigns/:id', '/v1/campaigns/abc-123')).toBe('abc-123')
  })

  it('extracts first param from nested route', () => {
    expect(extractResourceId('/v1/programs/:id/status', '/v1/programs/prog-456/status')).toBe('prog-456')
  })

  it('strips query parameters', () => {
    expect(extractResourceId('/v1/rewards/:id', '/v1/rewards/rew-789?include=stock')).toBe('rew-789')
  })

  it('returns "unknown" when no param is found', () => {
    expect(extractResourceId('/v1/campaigns', '/v1/campaigns')).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// filterMetadata — Issue #292 Slice 3 / RFC §9.
// Per-route metadata allowlist: route handlers populate request.audit.metadata
// with whatever keys make sense for their action; the plugin filters to the
// allowlist before persisting so no route can accidentally leak request bodies,
// secrets, or unaudited fields into the AuditEvent row.
// ---------------------------------------------------------------------------

describe('filterMetadata', () => {
  it('returns only allowlisted keys', () => {
    const meta = {
      changedFields: ['name', 'siteDomain'],
      before: { name: 'Old' },
      after: { name: 'New' },
      method: 'PATCH',           // not in allowlist — should drop
      authorization: 'secret',   // not in allowlist — should drop
    }
    const allow = ['changedFields', 'before', 'after']
    expect(filterMetadata(meta, allow)).toEqual({
      changedFields: ['name', 'siteDomain'],
      before: { name: 'Old' },
      after: { name: 'New' },
    })
  })

  it('omits allowlisted keys that are absent in metadata', () => {
    const meta = { changedFields: ['name'] }
    const allow = ['changedFields', 'before', 'after']
    expect(filterMetadata(meta, allow)).toEqual({ changedFields: ['name'] })
  })

  it('returns an empty object when metadata is empty', () => {
    expect(filterMetadata({}, ['changedFields'])).toEqual({})
  })

  it('returns an empty object when allowlist is empty', () => {
    expect(filterMetadata({ changedFields: ['x'] }, [])).toEqual({})
  })

  it('preserves nested object values for allowlisted keys', () => {
    const meta = {
      attestation: {
        admin: 'user_123',
        justification: 'legal counsel approved',
        attestedAt: '2026-05-07T00:00:00Z',
      },
      memberCountAtChange: 42,
      secret: 'should-be-stripped',
    }
    const allow = ['attestation', 'memberCountAtChange']
    expect(filterMetadata(meta, allow)).toEqual({
      attestation: {
        admin: 'user_123',
        justification: 'legal counsel approved',
        attestedAt: '2026-05-07T00:00:00Z',
      },
      memberCountAtChange: 42,
    })
  })

  it('drops undefined values for allowlisted keys (no key in output)', () => {
    const meta: Record<string, unknown> = {
      changedFields: ['name'],
      attestation: undefined,
    }
    const allow = ['changedFields', 'attestation']
    expect(filterMetadata(meta, allow)).toEqual({ changedFields: ['name'] })
  })
})
