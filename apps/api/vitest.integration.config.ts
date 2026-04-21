import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vitest/config'

// Load the repo-root .env so DATABASE_URL / REDIS_URL are set when running
// integration tests locally without an explicit shell export. CI passes
// these via the environment directly, so a missing .env file is a no-op.
function loadRootEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../..', '.env')
  if (!fs.existsSync(envPath)) return {}
  const out: Record<string, string> = {}
  const text = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const rootEnv = loadRootEnv()

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    teardownTimeout: 10000,
    pool: 'forks',
    // Standard dotenv precedence: shell env wins. `.env` only fills in
    // values the shell didn't set, so contributors with an existing
    // `export DATABASE_URL=…` workflow (direnv, .envrc, manual export)
    // are not silently overridden by a stale `.env` value.
    env: {
      NODE_ENV: 'test',
      ...(!process.env.DATABASE_URL && rootEnv.DATABASE_URL ? { DATABASE_URL: rootEnv.DATABASE_URL } : {}),
      ...(!process.env.REDIS_URL && rootEnv.REDIS_URL ? { REDIS_URL: rootEnv.REDIS_URL } : {}),
      ...(!process.env.CLERK_SECRET_KEY && rootEnv.CLERK_SECRET_KEY ? { CLERK_SECRET_KEY: rootEnv.CLERK_SECRET_KEY } : {}),
    },
  },
})
