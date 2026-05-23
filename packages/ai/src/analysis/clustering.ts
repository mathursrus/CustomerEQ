// Batch clustering: discover themes from unassigned feedback

import { b } from '../generated/baml_client/index.js'
import { getAiClient } from '../client.js'
import type { FeedbackItem, ClusterDefinition, ClusteringResult } from '../types.js'

export async function discoverClusters(
  unassignedFeedback: FeedbackItem[],
  existingClusters: ClusterDefinition[],
): Promise<ClusteringResult> {
  // Re-read per call so tests can flip AI_PROVIDER=mock in beforeEach.
  const useBaml = (process.env.AI_PROVIDER ?? 'baml') !== 'mock'
  if (!useBaml) {
    return getAiClient().discoverClusters(unassignedFeedback, existingClusters)
  }

  const raw = await b.DiscoverClusters(
    unassignedFeedback,
    existingClusters.map((cluster) => ({
      label: cluster.label,
      description: cluster.description,
      keywords: cluster.keywords,
    })),
  )

  return {
    newClusters: raw.new_clusters.map((cluster) => ({
      label: cluster.label,
      description: cluster.description,
      keywords: cluster.keywords,
    })),
    assignments: raw.assignments.map((assignment) => ({
      feedbackId: assignment.feedback_id,
      clusterLabel: assignment.cluster_label,
    })),
    mergeRecommendations: raw.merge_recommendations.map((recommendation) => ({
      fromLabels: recommendation.from_labels,
      intoLabel: recommendation.into_label,
      reason: recommendation.reason,
    })),
  }
}
