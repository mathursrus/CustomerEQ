// Batch clustering: discover themes from unassigned feedback

import { getAiClient } from '../client.js'
import type { FeedbackItem, ClusterDefinition, ClusteringResult } from '../types.js'

export async function discoverClusters(
  unassignedFeedback: FeedbackItem[],
  existingClusters: ClusterDefinition[],
): Promise<ClusteringResult> {
  const client = getAiClient()
  return client.discoverClusters(unassignedFeedback, existingClusters)
}
