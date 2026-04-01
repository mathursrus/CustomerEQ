import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { FeedbackClusteringPayload } from '@customerEQ/shared'
import { discoverClusters, detectAnomalies } from '@customerEQ/ai'
import type { ClusterDefinition, ClusterTrend } from '@customerEQ/ai'

const logger = pino({ name: 'feedback-clustering' })

// ---------------------------------------------------------------------------
// Result interface
// ---------------------------------------------------------------------------

export interface ClusteringProcessorResult {
  newClustersCreated: number
  responsesAssigned: number
  snapshotsCreated: number
  anomaliesDetected: number
}

// ---------------------------------------------------------------------------
// BullMQ processor
// ---------------------------------------------------------------------------

export async function processFeedbackClustering(
  job: Job<FeedbackClusteringPayload>,
): Promise<ClusteringProcessorResult> {
  const { brandId } = job.data

  // 1. Fetch existing active clusters for the brand
  const existingDbClusters = await prisma.feedbackCluster.findMany({
    where: { brandId, isActive: true },
    select: { id: true, label: true, description: true, keywords: true },
  })

  const existingClusters: ClusterDefinition[] = existingDbClusters.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description ?? '',
    keywords: c.keywords,
  }))

  // 2. Fetch unassigned responses (last 30 days, clusterId is null)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const unassignedResponses = await prisma.surveyResponse.findMany({
    where: {
      brandId,
      clusterId: null,
      completedAt: { gte: thirtyDaysAgo },
    },
    select: {
      id: true,
      answers: true,
      sentiment: true,
    },
  })

  let newClustersCreated = 0
  let responsesAssigned = 0

  // 3. If there are unassigned responses, call discoverClusters
  if (unassignedResponses.length > 0) {
    const feedbackItems = unassignedResponses.map((r) => ({
      id: r.id,
      text: extractText(r.answers),
      sentiment: r.sentiment ?? 0,
    }))

    const clusteringResult = await discoverClusters(feedbackItems, existingClusters)

    // 4. Create any new FeedbackCluster rows
    const clusterLabelToId = new Map<string, string>()
    for (const c of existingDbClusters) {
      clusterLabelToId.set(c.label, c.id)
    }

    for (const newCluster of clusteringResult.newClusters) {
      const created = await prisma.feedbackCluster.create({
        data: {
          brandId,
          label: newCluster.label,
          description: newCluster.description,
          keywords: newCluster.keywords,
          responseCount: 0,
        },
      })
      clusterLabelToId.set(newCluster.label, created.id)
      newClustersCreated++
    }

    // 5. Assign responses to clusters (update clusterId)
    for (const assignment of clusteringResult.assignments) {
      const cId = clusterLabelToId.get(assignment.clusterLabel)
      if (!cId) {
        logger.warn(
          { clusterLabel: assignment.clusterLabel, feedbackId: assignment.feedbackId },
          'Cluster label not found for assignment — skipping',
        )
        continue
      }
      await prisma.surveyResponse.update({
        where: { id: assignment.feedbackId },
        data: { clusterId: cId },
      })
      responsesAssigned++
    }

    logger.info(
      { brandId, newClustersCreated, responsesAssigned, mergeRecommendations: clusteringResult.mergeRecommendations.length },
      'Cluster discovery complete',
    )
  }

  // 6. Update each cluster's responseCount and avgSentiment
  const allClusters = await prisma.feedbackCluster.findMany({
    where: { brandId, isActive: true },
    select: { id: true, label: true, description: true },
  })

  for (const cluster of allClusters) {
    const agg = await prisma.surveyResponse.aggregate({
      where: { clusterId: cluster.id },
      _count: { id: true },
      _avg: { sentiment: true },
    })
    await prisma.feedbackCluster.update({
      where: { id: cluster.id },
      data: {
        responseCount: agg._count.id,
        avgSentiment: agg._avg.sentiment,
      },
    })
  }

  // 7. Compute ClusterSnapshot rows for today (daily bucket)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let snapshotsCreated = 0
  for (const cluster of allClusters) {
    const todayAgg = await prisma.surveyResponse.aggregate({
      where: {
        clusterId: cluster.id,
        completedAt: { gte: today },
      },
      _count: { id: true },
      _avg: { sentiment: true },
    })

    await prisma.clusterSnapshot.upsert({
      where: { clusterId_bucketDate: { clusterId: cluster.id, bucketDate: today } },
      create: {
        clusterId: cluster.id,
        brandId,
        bucketDate: today,
        volume: todayAgg._count.id,
        avgSentiment: todayAgg._avg.sentiment,
      },
      update: {
        volume: todayAgg._count.id,
        avgSentiment: todayAgg._avg.sentiment,
      },
    })
    snapshotsCreated++
  }

  // 8. Build trend data from ClusterSnapshot for anomaly detection
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const clusterTrends: ClusterTrend[] = []
  let totalResponsesLast30d = 0
  let totalResponsesPrevious30d = 0

  for (const cluster of allClusters) {
    const snapshots = await prisma.clusterSnapshot.findMany({
      where: {
        clusterId: cluster.id,
        bucketDate: { gte: sixtyDaysAgo },
      },
      orderBy: { bucketDate: 'asc' },
      select: { bucketDate: true, volume: true, avgSentiment: true },
    })

    // Split into last 30 days and previous 30 days
    const dailyVolumes: number[] = []
    const dailyAvgSentiment: number[] = []
    let last30 = 0
    let prev30 = 0

    for (const snap of snapshots) {
      const snapDate = new Date(snap.bucketDate)
      if (snapDate >= thirtyDaysAgo) {
        dailyVolumes.push(snap.volume)
        dailyAvgSentiment.push(snap.avgSentiment ?? 0)
        last30 += snap.volume
      } else {
        prev30 += snap.volume
      }
    }

    totalResponsesLast30d += last30
    totalResponsesPrevious30d += prev30

    clusterTrends.push({
      clusterLabel: cluster.label,
      clusterDescription: cluster.description ?? '',
      dailyVolumes,
      dailyAvgSentiment,
      totalResponses: last30,
    })
  }

  // 9. Call detectAnomalies with trend data
  let anomaliesDetected = 0
  if (clusterTrends.length > 0) {
    const anomalyReport = await detectAnomalies(
      clusterTrends,
      totalResponsesLast30d,
      totalResponsesPrevious30d,
    )

    // 10. Create FeedbackAnomaly rows for detected anomalies
    for (const anomaly of anomalyReport.anomalies) {
      // Resolve clusterId from label
      let anomalyClusterId: string | null = null
      if (anomaly.clusterLabel) {
        const matchingCluster = allClusters.find((c) => c.label === anomaly.clusterLabel)
        if (matchingCluster) {
          anomalyClusterId = matchingCluster.id
        }
      }

      await prisma.feedbackAnomaly.create({
        data: {
          brandId,
          clusterId: anomalyClusterId,
          type: anomaly.type,
          severity: anomaly.severity,
          summary: anomaly.summary,
          metadata: { overallSummary: anomalyReport.overallSummary },
        },
      })
      anomaliesDetected++
    }

    if (anomaliesDetected > 0) {
      logger.info(
        { brandId, anomaliesDetected, summary: anomalyReport.overallSummary },
        'Anomalies detected',
      )
    }
  }

  // 11. Return summary
  const summary: ClusteringProcessorResult = {
    newClustersCreated,
    responsesAssigned,
    snapshotsCreated,
    anomaliesDetected,
  }

  logger.info({ brandId, ...summary }, 'Feedback clustering job complete')
  return summary
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract text content from a SurveyResponse's answers JSON.
 * Answers are stored as { questionId: answer } — we concatenate all string answers.
 */
function extractText(answers: unknown): string {
  if (!answers || typeof answers !== 'object') return ''
  const values = Object.values(answers as Record<string, unknown>)
  return values
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .trim()
}
