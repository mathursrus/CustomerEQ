/**
 * Extracts open-ended text responses from survey answers for sentiment analysis.
 * Concatenates all string answers that are more than a few words (length > 10).
 */
export function extractOpenEndedText(answers: Record<string, unknown>): string | null {
  const texts: string[] = []
  for (const value of Object.values(answers)) {
    if (typeof value === 'string' && value.trim().length > 10) {
      texts.push(value.trim())
    }
  }
  return texts.length > 0 ? texts.join(' ') : null
}
