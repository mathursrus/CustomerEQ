/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  CreateExternalSignalSourceSchema,
  UpdateExternalSignalSourceSchema,
  ExternalSignalSourceListQuerySchema,
  ExternalSignalsQuerySchema,
  Customer360ExternalSignalSchema,
} from './externalSignal.schema.js'

describe('CreateExternalSignalSourceSchema', () => {
  it('accepts a minimal valid source', () => {
    const result = CreateExternalSignalSourceSchema.safeParse({
      name: 'Google Reviews',
      sourceType: 'GOOGLE_BUSINESS_PROFILE',
      connectionMethod: 'oauth',
      syncMode: 'POLL',
      scopeConfig: { locationIds: ['loc_123'] },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enabled).toBe(false)
      expect(result.data.filterConfig).toBeNull()
      expect(result.data.matchingConfig).toBeNull()
    }
  })

  it('rejects an empty name', () => {
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        name: '',
        sourceType: 'GENERIC_WEBHOOK',
        connectionMethod: 'webhook_secret',
        syncMode: 'WEBHOOK',
        scopeConfig: {},
      }).success,
    ).toBe(false)
  })

  it('accepts all supported source types in the registry', () => {
    const baseInput = {
      name: 'Source',
      connectionMethod: 'oauth',
      syncMode: 'POLL',
      scopeConfig: {},
    }

    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'GOOGLE_BUSINESS_PROFILE',
      }).success,
    ).toBe(true)
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'LINKEDIN_ORG',
      }).success,
    ).toBe(true)
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'REDDIT',
      }).success,
    ).toBe(true)
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'X',
      }).success,
    ).toBe(true)
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'GENERIC_WEBHOOK',
        syncMode: 'WEBHOOK',
        connectionMethod: 'webhook_secret',
      }).success,
    ).toBe(true)
    expect(
      CreateExternalSignalSourceSchema.safeParse({
        ...baseInput,
        sourceType: 'GENERIC_API',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateExternalSignalSourceSchema', () => {
  it('accepts partial updates', () => {
    expect(UpdateExternalSignalSourceSchema.safeParse({ enabled: true }).success).toBe(true)
  })

  it('rejects an empty object', () => {
    expect(UpdateExternalSignalSourceSchema.safeParse({}).success).toBe(false)
  })
})

describe('ExternalSignalSourceListQuerySchema', () => {
  it('applies pagination defaults', () => {
    const result = ExternalSignalSourceListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })
})

describe('ExternalSignalsQuerySchema', () => {
  it('coerces numeric filters', () => {
    const result = ExternalSignalsQuerySchema.parse({
      ratingMin: '2',
      sentimentMax: '0.3',
      page: '2',
      pageSize: '50',
    })

    expect(result.ratingMin).toBe(2)
    expect(result.sentimentMax).toBe(0.3)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(50)
  })

  it('rejects out-of-range sentiment filters', () => {
    expect(ExternalSignalsQuerySchema.safeParse({ sentimentMin: '-2' }).success).toBe(false)
  })
})

describe('Customer360ExternalSignalSchema', () => {
  it('accepts the member 360 external signal shape', () => {
    expect(
      Customer360ExternalSignalSchema.safeParse({
        id: 'sig_1',
        sourceId: 'src_1',
        sourceType: 'GENERIC_WEBHOOK',
        sourceName: 'Webhook Source',
        body: 'Customer said the product arrived late.',
        summary: null,
        rating: 2,
        sentiment: -0.7,
        topics: ['shipping'],
        canonicalUrl: 'https://example.com/reviews/1',
        externalAuthorLabel: 'customer123',
        subjectLabel: 'Widget A',
        postedAt: new Date().toISOString(),
        matchConfidence: 1,
      }).success,
    ).toBe(true)
  })
})
