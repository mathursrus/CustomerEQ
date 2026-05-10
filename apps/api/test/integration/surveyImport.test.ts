/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

// Minimal valid CSVs for each source type
const EXCEL_CSV_MINIMAL = [
  'user,date,score,verbatim',
  'alice@example.com,2025-11-15,9,Excellent service',
  'bob@example.com,2025-10-01,4,Could be better',
].join('\n')

const EXCEL_CSV_SHUFFLED_HEADERS = [
  'verbatim,score,date,user',
  'Excellent service,9,2025-11-15,alice@example.com',
].join('\n')

const EXCEL_CSV_RATING_COLUMN = [
  'Email,Rating,Feedback,Response Date',
  'carol@example.com,4,Good product,2025-09-20',
].join('\n')

const EXCEL_CSV_WITH_UNKNOWN_COLUMNS = [
  'user,score,verbatim,product,region',
  'dave@example.com,8,Great,SaaS,EMEA',
].join('\n')

const GOOGLE_REVIEWS_CSV = [
  'Reviewer,Star Rating,Review,Date,Review ID',
  'Alice Smith,5,Loved it,2025-11-01,GR_abc123',
  'Bob Jones,2,Not great,2025-10-15,GR_def456',
].join('\n')

const EXCEL_CSV_MISSING_EMAIL = [
  'score,verbatim',
  '8,Nice',
].join('\n')

describe('Survey Import API — POST /v1/surveys/:id/import', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // -------------------------------------------------------------------------
  // Happy path — Excel
  // -------------------------------------------------------------------------

  describe('Excel source type', () => {
    it('accepts a valid CSV and returns 202 with batchId and rowCount', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
      const request = authenticatedRequest(brand.id)

      const res = await request
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      expect(res.status).toBe(202)
      expect(res.body.batchId).toBeTruthy()
      expect(res.body.rowCount).toBe(2)
      expect(res.body.validationErrors).toHaveLength(0)
    })

    it('creates a SurveyImportBatch record in the DB', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      const prisma = getTestPrisma()
      const batch = await prisma.surveyImportBatch.findUnique({ where: { id: res.body.batchId } })
      expect(batch).not.toBeNull()
      expect(batch!.sourceType).toBe('excel')
      expect(batch!.totalRows).toBe(2)
      expect(batch!.brandId).toBe(brand.id)
    })

    it('enqueues one job per row', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      const jobs = InMemoryQueue.getJobs('survey-import')
      expect(jobs).toHaveLength(2)
    })

    it('accepts CSV with headers in any order', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_SHUFFLED_HEADERS)

      expect(res.status).toBe(202)
      expect(res.body.rowCount).toBe(1)
    })

    it('accepts CSV with alternative column names (Rating, Feedback, Response Date)', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_RATING_COLUMN)

      expect(res.status).toBe(202)
      expect(res.body.rowCount).toBe(1)
    })

    it('accepts CSV with unknown extra columns without error', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_WITH_UNKNOWN_COLUMNS)

      expect(res.status).toBe(202)
      expect(res.body.validationErrors).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Happy path — Google Reviews
  // -------------------------------------------------------------------------

  describe('Google Reviews source type', () => {
    it('accepts a valid Google Reviews CSV and returns 202', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=google_reviews`)
        .set('Content-Type', 'text/csv')
        .send(GOOGLE_REVIEWS_CSV)

      expect(res.status).toBe(202)
      expect(res.body.rowCount).toBe(2)
    })

    it('enqueues Google Reviews rows with email=null in the payload', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=google_reviews`)
        .set('Content-Type', 'text/csv')
        .send(GOOGLE_REVIEWS_CSV)

      const jobs = InMemoryQueue.getJobs('survey-import')
      expect(jobs).toHaveLength(2)
      jobs.forEach((job) => expect(job.data.email).toBeNull())
    })
  })

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------

  describe('Validation', () => {
    it('returns 422 when sourceType is missing', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      expect(res.status).toBe(422)
    })

    it('returns 422 when sourceType is invalid', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=typeform`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      expect(res.status).toBe(422)
    })

    it('returns 422 for Excel CSV missing user/email column', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MISSING_EMAIL)

      expect(res.status).toBe(422)
      expect(res.body.message).toMatch(/email/i)
    })

    it('returns 422 for file with headers only and no rows', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send('user,score,verbatim\n')

      expect(res.status).toBe(422)
    })

    it('returns 413 for file exceeding 10 MB', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
      const bigCsv = 'user,score\n' + 'x@example.com,8\n'.repeat(600_000)

      const res = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(bigCsv)

      expect(res.status).toBe(413)
    })

    it('returns 404 when survey does not belong to brand', async () => {
      const brand1 = await createBrand()
      const brand2 = await createBrand()
      const program = await createProgram({ brandId: brand2.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand2.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand1.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/surveys/:id/imports
  // -------------------------------------------------------------------------

  describe('GET /v1/surveys/:id/imports — list batches', () => {
    it('returns empty array when no imports exist', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/imports`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns batches ordered newest-first after an import', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
      const req = authenticatedRequest(brand.id)

      await req
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      const res = await req.get(`/v1/surveys/${survey.id}/imports`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].sourceType).toBe('excel')
      expect(res.body[0].totalRows).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/surveys/:id/imports/:batchId
  // -------------------------------------------------------------------------

  describe('GET /v1/surveys/:id/imports/:batchId — batch detail', () => {
    it('returns batch detail with status and progress', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const createRes = await authenticatedRequest(brand.id)
        .post(`/v1/surveys/${survey.id}/import?sourceType=excel`)
        .set('Content-Type', 'text/csv')
        .send(EXCEL_CSV_MINIMAL)

      const batchId = createRes.body.batchId
      const res = await authenticatedRequest(brand.id).get(`/v1/surveys/${survey.id}/imports/${batchId}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(batchId)
      expect(res.body.status).toBe('pending')
      expect(res.body.totalRows).toBe(2)
      expect(res.body.processedRows).toBe(0)
      expect(res.body.errors).toEqual([])
    })

    it('returns 404 for unknown batchId', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

      const res = await authenticatedRequest(brand.id)
        .get(`/v1/surveys/${survey.id}/imports/nonexistent_batch_id`)
      expect(res.status).toBe(404)
    })
  })
})
