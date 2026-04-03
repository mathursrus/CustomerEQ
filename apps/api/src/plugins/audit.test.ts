/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { inferAction, extractResourceId } from './audit.js'

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
