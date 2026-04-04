/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the OpenAI module before importing the function under test
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [{ embedding: Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01)) }],
  })

  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  }
})

import { generateEmbedding } from './embeddings.js'
import OpenAI from 'openai'

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a 1536-dimensional embedding vector', async () => {
    const result = await generateEmbedding('How do I get a refund?')

    expect(result).toHaveLength(1536)
    expect(typeof result[0]).toBe('number')
  })

  it('calls OpenAI with correct model and dimensions', async () => {
    await generateEmbedding('test text')

    const instance = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'test text',
      dimensions: 1536,
    })
  })

  it('propagates OpenAI API errors', async () => {
    const instance = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    if (instance) {
      instance.embeddings.create.mockRejectedValueOnce(new Error('API rate limit exceeded'))
    } else {
      // Force a new instance creation with error
      const OpenAIMock = OpenAI as unknown as ReturnType<typeof vi.fn>
      OpenAIMock.mockImplementationOnce(() => ({
        embeddings: {
          create: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
        },
      }))
    }

    await expect(generateEmbedding('test')).rejects.toThrow('API rate limit exceeded')
  })
})
