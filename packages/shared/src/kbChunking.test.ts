import { describe, it, expect } from 'vitest'
import { chunkArticleBody } from './kbChunking.js'

describe('chunkArticleBody', () => {
  it('returns one chunk for short content', () => {
    const chunks = chunkArticleBody('Short article body.', { targetTokens: 500, overlapTokens: 100 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('Short article body.')
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].tokenCount).toBeGreaterThan(0)
  })

  it('splits long content into multiple overlapping chunks', () => {
    const body = 'sentence. '.repeat(800)
    const chunks = chunkArticleBody(body, { targetTokens: 500, overlapTokens: 100 })
    expect(chunks.length).toBeGreaterThan(2)
    chunks.forEach((c, i) => {
      expect(c.chunkIndex).toBe(i)
      expect(c.tokenCount).toBeLessThanOrEqual(500 + 50)
    })
  })

  it('chunks overlap so context is not lost at boundaries', () => {
    const body = 'one. two. three. '.repeat(300)
    const chunks = chunkArticleBody(body, { targetTokens: 100, overlapTokens: 30 })
    expect(chunks.length).toBeGreaterThan(1)
    const tail = chunks[0].content.slice(-50)
    expect(chunks[1].content.startsWith(tail.slice(-20)) || chunks[1].content.includes(tail.slice(-20))).toBe(true)
  })

  it('rejects empty body', () => {
    expect(() => chunkArticleBody('', { targetTokens: 500, overlapTokens: 100 })).toThrow(/empty/i)
  })
})
