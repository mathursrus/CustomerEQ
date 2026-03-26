import { getTestPrisma } from './setup.js'

/**
 * Disconnects and drops the test schema created in setupTestDb().
 * Call in afterAll().
 */
export async function teardownTestDb(): Promise<void> {
  const prisma = getTestPrisma()
  const result = await prisma.$queryRaw<Array<{ schema_name: string }>>`
    SELECT current_schema() as schema_name
  `
  const schemaName = result[0]?.schema_name

  await prisma.$disconnect()

  if (schemaName && schemaName.startsWith('test_')) {
    // Use a fresh connection to drop the schema
    const { PrismaClient } = await import('@prisma/client')
    const rootPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL?.split('?')[0] } },
    })
    await rootPrisma.$connect()
    await rootPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    await rootPrisma.$disconnect()
  }
}
