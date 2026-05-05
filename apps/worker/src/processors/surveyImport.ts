import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { QUEUES } from '@customerEQ/shared'
import type { SurveyImportRowPayload, SentimentAnalysisPayload } from '@customerEQ/shared'
import type { Prisma } from '@prisma/client'
import { createQueue } from '../queues/definitions.js'

const logger = pino({ name: 'survey-import' })

export function createSurveyImportProcessor(connection: ConnectionOptions) {
  return async function processSurveyImportRow(job: Job<SurveyImportRowPayload>): Promise<void> {
    const { batchId, surveyId, brandId, rowIndex, email, score, verbatim, completedAt, channel, externalId, rawAnswers } = job.data

    logger.info({ batchId, rowIndex, email: email ?? 'anonymous' }, 'Processing import row')

    try {
      // Resolve member — for Google Reviews email=null means always anonymous
      let memberId: string | null = null
      if (email) {
        let member = await prisma.member.findFirst({ where: { email, brandId } })

        if (!member) {
          // Stub member — consentGivenAt null until they explicitly consent
          // TODO: replace with shared auto-enrollment function once that PR merges
          member = await prisma.member.create({
            data: { brandId, email },
          })
          logger.info({ memberId: member.id, email }, 'Created stub member for import')
        }

        if (member.consentGivenAt) {
          memberId = member.id
        }
        // memberId stays null if consent not yet given; response is still recorded
      }

      // Dedup: skip if externalId already imported for this survey
      if (externalId) {
        const existing = await prisma.surveyResponse.findFirst({
          where: { surveyId, externalRespondentId: externalId },
          select: { id: true },
        })
        if (existing) {
          await prisma.surveyImportBatch.update({
            where: { id: batchId },
            data: { processedRows: { increment: 1 } },
          })
          logger.info({ batchId, rowIndex, externalId }, 'Skipped duplicate row')
          return
        }
      }

      const response = await prisma.surveyResponse.create({
        data: {
          surveyId,
          brandId,
          memberId,
          answers: (rawAnswers ?? {}) as Prisma.InputJsonValue,
          score: score ?? null,
          channel,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
          importBatchId: batchId,
          importedAt: new Date(),
          externalRespondentId: externalId ?? null,
        },
      })

      if (verbatim && memberId) {
        const sentimentQueue = createQueue(QUEUES.SENTIMENT_ANALYSIS, connection)
        const payload: SentimentAnalysisPayload = {
          surveyResponseId: response.id,
          brandId,
          memberId,
          surveyId,
          text: verbatim,
          eventType: 'cx.survey_imported',
          score: score ?? undefined,
        }
        await sentimentQueue.add('analyze', payload)
      }

      await prisma.surveyImportBatch.update({
        where: { id: batchId },
        data: { processedRows: { increment: 1 } },
      })

      logger.info({ batchId, rowIndex, responseId: response.id }, 'Import row processed')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ batchId, rowIndex, email, err: message }, 'Import row failed')

      const batch = await prisma.surveyImportBatch.findUnique({
        where: { id: batchId },
        select: { errors: true },
      })
      const existingErrors = (batch?.errors as Array<{ row: number; email: string | null; error: string }>) ?? []

      await prisma.surveyImportBatch.update({
        where: { id: batchId },
        data: {
          failedRows: { increment: 1 },
          errors: [...existingErrors, { row: rowIndex, email, error: message }] as Prisma.InputJsonValue,
        },
      })

      throw err
    }

    // Mark batch complete if all rows have been processed or failed
    const updated = await prisma.surveyImportBatch.findUnique({
      where: { id: batchId },
      select: { totalRows: true, processedRows: true, failedRows: true },
    })
    if (updated && updated.processedRows + updated.failedRows >= updated.totalRows) {
      await prisma.surveyImportBatch.update({
        where: { id: batchId },
        data: { status: 'complete' },
      })
      logger.info({ batchId }, 'Import batch complete')
    }
  }
}
