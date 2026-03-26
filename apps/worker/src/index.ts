import { Worker } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { QUEUES } from '@customerEQ/shared'
import { createConnection } from './queues/definitions.js'
import { processLoyaltyEvent } from './processors/loyaltyEvents.js'
import { createCampaignTriggerProcessor } from './processors/campaignTriggers.js'
import { processNotification } from './processors/notifications.js'
import { createSentimentProcessor } from './processors/sentimentAnalysis.js'

const logger = pino({ name: 'worker' })

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const connection = createConnection()

const loyaltyEventsWorker = new Worker(
  QUEUES.LOYALTY_EVENTS,
  processLoyaltyEvent,
  { connection, concurrency: 5 },
)

const campaignTriggersWorker = new Worker(
  QUEUES.CAMPAIGN_TRIGGERS,
  createCampaignTriggerProcessor(connection),
  { connection, concurrency: 10 },
)

const notificationsWorker = new Worker(
  QUEUES.NOTIFICATIONS,
  processNotification,
  { connection, concurrency: 5 },
)

const sentimentWorker = new Worker(
  QUEUES.SENTIMENT_ANALYSIS,
  createSentimentProcessor(connection),
  { connection, concurrency: 5 },
)

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------

for (const worker of [loyaltyEventsWorker, campaignTriggersWorker, notificationsWorker, sentimentWorker]) {
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
    queues: [QUEUES.LOYALTY_EVENTS, QUEUES.CAMPAIGN_TRIGGERS, QUEUES.NOTIFICATIONS, QUEUES.SENTIMENT_ANALYSIS],
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
  ])
  await prisma.$disconnect()
  logger.info('Workers closed cleanly')
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
