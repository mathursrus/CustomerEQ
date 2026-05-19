import { getTestPrisma } from '../db/setup.js'

export async function createSupportWidgetConfig(opts: {
  brandId: string
  position?: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'
  greeting?: string
  anonAllowed?: boolean
  showCsatAfterAi?: boolean
  csatTimeoutSeconds?: number
  darkModeAuto?: boolean
}) {
  const prisma = getTestPrisma()
  return prisma.supportWidgetConfig.create({
    data: {
      brandId: opts.brandId,
      position: opts.position ?? 'BOTTOM_RIGHT',
      greeting: opts.greeting ?? 'Hi! How can we help?',
      anonAllowed: opts.anonAllowed ?? true,
      showCsatAfterAi: opts.showCsatAfterAi ?? true,
      csatTimeoutSeconds: opts.csatTimeoutSeconds ?? 30,
      darkModeAuto: opts.darkModeAuto ?? false,
    },
  })
}
