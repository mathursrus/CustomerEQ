import { describe, it, expect } from 'vitest'
import {
  PreviewBatchRequestSchema,
  GenerateBatchResponseSchema,
  BatchDetailResponseSchema,
  RegenerateTokensRequestSchema,
  RegenerateTokensResponseSchema,
  EditExpiryRequestSchema,
  TokenStatusResponseSchema,
  AudienceSpecSchema,
} from './distributionBatch.schema.js'

describe('AudienceSpecSchema (discriminated union)', () => {
  it('accepts existing_members + percent', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'existing_members',
      strategy: 'percent',
      value: 10,
    })
    expect(parsed.mode).toBe('existing_members')
  })

  it('accepts existing_members + count', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'existing_members',
      strategy: 'count',
      value: 100,
    })
    expect(parsed.mode).toBe('existing_members')
  })

  it('accepts custom_list with default autoEnroll = true', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'custom_list',
      identifiers: 'a@b.com\nc@d.com',
    })
    expect(parsed.mode).toBe('custom_list')
    if (parsed.mode === 'custom_list') {
      expect(parsed.autoEnroll).toBe(true)
    }
  })

  it('rejects unknown mode value', () => {
    expect(() => AudienceSpecSchema.parse({ mode: 'random' })).toThrow()
  })

  it('rejects negative percent value', () => {
    expect(() =>
      AudienceSpecSchema.parse({ mode: 'existing_members', strategy: 'percent', value: -1 }),
    ).toThrow()
  })

  it('rejects non-string identifiers paste', () => {
    expect(() => AudienceSpecSchema.parse({ mode: 'custom_list', identifiers: 123 })).toThrow()
  })

  // Issue #531 — audience-builder pre-resolved memberIds
  it('accepts custom_list with memberIds[] alongside identifiers', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'custom_list',
      identifiers: '',
      autoEnroll: false,
      memberIds: ['cmp_member_1', 'cmp_member_2'],
    })
    expect(parsed.mode).toBe('custom_list')
    if (parsed.mode === 'custom_list') {
      expect(parsed.memberIds).toEqual(['cmp_member_1', 'cmp_member_2'])
    }
  })

  it('accepts custom_list with memberIds[] only (no paste body)', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'custom_list',
      identifiers: '',
      memberIds: ['cmp_member_1'],
    })
    if (parsed.mode === 'custom_list') {
      expect(parsed.memberIds).toEqual(['cmp_member_1'])
      expect(parsed.identifiers).toBe('')
    }
  })

  it('defaults memberIds to undefined when omitted (back-compat with non-UI callers)', () => {
    const parsed = AudienceSpecSchema.parse({
      mode: 'custom_list',
      identifiers: 'a@b.com',
    })
    if (parsed.mode === 'custom_list') {
      expect(parsed.memberIds).toBeUndefined()
    }
  })

  it('rejects memberIds longer than 10k entries', () => {
    const tooMany = Array.from({ length: 10_001 }, (_, i) => `id_${i}`)
    expect(() =>
      AudienceSpecSchema.parse({
        mode: 'custom_list',
        identifiers: '',
        memberIds: tooMany,
      }),
    ).toThrow()
  })

  it('rejects non-array memberIds', () => {
    expect(() =>
      AudienceSpecSchema.parse({
        mode: 'custom_list',
        identifiers: '',
        memberIds: 'not-an-array',
      }),
    ).toThrow()
  })
})

describe('PreviewBatchRequestSchema (.strict)', () => {
  const valid = {
    surveyNameInMail: 'Q2 NPS',
    expiresAt: '2026-05-22T23:59:59.999Z',
    audience: { mode: 'existing_members', strategy: 'count', value: 100 },
  }

  it('round-trips a valid request', () => {
    expect(PreviewBatchRequestSchema.parse(valid)).toEqual({
      ...valid,
      audience: { mode: 'existing_members', strategy: 'count', value: 100 },
    })
  })

  it('rejects empty surveyNameInMail', () => {
    expect(() => PreviewBatchRequestSchema.parse({ ...valid, surveyNameInMail: '' })).toThrow()
  })

  it('rejects surveyNameInMail > 80 chars', () => {
    expect(() => PreviewBatchRequestSchema.parse({ ...valid, surveyNameInMail: 'x'.repeat(81) })).toThrow()
  })

  it('rejects non-ISO datetime', () => {
    expect(() => PreviewBatchRequestSchema.parse({ ...valid, expiresAt: 'tomorrow' })).toThrow()
  })

  it('rejects stray properties (.strict)', () => {
    expect(() => PreviewBatchRequestSchema.parse({ ...valid, extra: true })).toThrow()
  })
})

describe('BatchDetailResponseSchema (.strict)', () => {
  const valid = {
    id: 'batch_1',
    surveyId: 'srv_1',
    label: 'Wave',
    surveyNameInMail: 'Q2',
    expiresAt: '2026-05-22T23:59:59.999Z',
    createdAt: '2026-05-15T10:24:00.000Z',
    createdBy: 'user_clerk_1',
    // Issue #420 §3.2 — sendMode + composerSnapshot ride on every batch detail.
    sendMode: 'SELF_SERVE' as const,
    composerSnapshot: null,
    audienceSpec: {
      mode: 'existing_members' as const,
      description: 'Count = 100',
      memberCountAtSendTime: 100,
      memberCountNow: 96,
    },
    counters: {
      sentCount: 100,
      respondedCount: 42,
      awaitingCount: 30,
      expiredCount: 28,
    },
    tokens: {
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    },
  }

  it('accepts a valid detail without plaintext', () => {
    expect(BatchDetailResponseSchema.parse(valid)).toEqual(valid)
  })

  it('accepts MANAGED_EMAIL + composerSnapshot with passthrough fields', () => {
    const managed = {
      ...valid,
      sendMode: 'MANAGED_EMAIL' as const,
      composerSnapshot: {
        senderName: 'Acme CX Team',
        senderAlias: 'feedback',
        senderDomain: 'cx.acme.io',
        subject: 'Q2 NPS',
        body: 'Hi {{first_name}}, {{survey_link}}',
        brandLogoUrl: null,
        brandName: 'Acme',
        // themeSnapshot is a worker concern; .passthrough() keeps it.
        themeSnapshot: { primaryColor: '#6366f1' },
      },
    }
    const parsed = BatchDetailResponseSchema.parse(managed)
    expect(parsed.sendMode).toBe('MANAGED_EMAIL')
    expect(parsed.composerSnapshot?.senderAlias).toBe('feedback')
  })

  it('REJECTS a stray plaintext field on tokens[]', () => {
    // Load-bearing per RFC §Confidence Level item 1: any code path that leaks
    // plaintext into a GET endpoint must fail schema parse before serving.
    const leaked = {
      ...valid,
      tokens: {
        ...valid.tokens,
        data: [
          {
            memberId: 'm_1',
            firstName: 'Jane',
            lastName: 'Doe',
            identifier: 'jane@example.com',
            tokenPrefix: 'Xk8mP3qB',
            status: 'awaiting_response' as const,
            respondedAt: null,
            plaintext: 'LEAKED_PLAINTEXT',
          },
        ],
      },
    }
    expect(() => BatchDetailResponseSchema.parse(leaked)).toThrow()
  })

  it('rejects stray top-level fields (.strict)', () => {
    expect(() => BatchDetailResponseSchema.parse({ ...valid, extra: true })).toThrow()
  })
})

describe('GenerateBatchResponseSchema', () => {
  it('requires plaintext on every token row', () => {
    const valid = {
      batchId: 'b_1',
      label: 'Wave',
      expiresAt: '2026-05-22T23:59:59.999Z',
      tokenCount: 1,
      autoEnrolledMemberIds: [],
      unmatched: [],
      tokens: [
        {
          memberId: 'm_1',
          identifier: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          plaintext: 'Xk8mP3qB...',
        },
      ],
    }
    expect(GenerateBatchResponseSchema.parse(valid).tokens[0].plaintext).toBe('Xk8mP3qB...')
  })

  it('rejects a token row missing plaintext', () => {
    const missing = {
      batchId: 'b_1',
      label: 'Wave',
      expiresAt: '2026-05-22T23:59:59.999Z',
      tokenCount: 1,
      autoEnrolledMemberIds: [],
      unmatched: [],
      tokens: [
        {
          memberId: 'm_1',
          identifier: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          // plaintext intentionally omitted
        },
      ],
    }
    expect(() => GenerateBatchResponseSchema.parse(missing)).toThrow()
  })
})

describe('RegenerateTokensRequestSchema', () => {
  it('requires confirmAcknowledge to be literal true', () => {
    expect(() =>
      RegenerateTokensRequestSchema.parse({ format: 'generic', confirmAcknowledge: false }),
    ).toThrow()
    expect(() =>
      RegenerateTokensRequestSchema.parse({ format: 'generic', confirmAcknowledge: 'yes' as unknown as true }),
    ).toThrow()
    expect(
      RegenerateTokensRequestSchema.parse({ format: 'mailchimp', confirmAcknowledge: true }),
    ).toEqual({ format: 'mailchimp', confirmAcknowledge: true })
  })

  it('rejects an unknown format value', () => {
    expect(() =>
      RegenerateTokensRequestSchema.parse({ format: 'sendgrid', confirmAcknowledge: true }),
    ).toThrow()
  })
})

describe('RegenerateTokensResponseSchema', () => {
  it('shares the GenerateBatchResponse token shape (plaintext required)', () => {
    const valid = {
      batchId: 'b_1',
      regeneratedCount: 1,
      tokens: [
        {
          memberId: 'm_1',
          identifier: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          plaintext: 'NewK8mP3qB...',
        },
      ],
    }
    expect(RegenerateTokensResponseSchema.parse(valid)).toEqual(valid)
  })
})

describe('EditExpiryRequestSchema', () => {
  it('round-trips ISO datetime', () => {
    expect(EditExpiryRequestSchema.parse({ expiresAt: '2026-05-22T23:59:59.999Z' })).toEqual({
      expiresAt: '2026-05-22T23:59:59.999Z',
    })
  })

  it('rejects stray fields (.strict)', () => {
    expect(() =>
      EditExpiryRequestSchema.parse({ expiresAt: '2026-05-22T23:59:59.999Z', mode: 'shorten' }),
    ).toThrow()
  })
})

describe('TokenStatusResponseSchema (.strict — uniform shape)', () => {
  it('accepts each of the 5 enum states', () => {
    for (const state of ['valid', 'expired', 'responded', 'survey-not-open', 'invalid'] as const) {
      expect(TokenStatusResponseSchema.parse({ state })).toEqual({ state })
    }
  })

  it('rejects an unknown state', () => {
    expect(() => TokenStatusResponseSchema.parse({ state: 'revoked' })).toThrow()
  })

  it('REJECTS leaking memberId / batchId / surveyTitle into the response', () => {
    // NFR-S5: uniform body across all states. Adding identifying fields would
    // enable token-existence-leak timing attacks.
    expect(() => TokenStatusResponseSchema.parse({ state: 'valid', memberId: 'm_1' })).toThrow()
    expect(() => TokenStatusResponseSchema.parse({ state: 'valid', batchId: 'b_1' })).toThrow()
    expect(() => TokenStatusResponseSchema.parse({ state: 'valid', surveyTitle: 'Q2 NPS' })).toThrow()
  })
})
