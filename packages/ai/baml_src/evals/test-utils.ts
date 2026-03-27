/**
 * BAML Eval Test Utilities
 *
 * Shared setup for all BAML eval tests. Import this at the top of every eval file.
 * Handles: env loading, BAML log level, API key validation, tag filtering.
 *
 * Usage:
 *   import { ensureApiKey, bamlTags } from './test-utils.js'
 *   ensureApiKey()
 *
 * Following the Ashley-Calendar-AI pattern:
 *   - setLogLevel() for BAML client logging
 *   - Hard fail on missing API keys (never skip)
 *   - Tag-based test filtering via TAGS/EXCLUDE_TAGS env vars
 */

import * as dotenv from 'dotenv'
dotenv.config({ override: true })

import { setLogLevel } from '../../src/generated/baml_client/config.js'

// ─── BAML Logging ────────────────────────────────────────────────────────────

// Set BAML log level from env, default to 'info'
// Options: 'debug' | 'info' | 'warn' | 'error' | 'verbose'
const logLevel = (process.env.BAML_LOG_LEVEL ?? 'info') as Parameters<typeof setLogLevel>[0]
setLogLevel(logLevel)

// ─── API Key Validation ──────────────────────────────────────────────────────

/**
 * Fail hard if no LLM API key is available.
 * Call at the top of every eval test file.
 * Never skip — a green suite means everything was verified.
 */
export function ensureApiKey(): void {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'BAML eval tests require OPENAI_API_KEY or ANTHROPIC_API_KEY.\n' +
      'These tests call real LLMs and must never be skipped.\n' +
      'Set the key in .env or environment before running pnpm test:baml.'
    )
  }
}

// ─── Tags ────────────────────────────────────────────────────────────────────

/**
 * Standard tags for BAML eval tests.
 * Use in test metadata or describe names for filtering.
 *
 * Filter via env: TAGS=baml,smoke pnpm test:baml
 * Exclude via env: EXCLUDE_TAGS=flaky pnpm test:baml
 */
export const bamlTags = {
  baml: 'baml',
  smoke: 'smoke',
  flaky: 'flaky',
  slow: 'slow',
} as const

/**
 * Check if the current test run should include a given tag.
 * Reads TAGS and EXCLUDE_TAGS from environment.
 */
export function shouldRunTag(tag: string): boolean {
  const includeTags = process.env.TAGS?.split(',').map(t => t.trim()) ?? []
  const excludeTags = process.env.EXCLUDE_TAGS?.split(',').map(t => t.trim()) ?? []

  if (excludeTags.includes(tag)) return false
  if (includeTags.length > 0 && !includeTags.includes(tag)) return false
  return true
}

// ─── Test Timeouts ───────────────────────────────────────────────────────────

/** Default timeout for LLM calls (30s) */
export const LLM_TIMEOUT = 30_000

/** Extended timeout for batch LLM calls (60s) */
export const BATCH_LLM_TIMEOUT = 60_000

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { b } from '../../src/generated/baml_client/index.js'
export { setLogLevel }
