import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'
import { prisma } from '@customerEQ/database'
import { type KBIngestionPayload, chunkArticleBody } from '@customerEQ/shared'
import { rebuildArticleChunks } from '@customerEQ/ai/src/kb/chunks.js'

const logger = pino({ name: 'kb-ingestion' })

const CHUNK_TARGET_TOKENS = 500
const CHUNK_OVERLAP_TOKENS = 100

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createKbIngestionProcessor(_connection: ConnectionOptions) {
  return (job: Job<KBIngestionPayload>) => processKbIngestion(job)
}

export async function processKbIngestion(job: Job<KBIngestionPayload>): Promise<void> {
  const { sourceId, brandId } = job.data

  const source = await prisma.kBSource.findUniqueOrThrow({ where: { id: sourceId } })

  if (source.brandId !== brandId) {
    throw new Error(`tenant mismatch: source.brandId=${source.brandId} job.brandId=${brandId}`)
  }

  if (source.kind === 'MANUAL') {
    logger.warn({ sourceId }, 'MANUAL source — no crawl needed; skipping')
    return
  }

  if (!source.url) {
    throw new Error(`source ${sourceId} has no url`)
  }

  try {
    const urls =
      source.kind === 'SITEMAP'
        ? await fetchSitemapUrls(source.url)
        : [source.url]

    // For SITEMAP sources, log per-URL failures and continue so one bad URL
    // doesn't abort the whole crawl. For single-URL sources, let errors
    // propagate so they are captured in lastErrorMessage and re-thrown.
    const isSingleUrl = urls.length === 1
    for (const url of urls) {
      if (isSingleUrl) {
        await ingestUrl({ url, source: { id: source.id, brandId: source.brandId } })
      } else {
        try {
          await ingestUrl({ url, source: { id: source.id, brandId: source.brandId } })
        } catch (err) {
          logger.error({ err, url }, 'failed to ingest URL — continuing with remaining URLs')
        }
      }
    }

    await prisma.kBSource.update({
      where: { id: sourceId },
      data: { lastCrawledAt: new Date(), lastErrorMessage: null },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.kBSource.update({
      where: { id: sourceId },
      data: { lastErrorMessage: msg.slice(0, 500) },
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function ingestUrl(args: { url: string; source: { id: string; brandId: string } }): Promise<void> {
  const { url, source } = args

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`fetch ${url} returned ${res.status}`)
  }

  const html = await res.text()
  const { title, body } = extractArticle(html, url)

  if (!body.trim()) {
    logger.warn({ url }, 'extracted empty body — skipping')
    return
  }

  const contentHash = createHash('sha256').update(body).digest('hex')

  const existing = await prisma.kBArticle.findFirst({
    where: { brandId: source.brandId, sourceUrl: url },
  })

  if (existing?.contentHash === contentHash) {
    logger.info({ url, articleId: existing.id }, 'contentHash unchanged — skipping re-embed')
    return
  }

  if (existing) {
    // Update existing article body + replace chunks.
    await prisma.kBArticle.update({
      where: { id: existing.id },
      data: { title, body, contentHash, publishedAt: new Date(), archivedAt: null },
    })
    await rebuildArticleChunks(existing.id, source.brandId, body)
  } else {
    const article = await prisma.kBArticle.create({
      data: {
        brandId: source.brandId,
        sourceId: source.id,
        sourceUrl: url,
        title,
        body,
        contentHash,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    await rebuildArticleChunks(article.id, source.brandId, body)
  }
}

function extractArticle(html: string, url: string): { title: string; body: string } {
  // Try Mozilla Readability first — best quality for article content.
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const parsed = reader.parse()
    if (parsed?.textContent && parsed.title) {
      return { title: parsed.title.slice(0, 200), body: parsed.textContent.trim() }
    }
  } catch {
    // fall through to cheerio
  }

  // Fallback: crude cheerio extraction.
  const $ = cheerio.load(html)
  return {
    title: ($('title').text() || url).slice(0, 200),
    body: $('main, article, body').first().text().trim().slice(0, 50_000),
  }
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl)
  if (!res.ok) {
    throw new Error(`fetch sitemap ${sitemapUrl} returned ${res.status}`)
  }
  const xml = await res.text()
  const $ = cheerio.load(xml, { xmlMode: true })
  return $('url > loc, sitemap > loc')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
}
