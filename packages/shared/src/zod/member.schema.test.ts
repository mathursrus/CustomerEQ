/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  SearchMembersQuerySchema,
  Customer360QuerySchema,
  HealthScoreWeightsSchema,
  HealthScoreFilterSchema,
  RecomputeHealthScoreSchema,
  CreateMemberNoteSchema,
  UpdateMemberNoteSchema,
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
    for (const sortBy of ['name', 'email', 'pointsBalance', 'createdAt', 'sentiment', 'healthScore']) {
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

// ---------------------------------------------------------------------------
// Health Score Schemas
// ---------------------------------------------------------------------------

describe('HealthScoreWeightsSchema', () => {
  it('accepts valid default weights that sum to 1.0', () => {
    const input = {
      recency: 0.25,
      frequency: 0.20,
      sentiment: 0.25,
      nps: 0.15,
      engagement: 0.15,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects weights that do not sum to 1.0', () => {
    const input = {
      recency: 0.5,
      frequency: 0.5,
      sentiment: 0.5,
      nps: 0.5,
      engagement: 0.5,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects negative weights', () => {
    const input = {
      recency: -0.1,
      frequency: 0.30,
      sentiment: 0.30,
      nps: 0.25,
      engagement: 0.25,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects weights greater than 1', () => {
    const input = {
      recency: 1.5,
      frequency: 0,
      sentiment: 0,
      nps: 0,
      engagement: -0.5,
    }
    const result = HealthScoreWeightsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('applies default values when fields are omitted', () => {
    const result = HealthScoreWeightsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recency).toBe(0.25)
      expect(result.data.frequency).toBe(0.20)
      expect(result.data.sentiment).toBe(0.25)
      expect(result.data.nps).toBe(0.15)
      expect(result.data.engagement).toBe(0.15)
    }
  })
})

describe('HealthScoreFilterSchema', () => {
  it('accepts valid healthScoreMin and healthScoreMax', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 0, healthScoreMax: 100 })
    expect(result.success).toBe(true)
  })

  it('accepts only healthScoreMin', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 30 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMin).toBe(30)
      expect(result.data.healthScoreMax).toBeUndefined()
    }
  })

  it('accepts only healthScoreMax', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMax: 70 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMax).toBe(70)
    }
  })

  it('accepts empty object (both optional)', () => {
    const result = HealthScoreFilterSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('coerces string values to numbers', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: '20', healthScoreMax: '80' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.healthScoreMin).toBe(20)
      expect(result.data.healthScoreMax).toBe(80)
    }
  })

  it('rejects values below 0', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects values above 100', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMax: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer values', () => {
    const result = HealthScoreFilterSchema.safeParse({ healthScoreMin: 30.5 })
    expect(result.success).toBe(false)
  })
})

describe('RecomputeHealthScoreSchema', () => {
  it('accepts empty object (memberId optional)', () => {
    const result = RecomputeHealthScoreSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts memberId when provided', () => {
    const result = RecomputeHealthScoreSchema.safeParse({ memberId: 'member-abc-123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.memberId).toBe('member-abc-123')
    }
  })

  it('rejects non-string memberId', () => {
    const result = RecomputeHealthScoreSchema.safeParse({ memberId: 123 })
    expect(result.success).toBe(false)
  })
})

describe('CreateMemberNoteSchema', () => {
  it('accepts minimal valid note (body only)', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'Called customer, all good.' })
    expect(r.success).toBe(true)
  })

  it('accepts full payload with category + sentiment + author', () => {
    const r = CreateMemberNoteSchema.safeParse({
      body: 'Churn risk',
      category: 'call',
      sentiment: 'very_negative',
      author: 'sarah@customereq.demo',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.category).toBe('call')
      expect(r.data.sentiment).toBe('very_negative')
    }
  })

  it('trims whitespace from body', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: '   hello   ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.body).toBe('hello')
  })

  it('rejects empty body', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: '' })
    expect(r.success).toBe(false)
  })

  it('rejects whitespace-only body (after trim)', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: '   ' })
    expect(r.success).toBe(false)
  })

  it('rejects body > 4000 chars', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'x'.repeat(4001) })
    expect(r.success).toBe(false)
  })

  it('accepts body at the 4000-char boundary', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'x'.repeat(4000) })
    expect(r.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'ok', category: 'phone' })
    expect(r.success).toBe(false)
  })

  it('accepts each valid category', () => {
    for (const c of ['call', 'email', 'meeting', 'note', 'escalation', 'win-back']) {
      const r = CreateMemberNoteSchema.safeParse({ body: 'ok', category: c })
      expect(r.success).toBe(true)
    }
  })

  it('rejects invalid sentiment', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'ok', sentiment: 'mixed' })
    expect(r.success).toBe(false)
  })

  it('accepts each valid sentiment', () => {
    for (const s of ['very_negative', 'negative', 'neutral', 'positive', 'very_positive']) {
      const r = CreateMemberNoteSchema.safeParse({ body: 'ok', sentiment: s })
      expect(r.success).toBe(true)
    }
  })

  it('rejects author > 200 chars', () => {
    const r = CreateMemberNoteSchema.safeParse({ body: 'ok', author: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })
})

describe('UpdateMemberNoteSchema', () => {
  it('accepts body-only update', () => {
    const r = UpdateMemberNoteSchema.safeParse({ body: 'Corrected note' })
    expect(r.success).toBe(true)
  })

  it('accepts sentiment-only update', () => {
    const r = UpdateMemberNoteSchema.safeParse({ sentiment: 'positive' })
    expect(r.success).toBe(true)
  })

  it('accepts category-only update', () => {
    const r = UpdateMemberNoteSchema.safeParse({ category: 'email' })
    expect(r.success).toBe(true)
  })

  it('allows clearing sentiment with null', () => {
    const r = UpdateMemberNoteSchema.safeParse({ sentiment: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.sentiment).toBeNull()
  })

  it('allows clearing category with null', () => {
    const r = UpdateMemberNoteSchema.safeParse({ category: null })
    expect(r.success).toBe(true)
  })

  it('rejects empty update object', () => {
    const r = UpdateMemberNoteSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it('rejects empty body string', () => {
    const r = UpdateMemberNoteSchema.safeParse({ body: '' })
    expect(r.success).toBe(false)
  })

  it('rejects body over 4000 chars', () => {
    const r = UpdateMemberNoteSchema.safeParse({ body: 'x'.repeat(4001) })
    expect(r.success).toBe(false)
  })

  it('rejects invalid sentiment value', () => {
    const r = UpdateMemberNoteSchema.safeParse({ sentiment: 'mixed' })
    expect(r.success).toBe(false)
  })

  it('rejects body being null (cannot clear body)', () => {
    const r = UpdateMemberNoteSchema.safeParse({ body: null })
    expect(r.success).toBe(false)
  })

  it('accepts full update (body + category + sentiment)', () => {
    const r = UpdateMemberNoteSchema.safeParse({
      body: 'Revised context',
      category: 'meeting',
      sentiment: 'very_positive',
    })
    expect(r.success).toBe(true)
  })
})
