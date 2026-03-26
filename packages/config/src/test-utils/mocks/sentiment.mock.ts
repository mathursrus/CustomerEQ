import { vi } from 'vitest'

export interface MockSentimentResult {
  sentiment: number
  topics: string[]
}

/**
 * Mock sentiment analyzer for tests. Returns configurable results.
 * Default: neutral sentiment (0.0) with no topics.
 */
export const mockSentimentAnalyze = vi.fn()
  .mockResolvedValue({ sentiment: 0.0, topics: [] } satisfies MockSentimentResult)

/**
 * Configure the mock to return negative sentiment.
 */
export function mockNegativeSentiment(sentiment = -0.7, topics = ['support']): void {
  mockSentimentAnalyze.mockResolvedValueOnce({ sentiment, topics })
}

/**
 * Configure the mock to return positive sentiment.
 */
export function mockPositiveSentiment(sentiment = 0.8, topics = ['experience']): void {
  mockSentimentAnalyze.mockResolvedValueOnce({ sentiment, topics })
}

/**
 * Reset the sentiment mock to defaults.
 */
export function clearSentimentMock(): void {
  mockSentimentAnalyze.mockReset()
  mockSentimentAnalyze.mockResolvedValue({ sentiment: 0.0, topics: [] })
}
