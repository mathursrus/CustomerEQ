import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

/**
 * Migration-test sandbox.
 *
 * Creates an isolated Postgres schema, applies all migrations up to (but not
 * including) a chosen target, and returns a Prisma client plus an
 * `applyMigration()` hook so tests can:
 *
 *   1. Seed pre-migration state via raw SQL (because the typed Prisma client
 *      reflects the **post**-migration schema; pre-migration columns it has
 *      removed are unavailable through the typed API)
 *   2. Apply the target migration
 *   3. Assert on post-migration state via either Prisma or raw SQL
 *
 * Unlike `setupTestDb`, this helper does NOT use `prisma db push` — that
 * collapses all migrations into a single CREATE-from-schema pass and skips
 * the data migrations we want to exercise. Here we replay each migration
 * file's SQL in chronological (lexicographic) order, which is also Prisma's
 * own ordering.
 *
 * Use this for tests that verify data-migration behavior (e.g., backfills,
 * fan-outs, deletes). For structure-only verification of the current schema,
 * stick with `setupTestDb`.
 */

// packages/config/src/test-utils/db/ → packages/database/prisma/migrations/
// `__dirname` is available because this package compiles to CommonJS (see
// packages/config/tsconfig.json `module: commonjs`). Resolving relative to
// the file location rather than `process.cwd()` keeps the helper portable
// across test runners that change cwd.
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../database/prisma/migrations')

export interface SetupMigrationTestDbOptions {
  /**
   * Migration directory name to stop *before* (exclusive). All migrations
   * strictly preceding this one (lexicographic order) are applied; the
   * named migration is left for the test to apply via `applyMigration()`.
   */
  stopBefore: string
}

export interface MigrationTestDbHandle {
  prisma: PrismaClient
  schemaName: string
  /** Apply a specific migration by directory name. */
  applyMigration(migrationName: string): Promise<void>
  /** Disconnect and drop the sandbox schema. */
  teardown(): Promise<void>
}

export async function setupMigrationTestDb(
  opts: SetupMigrationTestDbOptions,
): Promise<MigrationTestDbHandle> {
  const schemaName = `migtest_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const baseUrl = (
    process.env.DATABASE_URL ?? 'postgresql://customerEQ:customerEQ@localhost:5432/customerEQ'
  ).split('?')[0]
  const testUrl = `${baseUrl}?schema=${schemaName}`

  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } })
  await prisma.$connect()

  // Sandbox schema. The Prisma connection URL above scopes search_path to
  // this schema via `?schema=…`, so bare table names in migration SQL and
  // typed Prisma operations resolve here rather than to `public`.
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  // Discover migrations in lexicographic (timestamp-prefix) order — Prisma
  // applies them in this exact order, and our filenames are TS-prefixed so
  // lexicographic == chronological.
  const allMigrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => {
      const full = path.join(MIGRATIONS_DIR, name)
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'migration.sql'))
    })
    .sort()

  const stopIndex = allMigrations.indexOf(opts.stopBefore)
  if (stopIndex === -1) {
    await prisma.$disconnect()
    throw new Error(
      `setupMigrationTestDb: migration "${opts.stopBefore}" not found. ` +
        `Available: ${allMigrations.join(', ')}`,
    )
  }

  for (const name of allMigrations.slice(0, stopIndex)) {
    await applyMigrationFile(prisma, schemaName, name)
  }

  return {
    prisma,
    schemaName,
    async applyMigration(migrationName: string) {
      await applyMigrationFile(prisma, schemaName, migrationName)
    },
    async teardown() {
      await prisma.$disconnect()
      // Reconnect on the base URL (no schema scoping) to drop the sandbox.
      const cleanup = new PrismaClient({ datasources: { db: { url: baseUrl } } })
      try {
        await cleanup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      } finally {
        await cleanup.$disconnect()
      }
    },
  }
}

async function applyMigrationFile(
  prisma: PrismaClient,
  schemaName: string,
  migrationName: string,
): Promise<void> {
  const sqlPath = path.join(MIGRATIONS_DIR, migrationName, 'migration.sql')
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration SQL not found at ${sqlPath}`)
  }
  const rawSql = fs.readFileSync(sqlPath, 'utf8')

  // Prisma's $executeRawUnsafe uses the extended query protocol with prepared
  // statements, which only allow ONE statement per call ("cannot insert
  // multiple commands into a prepared statement"). Migration files contain
  // many statements + PL/pgSQL DO blocks, so we split the SQL into individual
  // statements first. Strip explicit BEGIN/COMMIT — the $transaction wrapper
  // below already provides atomicity, and Postgres rejects nested BEGINs.
  const statements = splitSqlStatements(rawSql).filter((s) => {
    const head = s.trim().toUpperCase()
    return head !== 'BEGIN' && head !== 'COMMIT'
  })

  // Run all statements inside one Prisma interactive transaction so they share
  // a single connection. This pins `search_path` for the duration of the
  // migration — important because some prior migrations install pgvector in
  // `public` and reference bare `vector(1536)`; the sandbox schema's
  // ?schema=… URL would otherwise hide `public` from search_path and the type
  // resolution would fail.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`)
      for (const stmt of statements) {
        await tx.$executeRawUnsafe(stmt)
      }
    },
    { timeout: 60_000, maxWait: 60_000 },
  )
}

/**
 * Splits a PostgreSQL script into individual statements.
 *
 * Handles:
 * - `;` as the statement terminator outside any quoted context
 * - PostgreSQL `$tag$ … $tag$` dollar-quoted blocks (e.g. `$$ … $$` used in
 *   `DO $$ … END $$;` PL/pgSQL bodies)
 * - Single-quoted string literals (so `';'` inside a string isn't a split)
 * - `--` line comments and `/* ... *​/` block comments
 *
 * Returned statements have surrounding whitespace trimmed and exclude the
 * trailing `;`.
 */
function splitSqlStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let i = 0
  const len = sql.length
  let inDollar: string | null = null // active dollar-quote tag like '$$' or '$tag$'
  let inSingle = false
  let inLineComment = false
  let inBlockComment = false

  while (i < len) {
    const c = sql[i]!
    const c2 = i + 1 < len ? sql.substring(i, i + 2) : ''

    if (inLineComment) {
      buf += c
      if (c === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      buf += c
      if (c2 === '*/') {
        buf += '/'
        i += 2
        inBlockComment = false
        continue
      }
      i++
      continue
    }
    if (inDollar) {
      // Look for the matching closing tag
      if (sql.startsWith(inDollar, i)) {
        buf += inDollar
        i += inDollar.length
        inDollar = null
        continue
      }
      buf += c
      i++
      continue
    }
    if (inSingle) {
      buf += c
      // '' is an escaped single quote inside a string
      if (c === "'" && sql[i + 1] === "'") {
        buf += "'"
        i += 2
        continue
      }
      if (c === "'") {
        inSingle = false
      }
      i++
      continue
    }

    // Not inside anything special — check for opening contexts
    if (c2 === '--') {
      inLineComment = true
      buf += c2
      i += 2
      continue
    }
    if (c2 === '/*') {
      inBlockComment = true
      buf += c2
      i += 2
      continue
    }
    if (c === "'") {
      inSingle = true
      buf += c
      i++
      continue
    }
    if (c === '$') {
      // Match an opening dollar-quote tag: $$, $tag$, $foo$
      const m = /^\$(\w*)\$/.exec(sql.substring(i))
      if (m) {
        inDollar = m[0]
        buf += m[0]
        i += m[0].length
        continue
      }
    }
    if (c === ';') {
      // Statement boundary
      const trimmed = buf.trim()
      if (trimmed) out.push(trimmed)
      buf = ''
      i++
      continue
    }

    buf += c
    i++
  }

  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}
