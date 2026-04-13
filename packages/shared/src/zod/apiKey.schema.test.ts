/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { CreateApiKeySchema } from './apiKey.schema.js'

describe('CreateApiKeySchema', () => {
  it('accepts a valid name', () => {
    const result = CreateApiKeySchema.safeParse({ name: 'Production' })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from the name', () => {
    const result = CreateApiKeySchema.safeParse({ name: '  Production  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Production')
  })

  it('rejects empty name', () => {
    const result = CreateApiKeySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = CreateApiKeySchema.safeParse({ name: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = CreateApiKeySchema.safeParse({ name: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts a 100-char name (boundary)', () => {
    const result = CreateApiKeySchema.safeParse({ name: 'x'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = CreateApiKeySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
