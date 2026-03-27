/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import { DemoRequestSchema } from './demoRequest.schema.js'

describe('DemoRequestSchema', () => {
  const validFull = {
    firstName: 'Jane',
    lastName: 'Doe',
    workEmail: 'jane@acme.com',
    companyName: 'Acme Corp',
    companySize: '51-200' as const,
    message: 'Interested in a demo for our loyalty program.',
  }

  it('accepts valid full request', () => {
    const result = DemoRequestSchema.safeParse(validFull)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe('Jane')
      expect(result.data.companySize).toBe('51-200')
    }
  })

  it('accepts valid request without optional fields', () => {
    const result = DemoRequestSchema.safeParse({
      firstName: 'John',
      lastName: 'Smith',
      workEmail: 'john@example.com',
      companyName: 'Example Inc',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.companySize).toBeUndefined()
      expect(result.data.message).toBeUndefined()
    }
  })

  it('rejects missing firstName', () => {
    const result = DemoRequestSchema.safeParse({
      lastName: 'Doe',
      workEmail: 'jane@acme.com',
      companyName: 'Acme Corp',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = DemoRequestSchema.safeParse({
      firstName: 'Jane',
      lastName: 'Doe',
      workEmail: 'not-an-email',
      companyName: 'Acme Corp',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing companyName', () => {
    const result = DemoRequestSchema.safeParse({
      firstName: 'Jane',
      lastName: 'Doe',
      workEmail: 'jane@acme.com',
    })
    expect(result.success).toBe(false)
  })

  it.each(['1-10', '11-50', '51-200', '201-1000', '1000+'] as const)(
    'accepts company size %s',
    (companySize) => {
      const result = DemoRequestSchema.safeParse({
        firstName: 'Jane',
        lastName: 'Doe',
        workEmail: 'jane@acme.com',
        companyName: 'Acme Corp',
        companySize,
      })
      expect(result.success).toBe(true)
    },
  )
})
