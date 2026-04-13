import { MEMBER_NOTE_SENTIMENTS, type MemberNoteSentiment } from '../zod/member.schema.js'

// Map an AI-generated sentiment float (−1.0..+1.0) into the 5-bucket
// enum that `MemberNote.sentiment` stores. Thresholds match the
// historical manual-tag calibration so the health-score weights don't
// need to be retuned.
//
// Buckets:
//   very_negative : [-1.0, -0.6]
//   negative      : (-0.6, -0.2]
//   neutral       : (-0.2, +0.2)
//   positive      : [+0.2, +0.6)
//   very_positive : [+0.6, +1.0]
//
// Out-of-range values are clamped. NaN / Infinity / null / undefined
// return null so the caller can choose to store the note without a
// sentiment tag (same behavior as when the AI call fails).
export function floatToSentimentBucket(value: number): MemberNoteSentiment | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null

  if (value <= -0.6) return 'very_negative'
  if (value <= -0.2) return 'negative'
  if (value < 0.2) return 'neutral'
  if (value < 0.6) return 'positive'
  return 'very_positive'
}

// Re-export so callers that want to iterate buckets only need one import.
export { MEMBER_NOTE_SENTIMENTS, type MemberNoteSentiment }
