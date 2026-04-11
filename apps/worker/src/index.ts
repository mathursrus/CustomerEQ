import { Worker } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { QUEUES } from '@customerEQ/shared'
import { createConnection } from './queues/definitions.js'
import { processLoyaltyEvent } from './processors/loyaltyEvents.js'
import { createCampaignTriggerProcessor } from './processors/campaignTriggers.js'
import { processNotification } from './processors/notifications.js'
import { createSentimentProcessor } from './processors/sentimentAnalysis.js'
import { processFeedbackClustering } from './processors/feedbackClustering.js'
import { processEmbeddingGeneration } from './processors/embeddingGeneration.js'
import { processHealthScore } from './processors/healthScore.js'
import { createExternalSignalSyncProcessor } from './processors/externalSignalSync.js'
import { processExternalSignalIngestion } from './processors/externalSignalIngestion.js'

const logger = pino({ name: 'worker' })

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const connection = createConnection()

// drainDelay: seconds to wait between polls when queue is empty (default 5)
// At low traffic, 60s keeps Redis usage under free tier (~8K cmds/hr vs ~120K)
const IDLE_POLL_SECONDS = 60

const loyaltyEventsWorker = new Worker(
  QUEUES.LOYALTY_EVENTS,
  processLoyaltyEvent,
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const campaignTriggersWorker = new Worker(
  QUEUES.CAMPAIGN_TRIGGERS,
  createCampaignTriggerProcessor(connection),
  { connection, concurrency: 10, drainDelay: IDLE_POLL_SECONDS },
)

const notificationsWorker = new Worker(
  QUEUES.NOTIFICATIONS,
  processNotification,
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const sentimentWorker = new Worker(
  QUEUES.SENTIMENT_ANALYSIS,
  createSentimentProcessor(connection),
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const feedbackClusteringWorker = new Worker(
  QUEUES.FEEDBACK_CLUSTERING,
  processFeedbackClustering,
  { connection, concurrency: 1, drainDelay: IDLE_POLL_SECONDS },
)

const embeddingGenerationWorker = new Worker(
  QUEUES.EMBEDDING_GENERATION,
  processEmbeddingGeneration,
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const healthScoreWorker = new Worker(
  QUEUES.HEALTH_SCORE_COMPUTATION,
  processHealthScore,
  { connection, concurrency: 3, drainDelay: IDLE_POLL_SECONDS },
)

const externalSignalSyncWorker = new Worker(
  QUEUES.EXTERNAL_SIGNAL_SYNC,
  createExternalSignalSyncProcessor(connection),
  { connection, concurrency: 2, drainDelay: IDLE_POLL_SECONDS },
)

const externalSignalIngestionWorker = new Worker(
  QUEUES.EXTERNAL_SIGNAL_INGESTION,
  processExternalSignalIngestion,
  { connection, concurrency: 3, drainDelay: IDLE_POLL_SECONDS },
)

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------

for (const worker of [loyaltyEventsWorker, campaignTriggersWorker, notificationsWorker, sentimentWorker, feedbackClusteringWorker, embeddingGenerationWorker, healthScoreWorker, externalSignalSyncWorker, externalSignalIngestionWorker]) {
  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, queue: worker.name, err },
      'Job failed',
    )
  })

  worker.on('error', (err) => {
    logger.error({ queue: worker.name, err }, 'Worker error')
  })
}

logger.info(
  {
    queues: [
      QUEUES.LOYALTY_EVENTS,
      QUEUES.CAMPAIGN_TRIGGERS,
      QUEUES.NOTIFICATIONS,
      QUEUES.SENTIMENT_ANALYSIS,
      QUEUES.FEEDBACK_CLUSTERING,
      QUEUES.EMBEDDING_GENERATION,
      QUEUES.HEALTH_SCORE_COMPUTATION,
      QUEUES.EXTERNAL_SIGNAL_SYNC,
      QUEUES.EXTERNAL_SIGNAL_INGESTION,
    ],
  },
  'Workers started',
)

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received — draining workers')
  await Promise.all([
    loyaltyEventsWorker.close(),
    campaignTriggersWorker.close(),
    notificationsWorker.close(),
    sentimentWorker.close(),
    feedbackClusteringWorker.close(),
    embeddingGenerationWorker.close(),
    healthScoreWorker.close(),
    externalSignalSyncWorker.close(),
    externalSignalIngestionWorker.close(),
  ])
  await prisma.$disconnect()
  logger.info('Workers closed cleanly')
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
