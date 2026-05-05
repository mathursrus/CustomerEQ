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
      // Resolve or auto-enroll member by email. Mirrors resolveOrEnrollMember (#231):
      // externalId = email.toLowerCase().trim() — canonical lookup per R4/R5.
      // Google Reviews: email=null → always anonymous (memberId stays null).
      let memberId: string | null = null
      if (email) {
        const externalId = email.toLowerCase().trim()
        let member = await prisma.member.findUnique({
          where: { brandId_externalId: { brandId, externalId } },
        })

        if (!member) {
          member = await prisma.member.create({
            data: { brandId, externalId, email, enrolledVia: 'BULK_IMPORT' },
          })
          logger.info({ memberId: member.id, email }, 'Auto-enrolled member via bulk import')
        }

        if (member.consentGivenAt) {
          memberId = member.id
        }
        // memberId stays null until explicit consent — response still recorded for analytics
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
