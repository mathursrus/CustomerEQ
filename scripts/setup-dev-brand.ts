/**
 * Bootstrap the local dev Brand record.
 * Must be run once after a fresh db:migrate before pnpm seed:demo.
 *
 * Usage: pnpm setup:dev-brand
 */

import { PrismaClient } from '@prisma/client'

const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'

const db = new PrismaClient()

async function main() {
  console.log('Setting up local dev brand…\n')

  const existing = await db.brand.findUnique({ where: { id: BRAND_ID } })
  if (existing) {
    console.log(`✓ Brand already exists: "${existing.name}" (${existing.id})`)
    return
  }

  const brand = await db.brand.create({
    data: {
      id: BRAND_ID,
      clerkOrgId: `local_dev_${BRAND_ID}`,
      name: 'CustomerEQ Dev Org',
    },
  })

  console.log(`✓ Brand created: "${brand.name}" (${brand.id})`)
  console.log('\nNext step: pnpm seed:demo')
}

main()
  .catch(err => { console.error('Fatal:', err); process.exit(1) })
  .finally(() => db.$disconnect())
