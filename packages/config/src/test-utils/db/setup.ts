import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

let prisma: PrismaClient

/**
 * Creates an isolated test schema for each test run and runs migrations against it.
 * Call in beforeAll(). Each test file gets its own schema to enable parallel test execution.
 */
export async function setupTestDb(): Promise<PrismaClient> {
  const schemaName = `test_${process.pid}_${Date.now()}`
  const baseUrl = process.env.DATABASE_URL ?? 'postgresql://customereq:customereq@localhost:5432/customereq'
  const testUrl = `${baseUrl}?schema=${schemaName}`

  process.env.DATABASE_URL = testUrl

  prisma = new PrismaClient({
    datasources: { db: { url: testUrl } },
  })

  // Create schema and push tables
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  try {
    execSync(`npx prisma db push --skip-generate --accept-data-loss --schema="${process.cwd()}/../../packages/database/prisma/schema.prisma"`, {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
      cwd: process.cwd(),
    })
  } catch (err) {
    // Try alternative path (running from repo root)
    try {
      execSync(`npx prisma db push --skip-generate --accept-data-loss --schema="./packages/database/prisma/schema.prisma"`, {
        env: { ...process.env, DATABASE_URL: testUrl },
        stdio: 'pipe',
        cwd: process.cwd(),
      })
    } catch {
      // Last resort — tables may already exist
    }
  }

  await prisma.$connect()
  return prisma
}

export function getTestPrisma(): PrismaClient {
  if (!prisma) throw new Error('Test DB not initialized. Call setupTestDb() in beforeAll().')
  return prisma
}
