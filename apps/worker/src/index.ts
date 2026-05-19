import { Worker, Queue } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { QUEUES } from '@customerEQ/shared'
import { createConnection } from './queues/definitions.js'
import { createLoyaltyEventProcessor } from './processors/loyaltyEvents.js'
import { createCampaignTriggerProcessor } from './processors/campaignTriggers.js'
import { processNotification } from './processors/notifications.js'
import { createSentimentProcessor } from './processors/sentimentAnalysis.js'
import { processFeedbackClustering } from './processors/feedbackClustering.js'
import { processEmbeddingGeneration } from './processors/embeddingGeneration.js'
import { processHealthScore } from './processors/healthScore.js'
import { processSurveyDistribute } from './processors/surveyDistribute.js'
import { createExternalSignalSyncProcessor } from './processors/externalSignalSync.js'
import { processExternalSignalIngestion } from './processors/externalSignalIngestion.js'
import { processWebhookDelivery } from './processors/webhookDelivery.js'
import { createSlaBreachCheckProcessor } from './processors/slaBreachCheck.js'
import { createSurveyImportProcessor } from './processors/surveyImport.js'
import { createSupportOrchestrationProcessor } from './processors/supportOrchestration.js'
import { createKbIngestionProcessor } from './processors/kbIngestion.js'
import { createSupportTimeoutClassifierProcessor } from './processors/supportTimeoutClassifier.js'
import { createSlackOutboundProcessor } from './processors/slackOutbound.js'

const logger = pino({ name: 'worker' })

// QUEUE_MODE=inline means the API runs every processor in-process via
// apps/api/src/queues/bullmq.ts + inlineRuntime.ts. The worker process is
// not needed and would crash trying to connect to a Redis instance that
// the deployment intentionally doesn't provide. Exit cleanly so container
// orchestrators don't restart-loop us.
if (process.env.QUEUE_MODE === 'inline') {
  logger.info({ queueMode: 'inline' }, 'Worker not needed in inline mode — exiting cleanly')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const connection = createConnection()

// drainDelay: seconds to wait between polls when queue is empty (default 5)
// At low traffic, 60s keeps Redis usage under free tier (~8K cmds/hr vs ~120K)
const IDLE_POLL_SECONDS = 60

const loyaltyEventsWorker = new Worker(
  QUEUES.LOYALTY_EVENTS,
  createLoyaltyEventProcessor(connection),
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

const surveyDistributeWorker = new Worker(
  QUEUES.SURVEY_DISTRIBUTE,
  processSurveyDistribute,
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
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

const webhookDeliveryWorker = new Worker(
  QUEUES.WEBHOOK_DELIVERY,
  processWebhookDelivery,
  { connection, concurrency: 10, drainDelay: IDLE_POLL_SECONDS },
)

const surveyImportWorker = new Worker(
  QUEUES.SURVEY_IMPORT,
  createSurveyImportProcessor(connection),
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const supportOrchestrationWorker = new Worker(
  QUEUES.SUPPORT_ORCHESTRATION,
  createSupportOrchestrationProcessor(connection),
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

const kbIngestionWorker = new Worker(
  QUEUES.KB_INGESTION,
  createKbIngestionProcessor(connection),
  { connection, concurrency: 3, drainDelay: IDLE_POLL_SECONDS },
)

// SLA breach check — repeating job every 5 minutes
const SLA_BREACH_QUEUE = 'sla-breach-check'
const slaBreachQueue = new Queue(SLA_BREACH_QUEUE, { connection })
const slaBreachWorker = new Worker(
  SLA_BREACH_QUEUE,
  createSlaBreachCheckProcessor(connection),
  { connection, concurrency: 1, drainDelay: IDLE_POLL_SECONDS },
)

// Schedule the repeating job (idempotent — BullMQ deduplicates by jobId)
void slaBreachQueue.add(
  'check',
  {},
  { repeat: { every: 5 * 60 * 1000 }, jobId: 'sla-breach-check-repeating' },
)

const slackOutboundWorker = new Worker(
  QUEUES.SLACK_OUTBOUND,
  createSlackOutboundProcessor(connection),
  { connection, concurrency: 5, drainDelay: IDLE_POLL_SECONDS },
)

// Support timeout classifier — repeating job every 1 hour
const supportTimeoutQueue = new Queue(QUEUES.SUPPORT_TIMEOUT_CHECK, { connection })
const supportTimeoutClassifierWorker = new Worker(
  QUEUES.SUPPORT_TIMEOUT_CHECK,
  createSupportTimeoutClassifierProcessor(connection),
  { connection, concurrency: 1, drainDelay: IDLE_POLL_SECONDS },
)

// Schedule the hourly scan (idempotent — BullMQ deduplicates by jobId)
void supportTimeoutQueue.add(
  'scan',
  {},
  { repeat: { every: 60 * 60 * 1000 }, jobId: 'support-timeout-check-repeating' },
)

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------

for (const worker of [loyaltyEventsWorker, campaignTriggersWorker, notificationsWorker, sentimentWorker, feedbackClusteringWorker, embeddingGenerationWorker, healthScoreWorker, surveyDistributeWorker, externalSignalSyncWorker, externalSignalIngestionWorker, webhookDeliveryWorker, surveyImportWorker, supportOrchestrationWorker, kbIngestionWorker, slaBreachWorker, supportTimeoutClassifierWorker, slackOutboundWorker]) {
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
      QUEUES.SURVEY_DISTRIBUTE,
      QUEUES.EXTERNAL_SIGNAL_SYNC,
      QUEUES.EXTERNAL_SIGNAL_INGESTION,
      QUEUES.WEBHOOK_DELIVERY,
      QUEUES.SURVEY_IMPORT,
      QUEUES.SUPPORT_ORCHESTRATION,
      QUEUES.KB_INGESTION,
      SLA_BREACH_QUEUE,
      QUEUES.SUPPORT_TIMEOUT_CHECK,
      QUEUES.SLACK_OUTBOUND,
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
    surveyDistributeWorker.close(),
    externalSignalSyncWorker.close(),
    externalSignalIngestionWorker.close(),
    webhookDeliveryWorker.close(),
    surveyImportWorker.close(),
    supportOrchestrationWorker.close(),
    kbIngestionWorker.close(),
    slaBreachWorker.close(),
    slaBreachQueue.close(),
    supportTimeoutClassifierWorker.close(),
    supportTimeoutQueue.close(),
    slackOutboundWorker.close(),
  ])
  await prisma.$disconnect()
  logger.info('Workers closed cleanly')
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
