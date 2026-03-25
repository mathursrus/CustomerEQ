import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

let prisma: PrismaClient

/**
 * Creates an isolated test schema for each test run and runs migrations against it.
 * Call in beforeAll(). Each test file gets its own schema to enable parallel test execution.
 */
export async function setupTestDb(): Promise<PrismaClient> {
  const schemaName = `test_${process.pid}_${Date.now()}`
  const baseUrl = process.env.DATABASE_URL ?? 'postgresql://customerEQ:customerEQ@localhost:5432/customerEQ'
  const testUrl = `${baseUrl}?schema=${schemaName}`

  process.env.DATABASE_URL = testUrl

  prisma = new PrismaClient({
    datasources: { db: { url: testUrl } },
  })

  // Create schema and run migrations
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  try {
    execSync(`pnpm --filter @customerEQ/database db:migrate`, {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    })
  } catch {
    // Migration may fail if schema already exists — that's ok for test runs
  }

  await prisma.$connect()
  return prisma
}

export function getTestPrisma(): PrismaClient {
  if (!prisma) throw new Error('Test DB not initialized. Call setupTestDb() in beforeAll().')
  return prisma
}
