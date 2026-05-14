import { describe, it, expect, vi, beforeEach } from 'vitest'

const bamlMock = vi.hoisted(() => ({
  b: { ClassifyResolution: vi.fn() },
}))
vi.mock('../generated/baml_client/index.js', () => bamlMock)

import { classifyResolution } from './resolution.js'

beforeEach(() => bamlMock.b.ClassifyResolution.mockReset())

describe('classifyResolution', () => {
  it('returns resolved + confidence + reason', async () => {
    bamlMock.b.ClassifyResolution.mockResolvedValue({
      resolved: true,
      confidence: 0.85,
      reason: 'customer said "thanks, that worked"',
    })

    const result = await classifyResolution({
      messages: [
        { role: 'CUSTOMER', content: 'how do I reset my password?' },
        { role: 'AI', content: 'click "forgot password" on the login page.' },
        { role: 'CUSTOMER', content: 'thanks, that worked' },
      ],
      hoursSinceLast: 26,
    })

    expect(result).toEqual({
      resolved: true,
      confidence: 0.85,
      reason: 'customer said "thanks, that worked"',
    })
  })
})
