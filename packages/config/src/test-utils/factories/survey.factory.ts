import type { Prisma } from '@prisma/client'
import { getTestPrisma } from '../db/setup.js'

let counter = 0

export async function createSurvey(opts: {
  brandId: string
  programId: string
  name?: string
  type?: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  questions?: unknown[]
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED'
  incentivePoints?: number | null
  settings?: Record<string, unknown>
  // Issue #79/#117 trigger fields
  triggerCategory?: string | null
  triggerKey?: string | null
  surveyTypeOverride?: string | null
}) {
  const prisma = getTestPrisma()
  counter++

  const defaultQuestions = opts.type === 'NPS' || !opts.type
    ? [
        { id: 'q1', text: 'How likely are you to recommend us? (0-10)', type: 'rating', required: true },
        { id: 'q2', text: 'What could we do better?', type: 'text', required: false },
      ]
    : opts.type === 'CSAT'
      ? [
          { id: 'q1', text: 'How satisfied are you with our service? (1-5)', type: 'rating', required: true },
          { id: 'q2', text: 'Any additional comments?', type: 'text', required: false },
        ]
      : opts.type === 'CES'
        ? [
            { id: 'q1', text: 'How easy was it to resolve your issue? (1-7)', type: 'rating', required: true },
            { id: 'q2', text: 'Please explain your rating', type: 'text', required: false },
          ]
        : [
            { id: 'q1', text: 'Custom question', type: 'text', required: true },
          ]

  return prisma.survey.create({
    data: {
      brandId: opts.brandId,
      programId: opts.programId,
      name: opts.name ?? `Test Survey ${counter}`,
      type: opts.type ?? 'NPS',
      questions: (opts.questions ?? defaultQuestions) as Prisma.InputJsonValue,
      settings: opts.settings as Prisma.InputJsonValue ?? undefined,
      status: opts.status ?? 'ACTIVE',
      incentivePoints: opts.incentivePoints !== undefined ? opts.incentivePoints : null,
      triggerCategory: opts.triggerCategory ?? null,
      triggerKey: opts.triggerKey ?? null,
      surveyTypeOverride: opts.surveyTypeOverride ?? null,
    },
  })
}

export async function createNpsSurvey(opts: {
  brandId: string
  programId: string
  name?: string
  incentivePoints?: number | null
}) {
  return createSurvey({
    brandId: opts.brandId,
    programId: opts.programId,
    type: 'NPS',
    name: opts.name ?? 'NPS Survey',
    incentivePoints: opts.incentivePoints !== undefined ? opts.incentivePoints : null,
  })
}

export async function createSurveyResponse(opts: {
  surveyId: string
  memberId: string
  brandId: string
  score?: number
  sentiment?: number
  topics?: string[]
  answers?: Record<string, unknown>
  channel?: string
}) {
  const prisma = getTestPrisma()

  return prisma.surveyResponse.create({
    data: {
      surveyId: opts.surveyId,
      memberId: opts.memberId,
      brandId: opts.brandId,
      answers: (opts.answers ?? { q1: opts.score ?? 8, q2: 'Test response' }) as Prisma.InputJsonValue,
      score: opts.score ?? null,
      sentiment: opts.sentiment ?? null,
      topics: opts.topics ?? [],
      channel: opts.channel ?? 'link',
    },
  })
}
