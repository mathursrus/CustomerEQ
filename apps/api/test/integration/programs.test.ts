/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createProgramWithRules,
  authenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('Programs API — /v1/programs', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // -------------------------------------------------------------------------
  // POST /v1/programs
  // -------------------------------------------------------------------------

  describe('POST /v1/programs', () => {
    it('creates a program with valid data and returns status=DRAFT', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/programs').send({
        name: 'Summer Rewards 2026',
        pointCurrencyName: 'SunPoints',
        pointToCurrencyRatio: 0.01,
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('Summer Rewards 2026')
      expect(res.body.status).toBe('DRAFT')
      expect(res.body.brandId).toBe(brand.id)
      expect(res.body.pointCurrencyName).toBe('SunPoints')
      expect(res.body.pointToCurrencyRatio).toBe(0.01)
    })

    it('returns 422 when name is missing', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/programs').send({
        pointCurrencyName: 'Points',
        pointToCurrencyRatio: 0.01,
      })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Validation failed')
    })

    it('returns 422 when name is an empty string', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/programs').send({ name: '' })

      expect(res.status).toBe(422)
      expect(res.body.message).toMatch(/name/i)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/programs/:id
  // -------------------------------------------------------------------------

  describe('GET /v1/programs/:id', () => {
    it("returns 200 with program data when requesting own brand's program", async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(program.id)
      expect(res.body.name).toBe(program.name)
      expect(res.body.brandId).toBe(brand.id)
    })

    it('returns 404 when requesting a program that belongs to a different brand (tenant isolation)', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id })

      const otherBrand = await createBrand()
      const request = await authenticatedRequest(otherBrand.id)

      const res = await request.get(`/v1/programs/${program.id}`)

      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-existent program id', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /v1/programs/:id
  // -------------------------------------------------------------------------

  describe('PATCH /v1/programs/:id', () => {
    it('activates a DRAFT program by setting status=ACTIVE (requires earning rules)', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: brand.id, rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })
      const request = await authenticatedRequest(brand.id)

      const res = await request.patch(`/v1/programs/${program.id}`).send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ACTIVE')
      expect(res.body.id).toBe(program.id)
    })

    it('updates the program name successfully', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request
        .patch(`/v1/programs/${program.id}`)
        .send({ name: 'Renamed Program' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Renamed Program')
    })

    it('returns 404 when a different brand attempts to update the program', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id })

      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request
        .patch(`/v1/programs/${program.id}`)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(404)
    })

    it('returns 422 when attempting to set name to an empty string', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.patch(`/v1/programs/${program.id}`).send({ name: '' })

      expect(res.status).toBe(422)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/programs
  // -------------------------------------------------------------------------

  describe('GET /v1/programs', () => {
    it('returns a list of programs for the brand', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.programs)).toBe(true)
      expect(res.body.programs.length).toBe(2)
      expect(res.body.programs[0].brandId).toBe(brand.id)
    })

    it('returns an empty array for a brand with no programs', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(res.body.programs).toHaveLength(0)
    })

    it('does not include programs from other brands (tenant isolation)', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      await createProgram({ brandId: brandA.id })
      await createProgram({ brandId: brandB.id })
      const request = await authenticatedRequest(brandA.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(res.body.programs.length).toBe(1)
      expect(res.body.programs[0].brandId).toBe(brandA.id)
    })
  })
})
