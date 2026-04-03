/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Public Programs API — /v1/public/programs', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  describe('GET /v1/public/programs/by-slug/:slug', () => {
    it('returns program info for a known active slug', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const prisma = getTestPrisma()
      await prisma.program.update({
        where: { id: program.id },
        data: { slug: 'acme-rewards' },
      })

      const res = await unauthenticatedRequest().get('/v1/public/programs/by-slug/acme-rewards')

      expect(res.status).toBe(200)
      expect(res.body.programId).toBe(program.id)
      expect(res.body.programSlug).toBe('acme-rewards')
      expect(res.body.brandId).toBe(brand.id)
      expect(typeof res.body.programName).toBe('string')
      expect(typeof res.body.brandName).toBe('string')
    })

    it('returns 404 for an unknown slug', async () => {
      const res = await unauthenticatedRequest().get('/v1/public/programs/by-slug/does-not-exist')

      expect(res.status).toBe(404)
    })

    it('returns 404 for an inactive program slug', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'PAUSED' })

      const prisma = getTestPrisma()
      await prisma.program.update({
        where: { id: program.id },
        data: { slug: 'inactive-prog' },
      })

      const res = await unauthenticatedRequest().get('/v1/public/programs/by-slug/inactive-prog')

      expect(res.status).toBe(404)
    })

    it('requires no authentication — responds without auth headers', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })

      const prisma = getTestPrisma()
      await prisma.program.update({
        where: { id: program.id },
        data: { slug: 'no-auth-needed' },
      })

      // unauthenticatedRequest sends no auth headers
      const res = await unauthenticatedRequest().get('/v1/public/programs/by-slug/no-auth-needed')

      expect(res.status).toBe(200)
    })
  })
})
