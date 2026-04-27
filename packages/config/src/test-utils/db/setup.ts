import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const GLOBAL_PRISMA_KEY = Symbol.for('customerEQ.test_prisma')

/**
 * Creates an isolated test schema for each test run and runs migrations against it.
 * Call in beforeAll(). Each test file gets its own schema to enable parallel test execution.
 */
export async function setupTestDb(): Promise<PrismaClient> {
  const schemaName = `test_${process.pid}_${Date.now()}`
  const baseUrl = process.env.DATABASE_URL ?? 'postgresql://customereq:customereq@localhost:5432/customereq'
  const testUrl = `${baseUrl}?schema=${schemaName}`

  process.env.DATABASE_URL = testUrl

  const prisma = new PrismaClient({
    datasources: { db: { url: testUrl } },
  })

  // Create schema and push tables
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  // Resolve prisma binary: try workspace node_modules first (pnpm hoist), then npx fallback
  const path = require('path')
  const repoRoot = path.resolve(process.cwd(), '../../')
  const prismaBin =
    path.join(repoRoot, 'node_modules/.pnpm/node_modules/.bin/prisma') + (process.platform === 'win32' ? '.cmd' : '')
  const schemaPath = path.join(repoRoot, 'packages/database/prisma/schema.prisma')

  const runPush = (bin: string) => {
    execSync(`"${bin}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
      cwd: repoRoot,
    })
  }

  try {
    runPush(prismaBin)
  } catch {
    try {
      runPush('npx prisma')
    } catch {
      // Last resort — tables may already exist
    }
  }

  await prisma.$connect()
  ;(globalThis as any)[GLOBAL_PRISMA_KEY] = prisma
  return prisma
}

export function getTestPrisma(): PrismaClient {
  const prisma = (globalThis as any)[GLOBAL_PRISMA_KEY]
  if (!prisma) {
    console.error(`[DEBUG] getTestPrisma FAILED in process ${process.pid}. globalThis symbols:`, Object.getOwnPropertySymbols(globalThis).map(s => s.toString()))
    throw new Error('Test DB not initialized. Call setupTestDb() in beforeAll().')
  }
  return prisma
}

