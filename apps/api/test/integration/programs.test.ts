/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createProgramWithRules,
  createReward,
  createTier,
  authenticatedRequest,
  getTestPrisma,
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

    it('includes tiers and rewards in the response', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      await createTier({ brandId: brand.id, programId: program.id, name: 'Bronze', rank: 1 })
      await createReward({ brandId: brand.id, programId: program.id, name: 'Free Coffee' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.tiers)).toBe(true)
      expect(res.body.tiers).toHaveLength(1)
      expect(Array.isArray(res.body.rewards)).toBe(true)
      expect(res.body.rewards).toHaveLength(1)
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
  // GET /v1/programs — pagination envelope
  // -------------------------------------------------------------------------

  describe('GET /v1/programs', () => {
    it('returns a pagination envelope with data, total, page, pageSize, totalPages', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.total).toBe(2)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(25)
      expect(res.body.totalPages).toBe(1)
    })

    it('returns an empty data array for a brand with no programs', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0)
      expect(res.body.total).toBe(0)
    })

    it('does not include programs from other brands (tenant isolation)', async () => {
      const brandA = await createBrand()
      const brandB = await createBrand()
      await createProgram({ brandId: brandA.id })
      await createProgram({ brandId: brandB.id })
      const request = await authenticatedRequest(brandA.id)

      const res = await request.get('/v1/programs')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].brandId).toBe(brandA.id)
    })

    it('respects the pageSize query parameter', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs?pageSize=2')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.pageSize).toBe(2)
      expect(res.body.totalPages).toBe(2)
      expect(res.body.total).toBe(3)
    })

    it('respects the page query parameter for the second page', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs?page=2&pageSize=2')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.page).toBe(2)
    })

    it('filters by status query parameter', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id, status: 'DRAFT' })
      await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs?status=DRAFT')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].status).toBe('DRAFT')
    })

    it('filters by type query parameter', async () => {
      const brand = await createBrand()
      await createProgram({ brandId: brand.id, type: 'POINTS' })
      await createProgram({ brandId: brand.id, type: 'TIERED' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/programs?type=TIERED')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].type).toBe('TIERED')
    })
  })

  // -------------------------------------------------------------------------
  // PUT /v1/programs/:id/status
  // -------------------------------------------------------------------------

  describe('PUT /v1/programs/:id/status', () => {
    it('transitions a DRAFT program to ACTIVE when it has at least one earning rule', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: brand.id, status: 'DRAFT', rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })
      const request = await authenticatedRequest(brand.id)

      const res = await request.put(`/v1/programs/${program.id}/status`).send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ACTIVE')
    })

    it('returns 422 when attempting to activate a DRAFT program with no earning rules', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'DRAFT' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.put(`/v1/programs/${program.id}/status`).send({ status: 'ACTIVE' })

      expect(res.status).toBe(422)
      expect(res.body.error).toMatch(/rule/i)
    })

    it('transitions an ACTIVE program to PAUSED', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: brand.id, status: 'ACTIVE', rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })
      const request = await authenticatedRequest(brand.id)

      const res = await request.put(`/v1/programs/${program.id}/status`).send({ status: 'PAUSED' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('PAUSED')
    })

    it('transitions a PAUSED program back to ACTIVE', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: brand.id, status: 'PAUSED', rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })
      const request = await authenticatedRequest(brand.id)

      const res = await request.put(`/v1/programs/${program.id}/status`).send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ACTIVE')
    })

    it('returns 404 when a different brand attempts the status transition', async () => {
      const ownerBrand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: ownerBrand.id, rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })

      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request.put(`/v1/programs/${program.id}/status`).send({ status: 'ACTIVE' })

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // Tier CRUD — /v1/programs/:id/tiers
  // -------------------------------------------------------------------------

  describe('Tier CRUD', () => {
    describe('POST /v1/programs/:id/tiers', () => {
      it('creates a tier and returns 201 with the tier data', async () => {
        const brand = await createBrand()
        const program = await createProgram({ brandId: brand.id })
        const request = await authenticatedRequest(brand.id)

        const res = await request.post(`/v1/programs/${program.id}/tiers`).send({
          name: 'Bronze',
          rank: 1,
          minPoints: 0,
          benefits: ['Early access'],
        })

        expect(res.status).toBe(201)
        expect(res.body.id).toBeDefined()
        expect(res.body.name).toBe('Bronze')
        expect(res.body.rank).toBe(1)
        expect(res.body.programId).toBe(program.id)
      })

      it('returns 422 when name is missing', async () => {
        const brand = await createBrand()
        const program = await createProgram({ brandId: brand.id })
        const request = await authenticatedRequest(brand.id)

        const res = await request.post(`/v1/programs/${program.id}/tiers`).send({ rank: 1 })

        expect(res.status).toBe(422)
      })

      it('returns 404 when creating a tier for a different brand program', async () => {
        const ownerBrand = await createBrand()
        const program = await createProgram({ brandId: ownerBrand.id })

        const attackerBrand = await createBrand()
        const request = await authenticatedRequest(attackerBrand.id)

        const res = await request.post(`/v1/programs/${program.id}/tiers`).send({ name: 'Bronze', rank: 1 })

        expect(res.status).toBe(404)
      })
    })

    describe('GET /v1/programs/:id (tiers sorted by rank)', () => {
      it('returns tiers sorted ascending by rank', async () => {
        const brand = await createBrand()
        const program = await createProgram({ brandId: brand.id })
        await createTier({ brandId: brand.id, programId: program.id, name: 'Platinum', rank: 3 })
        await createTier({ brandId: brand.id, programId: program.id, name: 'Bronze', rank: 1 })
        await createTier({ brandId: brand.id, programId: program.id, name: 'Gold', rank: 2 })
        const request = await authenticatedRequest(brand.id)

        const res = await request.get(`/v1/programs/${program.id}`)

        expect(res.status).toBe(200)
        const ranks = res.body.tiers.map((t: { rank: number }) => t.rank)
        expect(ranks).toEqual([1, 2, 3])
      })
    })

    describe('DELETE /v1/programs/:id/tiers/:tierId', () => {
      it('soft-deletes a tier — 200 and tier excluded from subsequent GET', async () => {
        const brand = await createBrand()
        const program = await createProgram({ brandId: brand.id })
        const tier = await createTier({ brandId: brand.id, programId: program.id, name: 'Bronze', rank: 1 })
        const request = await authenticatedRequest(brand.id)

        const deleteRes = await request.delete(`/v1/programs/${program.id}/tiers/${tier.id}`)
        expect(deleteRes.status).toBe(200)

        const getRes = await request.get(`/v1/programs/${program.id}`)
        expect(getRes.body.tiers).toHaveLength(0)
      })

      it('returns 409 when members are currently assigned to the tier', async () => {
        const brand = await createBrand()
        const program = await createProgram({ brandId: brand.id })
        const tier = await createTier({ brandId: brand.id, programId: program.id, name: 'Gold', rank: 1 })
        const prisma = getTestPrisma()
        const tierMemberEmail = `tier-member-${Date.now()}@test.com`
        await prisma.member.create({
          data: {
            brandId: brand.id,
            email: tierMemberEmail,
            externalId: tierMemberEmail.toLowerCase(),
            enrolledVia: 'MANUAL_API',
            currentTierId: tier.id,
          },
        })
        const request = await authenticatedRequest(brand.id)

        const res = await request.delete(`/v1/programs/${program.id}/tiers/${tier.id}`)

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/member/i)
      })

      it('returns 404 when deleting a tier from a different brand program', async () => {
        const ownerBrand = await createBrand()
        const program = await createProgram({ brandId: ownerBrand.id })
        const tier = await createTier({ brandId: ownerBrand.id, programId: program.id, name: 'Bronze', rank: 1 })

        const attackerBrand = await createBrand()
        const request = await authenticatedRequest(attackerBrand.id)

        const res = await request.delete(`/v1/programs/${program.id}/tiers/${tier.id}`)

        expect(res.status).toBe(404)
      })
    })
  })

  // -------------------------------------------------------------------------
  // Reward retire — DELETE /v1/programs/:id/rewards/:rwId
  // -------------------------------------------------------------------------

  describe('Reward retire', () => {
    it('retires a reward immediately when no expireAt is provided', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const reward = await createReward({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.delete(`/v1/programs/${program.id}/rewards/${reward.id}`)

      expect(res.status).toBe(200)
      expect(res.body.isAvailable).toBe(false)
    })

    it('schedules a future retire when expireAt is provided', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const reward = await createReward({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)
      const futureDate = '2027-12-31T23:59:59.000Z'

      const res = await request
        .delete(`/v1/programs/${program.id}/rewards/${reward.id}`)
        .send({ expireAt: futureDate })

      expect(res.status).toBe(200)
      expect(res.body.isAvailable).toBe(true)
      expect(res.body.availableTo).toBe(futureDate)
    })

    it('returns 404 when retiring a reward from a different brand program', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id })
      const reward = await createReward({ brandId: ownerBrand.id, programId: program.id })

      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request.delete(`/v1/programs/${program.id}/rewards/${reward.id}`)

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/programs/:id/simulate
  // -------------------------------------------------------------------------

  describe('POST /v1/programs/:id/simulate', () => {
    it('returns rulesMatched and totalPoints for a matching event', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        status: 'ACTIVE',
        rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }],
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request
        .post(`/v1/programs/${program.id}/simulate`)
        .send({ eventType: 'purchase', payload: { amount: 150 } })

      expect(res.status).toBe(200)
      expect(res.body.totalPoints).toBe(100)
      expect(Array.isArray(res.body.rulesMatched)).toBe(true)
      expect(res.body.rulesMatched).toHaveLength(1)
    })

    it('returns totalPoints of 0 when no rules match', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        status: 'ACTIVE',
        rules: [{ triggerEvent: 'login', pointsAwarded: 50 }],
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request
        .post(`/v1/programs/${program.id}/simulate`)
        .send({ eventType: 'purchase', payload: {} })

      expect(res.status).toBe(200)
      expect(res.body.totalPoints).toBe(0)
      expect(res.body.rulesMatched).toHaveLength(0)
    })

    it('does not create a LoyaltyEvent record (non-mutating)', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        status: 'ACTIVE',
        rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }],
      })
      const request = await authenticatedRequest(brand.id)
      const prisma = getTestPrisma()
      const beforeCount = await prisma.loyaltyEvent.count()

      await request
        .post(`/v1/programs/${program.id}/simulate`)
        .send({ eventType: 'purchase', payload: {} })

      const afterCount = await prisma.loyaltyEvent.count()
      expect(afterCount).toBe(beforeCount)
    })

    it('returns 422 when eventType is missing', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request
        .post(`/v1/programs/${program.id}/simulate`)
        .send({ payload: {} })

      expect(res.status).toBe(422)
    })

    it('returns 404 when simulating against a different brand program', async () => {
      const ownerBrand = await createBrand()
      const { program } = await createProgramWithRules({ brandId: ownerBrand.id, rules: [{ triggerEvent: 'purchase', pointsAwarded: 100 }] })

      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request
        .post(`/v1/programs/${program.id}/simulate`)
        .send({ eventType: 'purchase' })

      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/programs/:id/versions (explicit save)
  // -------------------------------------------------------------------------

  describe('POST /v1/programs/:id/versions', () => {
    it('creates a version snapshot and returns 201 with a versionId', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post(`/v1/programs/${program.id}/versions`)

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.programId).toBe(program.id)
      expect(res.body.snapshot).toBeDefined()
    })

    it('returns a list of versions via GET /v1/programs/:id/versions', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id })
      const request = await authenticatedRequest(brand.id)
      await request.post(`/v1/programs/${program.id}/versions`)
      await request.post(`/v1/programs/${program.id}/versions`)

      const res = await request.get(`/v1/programs/${program.id}/versions`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data).toHaveLength(2)
    })

    it('returns 404 when creating a version for a different brand program', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id })

      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request.post(`/v1/programs/${program.id}/versions`)

      expect(res.status).toBe(404)
    })
  })
})


  // -------------------------------------------------------------------------
  // GET /v1/programs/:id/trigger-options (Issue #79)
  // -------------------------------------------------------------------------

  describe('GET /v1/programs/:id/trigger-options', () => {
    it('returns hasEarnRules=false and empty loyaltyMoments when no earn rules configured', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}/trigger-options`)

      expect(res.status).toBe(200)
      expect(res.body.hasEarnRules).toBe(false)
      expect(Array.isArray(res.body.loyaltyMoments)).toBe(true)
      expect(res.body.loyaltyMoments).toHaveLength(0)
    })

    it('returns deduplicated loyaltyMoments from active earn rules', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        rules: [
          { triggerEvent: 'tier.upgraded', pointsAwarded: 100 },
          { triggerEvent: 'member.enrolled', pointsAwarded: 50 },
          { triggerEvent: 'tier.upgraded', pointsAwarded: 200 }, // duplicate — should be deduped
        ],
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}/trigger-options`)

      expect(res.status).toBe(200)
      expect(res.body.hasEarnRules).toBe(true)
      const keys = res.body.loyaltyMoments.map((m: { key: string }) => m.key)
      expect(keys).toContain('tier_upgrade')
      expect(keys).toContain('enrollment')
      // deduplication: tier.upgraded appears only once
      expect(keys.filter((k: string) => k === 'tier_upgrade')).toHaveLength(1)
    })

    it('each loyaltyMoment has key, label, and icon fields', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        rules: [{ triggerEvent: 'tier.upgraded', pointsAwarded: 100 }],
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}/trigger-options`)

      expect(res.status).toBe(200)
      const moment = res.body.loyaltyMoments[0]
      expect(moment).toHaveProperty('key')
      expect(moment).toHaveProperty('label')
      expect(moment).toHaveProperty('icon')
      expect(typeof moment.label).toBe('string')
    })

    it('returns 404 for program belonging to another brand', async () => {
      const ownerBrand = await createBrand()
      const program = await createProgram({ brandId: ownerBrand.id })
      const attackerBrand = await createBrand()
      const request = await authenticatedRequest(attackerBrand.id)

      const res = await request.get(`/v1/programs/${program.id}/trigger-options`)

      expect(res.status).toBe(404)
    })

    it('unknown triggerEvent values surface as passthrough key with default icon', async () => {
      const brand = await createBrand()
      const { program } = await createProgramWithRules({
        brandId: brand.id,
        rules: [{ triggerEvent: 'some.custom_event', pointsAwarded: 100 }],
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get(`/v1/programs/${program.id}/trigger-options`)

      expect(res.status).toBe(200)
      expect(res.body.loyaltyMoments).toHaveLength(1)
      const moment = res.body.loyaltyMoments[0]
      expect(moment.key).toBe('some.custom_event')
      expect(moment.icon).toBeTruthy()
    })
  })
