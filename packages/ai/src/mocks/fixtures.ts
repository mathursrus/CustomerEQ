// Deterministic fixture data for mock AI client
// Used by UI development and unit tests without LLM calls

import type {
  ClusterDefinition,
  FeedbackAnalysisResult,
  ClusteringResult,
  AnomalyReport,
  AnomalyItem,
} from '../types.js'

export const MOCK_CLUSTERS: ClusterDefinition[] = [
  {
    label: 'Shipping Delays',
    description: 'Complaints about long delivery times and tracking issues',
    keywords: ['shipping', 'delivery', 'slow', 'tracking', 'weeks'],
  },
  {
    label: 'Product Quality',
    description: 'Feedback about product defects, durability, and quality',
    keywords: ['quality', 'broken', 'defective', 'damaged', 'excellent'],
  },
  {
    label: 'Customer Support',
    description: 'Experiences with the support team, response times, and resolution',
    keywords: ['support', 'agent', 'help', 'hold', 'resolved'],
  },
  {
    label: 'Pricing & Value',
    description: 'Concerns about pricing tiers, value for money, and billing',
    keywords: ['price', 'expensive', 'value', 'billing', 'cost'],
  },
  {
    label: 'Website & App UX',
    description: 'Issues with checkout, mobile app, navigation, and usability',
    keywords: ['checkout', 'mobile', 'app', 'crash', 'confusing'],
  },
  {
    label: 'Loyalty Rewards',
    description: 'Feedback about the rewards program, points, and redemption',
    keywords: ['rewards', 'points', 'redeem', 'loyalty', 'earned'],
  },
]

// Keyword-based cluster assignment for mock
const CLUSTER_KEYWORD_MAP: Record<string, string[]> = {
  'Shipping Delays': ['shipping', 'delivery', 'package', 'shipped', 'tracking', 'arrived', 'weeks'],
  'Product Quality': ['product', 'quality', 'broken', 'defective', 'excellent', 'item', 'damaged'],
  'Customer Support': ['support', 'help', 'agent', 'hold', 'call', 'ticket', 'service', 'resolved'],
  'Pricing & Value': ['price', 'cost', 'expensive', 'cheap', 'value', 'billing', 'worth'],
  'Website & App UX': ['website', 'app', 'checkout', 'mobile', 'crash', 'interface', 'page', 'form'],
  'Loyalty Rewards': ['rewards', 'points', 'loyalty', 'redeem', 'earned', 'free'],
}

function assignClusterFromText(text: string): string | null {
  const lower = text.toLowerCase()
  let bestMatch: string | null = null
  let bestCount = 0

  for (const [label, keywords] of Object.entries(CLUSTER_KEYWORD_MAP)) {
    const count = keywords.filter((kw) => lower.includes(kw)).length
    if (count > bestCount) {
      bestCount = count
      bestMatch = label
    }
  }

  return bestCount > 0 ? bestMatch : null
}

// Sentiment heuristic for mock — uses both text keywords AND numeric score
const POSITIVE = ['great', 'excellent', 'amazing', 'love', 'fantastic', 'wonderful', 'happy', 'fast', 'easy', 'helpful', 'recommend', 'best', 'perfect', 'awesome', 'satisfied', 'resolved', 'outstanding', 'quick', 'impressed', 'premium', 'clean', 'modern', 'intuitive', 'straightforward', 'smooth', 'knowledgeable', 'incredible', 'exceeded', 'ahead']
const NEGATIVE = ['terrible', 'awful', 'horrible', 'hate', 'worst', 'slow', 'broken', 'frustrating', 'disappointed', 'poor', 'bad', 'difficult', 'confusing', 'annoying', 'never', 'crashed', 'rude', 'useless', 'unacceptable', 'damaged', 'defective', 'cheap', 'overpriced', 'disconnected', 'late', 'wrong', 'waited', 'crushed', 'soaked', 'transferred']

export function mockAnalyzeFeedback(
  feedbackText: string,
  _surveyType: string,
  numericScore: number | undefined,
  existingClusters: { label: string; description: string }[],
): FeedbackAnalysisResult {
  const lower = feedbackText.toLowerCase()

  // Text-based scoring
  let textScore = 0
  for (const word of POSITIVE) {
    if (lower.includes(word)) textScore += 0.15
  }
  for (const word of NEGATIVE) {
    if (lower.includes(word)) textScore -= 0.15
  }
  textScore = Math.max(-1, Math.min(1, textScore))

  // Numeric score signal (NPS: 0-10, CSAT: 1-5, CES: 1-7)
  let scoreSignal = 0
  if (numericScore !== undefined) {
    // Normalize to -1..1 range based on likely scale
    if (numericScore <= 10) {
      scoreSignal = (numericScore - 5) / 5 // NPS: 0→-1, 5→0, 10→+1
    }
  }

  // Blend text + score.
  //   - With a numeric score (survey responses): text is 40%, score is 60%.
  //   - Without a numeric score (CRM notes, #141): text gets full weight.
  //     Otherwise every note comes back "neutral" because text is compressed.
  //   - If text produces no signal and we have no score, return 0.
  const blended = numericScore === undefined
    ? textScore
    : textScore !== 0
      ? textScore * 0.4 + scoreSignal * 0.6
      : scoreSignal * 0.8
  const sentiment = Math.max(-1, Math.min(1, Math.round(blended * 100) / 100))

  // Extract topics (free-form, not hardcoded categories)
  const topicCandidates = [
    { pattern: /shipping|delivery|package/i, topic: 'shipping delays' },
    { pattern: /support|help|agent|hold/i, topic: 'customer support' },
    { pattern: /price|cost|expensive|billing/i, topic: 'pricing' },
    { pattern: /product|quality|broken|defective/i, topic: 'product quality' },
    { pattern: /website|app|checkout|mobile|crash/i, topic: 'website experience' },
    { pattern: /reward|points|loyalty|redeem/i, topic: 'rewards program' },
  ]
  const topics = topicCandidates
    .filter((c) => c.pattern.test(feedbackText))
    .map((c) => c.topic)

  // Summary
  const sentimentWord = sentiment > 0.3 ? 'Positive' : sentiment < -0.3 ? 'Negative' : 'Mixed'
  const summary = `${sentimentWord} feedback about ${topics.length > 0 ? topics.join(' and ') : 'general experience'}.`

  // Cluster assignment
  const clusterLabels = existingClusters.map((c) => c.label)
  const assigned = assignClusterFromText(feedbackText)
  const assignedClusterLabel = assigned && clusterLabels.includes(assigned) ? assigned : null
  const suggestedNewClusterLabel = !assignedClusterLabel ? (assigned ?? 'General Feedback') : null

  return {
    sentiment,
    confidence: 0.85,
    topics,
    summary,
    assignedClusterLabel,
    suggestedNewClusterLabel,
  }
}

export function mockDiscoverClusters(
  unassignedFeedback: { id: string; text: string; sentiment: number }[],
  existingClusters: ClusterDefinition[],
): ClusteringResult {
  const existingLabels = new Set(existingClusters.map((c) => c.label))
  const newClusterMap = new Map<string, ClusterDefinition>()
  const assignments: { feedbackId: string; clusterLabel: string }[] = []

  for (const item of unassignedFeedback) {
    const label = assignClusterFromText(item.text) ?? 'General Feedback'

    if (!existingLabels.has(label) && !newClusterMap.has(label)) {
      const def = MOCK_CLUSTERS.find((c) => c.label === label)
      newClusterMap.set(label, def ?? {
        label,
        description: `Auto-discovered cluster: ${label}`,
        keywords: [label.toLowerCase()],
      })
    }

    assignments.push({ feedbackId: item.id, clusterLabel: label })
  }

  return {
    newClusters: Array.from(newClusterMap.values()),
    assignments,
    mergeRecommendations: [],
  }
}

export function mockDetectAnomalies(
  _clusterTrends: unknown[],
  _totalLast30d: number,
  _totalPrev30d: number,
): AnomalyReport {
  return {
    anomalies: [],
    overallSummary: 'No significant anomalies detected. Feedback patterns are within normal ranges.',
  }
}

// Configurable mock anomalies for testing
export function createMockAnomalies(anomalies: AnomalyItem[]): AnomalyReport {
  return {
    anomalies,
    overallSummary: `Detected ${anomalies.length} anomaly(ies) in recent feedback.`,
  }
}
