/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupTestDb,
  teardownTestDb,
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  createReward,
  authenticatedRequest,
} from '@customerEQ/config/test-utils'

describe('Rewards & Redemptions API', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await seedTestDb()
  })

  // -------------------------------------------------------------------------
  // POST /v1/rewards — admin creates a reward
  // -------------------------------------------------------------------------

  describe('POST /v1/rewards', () => {
    it('creates a reward and returns it in the catalog with status 201', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/rewards').send({
        programId: program.id,
        name: '$10 Gift Card',
        type: 'GIFT_CARD',
        pointsCost: 1000,
        monetaryValue: 10.0,
        isAvailable: true,
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('$10 Gift Card')
      expect(res.body.pointsCost).toBe(1000)
      expect(res.body.type).toBe('GIFT_CARD')
      expect(res.body.isAvailable).toBe(true)
    })

    it('returns 422 when required fields are missing', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/rewards').send({
        type: 'GIFT_CARD',
        pointsCost: 500,
      })

      expect(res.status).toBe(422)
    })
  })

  // -------------------------------------------------------------------------
  // GET /v1/rewards — member browses rewards
  // -------------------------------------------------------------------------

  describe('GET /v1/rewards', () => {
    it('returns 200 with a list of available rewards for the brand', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      await createReward({ brandId: brand.id, programId: program.id, name: 'Reward A', pointsCost: 500 })
      await createReward({ brandId: brand.id, programId: program.id, name: 'Reward B', pointsCost: 1000 })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/rewards')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(2)

      const names = res.body.map((r: { name: string }) => r.name)
      expect(names).toContain('Reward A')
      expect(names).toContain('Reward B')
    })

    it('does not return rewards belonging to a different brand', async () => {
      const brand = await createBrand()
      const otherBrand = await createBrand()
      const otherProgram = await createProgram({ brandId: otherBrand.id, status: 'ACTIVE' })
      await createReward({
        brandId: otherBrand.id,
        programId: otherProgram.id,
        name: 'Other Brand Reward',
        pointsCost: 100,
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.get('/v1/rewards')

      expect(res.status).toBe(200)
      const names = res.body.map((r: { name: string }) => r.name)
      expect(names).not.toContain('Other Brand Reward')
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/redemptions — member redeems a reward
  // -------------------------------------------------------------------------

  describe('POST /v1/redemptions', () => {
    it('creates a Redemption and decrements pointsBalance when member has sufficient points', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
        pointsBalance: 1500,
      })
      const reward = await createReward({
        brandId: brand.id,
        programId: program.id,
        name: 'Free Coffee',
        pointsCost: 500,
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/redemptions').send({
        memberId: member.id,
        rewardId: reward.id,
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.memberId).toBe(member.id)
      expect(res.body.rewardId).toBe(reward.id)
      expect(res.body.pointsSpent).toBe(500)

      // Verify balance is decremented
      const balanceRes = await request.get(`/v1/members/${member.id}/balance`)
      expect(balanceRes.body.pointsBalance).toBe(1000)
    })

    it('returns 422 "Insufficient points balance" when member lacks enough points', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
        pointsBalance: 200,
      })
      const reward = await createReward({
        brandId: brand.id,
        programId: program.id,
        name: 'Expensive Reward',
        pointsCost: 1000,
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/redemptions').send({
        memberId: member.id,
        rewardId: reward.id,
      })

      expect(res.status).toBe(422)
      expect(res.body.message).toMatch(/insufficient/i)
    })

    it('ensures only one concurrent redemption succeeds when the balance only covers one', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
        pointsBalance: 500, // exactly enough for one redemption
      })
      const reward = await createReward({
        brandId: brand.id,
        programId: program.id,
        name: 'Single Use Reward',
        pointsCost: 500,
      })
      const request = await authenticatedRequest(brand.id)

      // Fire two concurrent redemption requests
      const [res1, res2] = await Promise.all([
        request.post('/v1/redemptions').send({ memberId: member.id, rewardId: reward.id }),
        request.post('/v1/redemptions').send({ memberId: member.id, rewardId: reward.id }),
      ])

      const statuses = [res1.status, res2.status].sort()
      // Exactly one succeeds (201) and one fails (422)
      expect(statuses).toEqual([201, 422])

      // Balance is now 0, not negative
      const balanceRes = await request.get(`/v1/members/${member.id}/balance`)
      expect(balanceRes.body.pointsBalance).toBe(0)
    })

    it('returns 404 when attempting to redeem a reward from a different brand', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({
        brandId: brand.id,
        programId: program.id,
        pointsBalance: 5000,
      })

      const otherBrand = await createBrand()
      const otherProgram = await createProgram({ brandId: otherBrand.id, status: 'ACTIVE' })
      const otherReward = await createReward({
        brandId: otherBrand.id,
        programId: otherProgram.id,
        name: 'Other Brand Reward',
        pointsCost: 100,
      })
      const request = await authenticatedRequest(brand.id)

      const res = await request.post('/v1/redemptions').send({
        memberId: member.id,
        rewardId: otherReward.id,
      })

      expect(res.status).toBe(404)
    })
  })
})
