/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  signupRequestSchema,
  oauthFinishRequestSchema,
  oauthStartQuerySchema,
  oauthProviderParamSchema,
  oauthReturnToSchema,
  siteDomainSchema,
} from './onboarding.schema.js'

describe('signupRequestSchema', () => {
  const valid = {
    email: 'admin@acme.test',
    password: 'pw12345678',
    name: 'Ada Lovelace',
    orgName: 'Acme',
    agreedToTos: true as const,
  }

  it('accepts a well-formed payload', () => {
    expect(signupRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = signupRequestSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects passwords under 8 chars', () => {
    const result = signupRequestSchema.safeParse({ ...valid, password: 'pw1' })
    expect(result.success).toBe(false)
  })

  it('rejects letter-only passwords (no digit)', () => {
    const result = signupRequestSchema.safeParse({ ...valid, password: 'onlyletters' })
    expect(result.success).toBe(false)
  })

  it('rejects digit-only passwords (no letter)', () => {
    const result = signupRequestSchema.safeParse({ ...valid, password: '123456789' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name (after trim)', () => {
    const result = signupRequestSchema.safeParse({ ...valid, name: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 chars', () => {
    const result = signupRequestSchema.safeParse({ ...valid, name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects orgName over 100 chars', () => {
    const result = signupRequestSchema.safeParse({ ...valid, orgName: 'b'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects agreedToTos = false', () => {
    const result = signupRequestSchema.safeParse({ ...valid, agreedToTos: false })
    expect(result.success).toBe(false)
  })

  it('rejects missing agreedToTos', () => {
    const { agreedToTos: _drop, ...withoutTos } = valid
    const result = signupRequestSchema.safeParse(withoutTos)
    expect(result.success).toBe(false)
  })
})

describe('oauthFinishRequestSchema', () => {
  it('accepts a well-formed orgName', () => {
    expect(oauthFinishRequestSchema.safeParse({ orgName: 'Acme' }).success).toBe(true)
  })

  it('rejects empty orgName', () => {
    expect(oauthFinishRequestSchema.safeParse({ orgName: '' }).success).toBe(false)
  })

  it('trims whitespace', () => {
    const result = oauthFinishRequestSchema.parse({ orgName: '  Acme  ' })
    expect(result.orgName).toBe('Acme')
  })
})

describe('oauthProviderParamSchema', () => {
  it('accepts lowercase alphanumeric provider names', () => {
    expect(oauthProviderParamSchema.safeParse({ provider: 'google' }).success).toBe(true)
    expect(oauthProviderParamSchema.safeParse({ provider: 'github' }).success).toBe(true)
    expect(oauthProviderParamSchema.safeParse({ provider: 'microsoft365' }).success).toBe(true)
  })

  it('rejects names with hyphens, underscores, or spaces', () => {
    expect(oauthProviderParamSchema.safeParse({ provider: 'my-provider' }).success).toBe(false)
    expect(oauthProviderParamSchema.safeParse({ provider: 'my_provider' }).success).toBe(false)
    expect(oauthProviderParamSchema.safeParse({ provider: 'my provider' }).success).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(oauthProviderParamSchema.safeParse({ provider: 'Google' }).success).toBe(false)
  })
})

describe('oauthReturnToSchema (SEC-170-002)', () => {
  it('accepts a relative /admin/ path', () => {
    expect(oauthReturnToSchema.safeParse('/admin/onboarding/profile').success).toBe(true)
  })

  it('accepts /admin (bare)', () => {
    expect(oauthReturnToSchema.safeParse('/admin').success).toBe(true)
  })

  it('accepts /admin/ with query string', () => {
    expect(oauthReturnToSchema.safeParse('/admin?welcome=1').success).toBe(true)
  })

  it('accepts /admin/ with hash', () => {
    expect(oauthReturnToSchema.safeParse('/admin#section').success).toBe(true)
  })

  it('rejects non-/admin relative paths', () => {
    expect(oauthReturnToSchema.safeParse('/etc/passwd').success).toBe(false)
    expect(oauthReturnToSchema.safeParse('/home').success).toBe(false)
  })

  it('rejects paths that look like /admin but are not (path-traversal-style)', () => {
    expect(oauthReturnToSchema.safeParse('/administrator').success).toBe(false)
    expect(oauthReturnToSchema.safeParse('/admin..').success).toBe(false)
  })

  it('accepts fully-qualified http(s) URLs (host check happens in route handler)', () => {
    expect(oauthReturnToSchema.safeParse('https://app.customereq.test/admin').success).toBe(true)
    expect(oauthReturnToSchema.safeParse('http://localhost:3000/admin').success).toBe(true)
  })

  it('rejects non-http(s) protocols', () => {
    expect(oauthReturnToSchema.safeParse('javascript:alert(1)').success).toBe(false)
    expect(oauthReturnToSchema.safeParse('file:///etc/passwd').success).toBe(false)
    expect(oauthReturnToSchema.safeParse('ftp://example.com').success).toBe(false)
  })

  it('rejects garbage strings', () => {
    expect(oauthReturnToSchema.safeParse('not-a-path-at-all').success).toBe(false)
    expect(oauthReturnToSchema.safeParse('').success).toBe(false)
  })
})

describe('oauthStartQuerySchema', () => {
  it('treats returnTo as optional', () => {
    expect(oauthStartQuerySchema.safeParse({}).success).toBe(true)
  })

  it('validates returnTo when present', () => {
    expect(oauthStartQuerySchema.safeParse({ returnTo: '/admin' }).success).toBe(true)
    expect(oauthStartQuerySchema.safeParse({ returnTo: '/etc/passwd' }).success).toBe(false)
  })
})

describe('siteDomainSchema', () => {
  it('accepts bare domains', () => {
    expect(siteDomainSchema.safeParse('acme.com').success).toBe(true)
    expect(siteDomainSchema.safeParse('sub.acme.com').success).toBe(true)
  })

  it('accepts http and https schemes', () => {
    expect(siteDomainSchema.safeParse('https://acme.com').success).toBe(true)
    expect(siteDomainSchema.safeParse('http://acme.com').success).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(siteDomainSchema.safeParse('not a domain').success).toBe(false)
    expect(siteDomainSchema.safeParse('acme').success).toBe(false)
  })
})
