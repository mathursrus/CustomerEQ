/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  SearchMembersQuerySchema,
  Customer360QuerySchema,
} from './member.schema.js'

describe('SearchMembersQuerySchema', () => {
  it('parses valid query with all defaults', () => {
    const result = SearchMembersQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.sortBy).toBe('createdAt')
    expect(result.sortOrder).toBe('desc')
    expect(result.q).toBeUndefined()
    expect(result.tier).toBeUndefined()
  })

  it('parses full query with all filters', () => {
    const result = SearchMembersQuerySchema.parse({
      q: 'alice',
      tier: 'Gold',
      sentimentMin: '-0.5',
      sentimentMax: '0.8',
      npsMin: '6',
      npsMax: '10',
      balanceMin: '100',
      balanceMax: '5000',
      status: 'ACTIVE',
      enrolledAfter: '2025-01-01T00:00:00.000Z',
      enrolledBefore: '2026-01-01T00:00:00.000Z',
      page: '2',
      pageSize: '10',
      sortBy: 'name',
      sortOrder: 'asc',
    })

    expect(result.q).toBe('alice')
    expect(result.tier).toBe('Gold')
    expect(result.sentimentMin).toBe(-0.5)
    expect(result.sentimentMax).toBe(0.8)
    expect(result.npsMin).toBe(6)
    expect(result.npsMax).toBe(10)
    expect(result.balanceMin).toBe(100)
    expect(result.balanceMax).toBe(5000)
    expect(result.status).toBe('ACTIVE')
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(10)
    expect(result.sortBy).toBe('name')
    expect(result.sortOrder).toBe('asc')
  })

  it('coerces string numbers to numeric types', () => {
    const result = SearchMembersQuerySchema.parse({
      sentimentMin: '0.2',
      npsMin: '7',
      balanceMin: '500',
      page: '3',
      pageSize: '50',
    })
    expect(typeof result.sentimentMin).toBe('number')
    expect(typeof result.npsMin).toBe('number')
    expect(typeof result.balanceMin).toBe('number')
    expect(typeof result.page).toBe('number')
    expect(typeof result.pageSize).toBe('number')
  })

  it('rejects sentiment values outside -1 to 1 range', () => {
    expect(() => SearchMembersQuerySchema.parse({ sentimentMin: '-2' })).toThrow()
    expect(() => SearchMembersQuerySchema.parse({ sentimentMax: '1.5' })).toThrow()
  })

  it('rejects NPS values outside 0-10 range', () => {
    expect(() => SearchMembersQuerySchema.parse({ npsMin: '-1' })).toThrow()
    expect(() => SearchMembersQuerySchema.parse({ npsMax: '11' })).toThrow()
  })

  it('rejects invalid status value', () => {
    expect(() => SearchMembersQuerySchema.parse({ status: 'DELETED' })).toThrow()
  })

  it('rejects page less than 1', () => {
    expect(() => SearchMembersQuerySchema.parse({ page: '0' })).toThrow()
  })

  it('rejects pageSize greater than 100', () => {
    expect(() => SearchMembersQuerySchema.parse({ pageSize: '101' })).toThrow()
  })

  it('rejects negative balance values', () => {
    expect(() => SearchMembersQuerySchema.parse({ balanceMin: '-1' })).toThrow()
  })

  it('accepts all valid sortBy values', () => {
    for (const sortBy of ['name', 'email', 'pointsBalance', 'createdAt', 'sentiment']) {
      const result = SearchMembersQuerySchema.parse({ sortBy })
      expect(result.sortBy).toBe(sortBy)
    }
  })

  it('rejects invalid sortBy value', () => {
    expect(() => SearchMembersQuerySchema.parse({ sortBy: 'invalid' })).toThrow()
  })
})

describe('Customer360QuerySchema', () => {
  it('parses with all defaults', () => {
    const result = Customer360QuerySchema.parse({})
    expect(result.eventsLimit).toBe(20)
    expect(result.surveysLimit).toBe(10)
    expect(result.redemptionsLimit).toBe(10)
    expect(result.campaignEventsLimit).toBe(10)
  })

  it('parses custom limits from string values', () => {
    const result = Customer360QuerySchema.parse({
      eventsLimit: '5',
      surveysLimit: '3',
      redemptionsLimit: '15',
      campaignEventsLimit: '8',
    })
    expect(result.eventsLimit).toBe(5)
    expect(result.surveysLimit).toBe(3)
    expect(result.redemptionsLimit).toBe(15)
    expect(result.campaignEventsLimit).toBe(8)
  })

  it('rejects eventsLimit above 100', () => {
    expect(() => Customer360QuerySchema.parse({ eventsLimit: '101' })).toThrow()
  })

  it('rejects surveysLimit below 1', () => {
    expect(() => Customer360QuerySchema.parse({ surveysLimit: '0' })).toThrow()
  })

  it('rejects non-integer values', () => {
    expect(() => Customer360QuerySchema.parse({ eventsLimit: '5.5' })).toThrow()
  })
})
