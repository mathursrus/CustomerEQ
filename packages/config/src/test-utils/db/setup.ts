import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const GLOBAL_PRISMA_KEY = Symbol.for('customerEQ.test_prisma')

/**
 * Creates an isolated test schema for each test run and runs migrations against it.
 * Call in beforeAll(). Each test file gets its own schema to enable parallel test execution.
 */
export async function setupTestDb(): Promise<PrismaClient> {
  const schemaName = `test_${process.pid}_${Date.now()}`
  const baseUrl = (process.env.DATABASE_URL ?? 'postgresql://customerEQ:customerEQ@localhost:5432/customerEQ').split('?')[0]
  const testUrl = `${baseUrl}?schema=${schemaName}`

  process.env.DATABASE_URL = testUrl

  const prisma = new PrismaClient({
    datasources: { db: { url: testUrl } },
  })

  // Create schema and push tables
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  // Resolve prisma binary from the workspace root (pnpm hoist layout).
  const repoRoot = path.resolve(process.cwd(), '../../')
  const prismaBin =
    path.join(repoRoot, 'node_modules/.pnpm/node_modules/.bin/prisma') + (process.platform === 'win32' ? '.cmd' : '')
  const schemaPath = path.join(repoRoot, 'packages/database/prisma/schema.prisma')

  const tempSchemaPath = createVectorlessSchema(schemaPath)

  const runPush = (bin: string, schemaFile = schemaPath) => {
    execSync(`"${bin}" db push --skip-generate --accept-data-loss --schema="${schemaFile}"`, {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
      cwd: repoRoot,
    })
  }

  try {
    runPush(prismaBin)
  } catch (error) {
    const message = getCommandErrorMessage(error)
    if (message.includes('type "public.vector" does not exist')) {
      runPush(prismaBin, tempSchemaPath)
    } else {
      throw error
    }
  } finally {
    try {
      fs.unlinkSync(tempSchemaPath)
    } catch {
      // Best-effort cleanup.
    }
  }

  await prisma.$connect()
  ;(globalThis as any)[GLOBAL_PRISMA_KEY] = prisma
  return prisma
}

function createVectorlessSchema(schemaPath: string): string {
  const schema = fs.readFileSync(schemaPath, 'utf8')
  const sanitized = schema.replace(
    /^\s*embedding Unsupported\("public\.vector\(1536\)"\)\? \/\/.*$/m,
    '',
  )
  const tempPath = path.join(os.tmpdir(), `customerEQ-test-schema-${process.pid}-${Date.now()}.prisma`)
  fs.writeFileSync(tempPath, sanitized, 'utf8')
  return tempPath
}

function getCommandErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function getTestPrisma(): PrismaClient {
  const prisma = (globalThis as any)[GLOBAL_PRISMA_KEY]
  if (!prisma) {
    console.error(`[DEBUG] getTestPrisma FAILED in process ${process.pid}. globalThis symbols:`, Object.getOwnPropertySymbols(globalThis).map(s => s.toString()))
    throw new Error('Test DB not initialized. Call setupTestDb() in beforeAll().')
  }
  return prisma
}

