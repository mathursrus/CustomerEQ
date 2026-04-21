import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerKBTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // search_kb — Search knowledge base articles by natural language query
  server.tool(
    'search_kb',
    'Search knowledge base articles by natural language query. Returns ranked results by semantic relevance.',
    z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().default(5).describe('Max results (default 5)'),
    }).shape,
    async ({ query, limit }) => {
      const res = await fetch('/v1/kb/search', {
        params: { q: query, limit: String(limit ?? 5) },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // create_kb_article — Create a new knowledge base article
  server.tool(
    'create_kb_article',
    'Create a new knowledge base article. Embedding is generated automatically.',
    z.object({
      title: z.string().describe('Article title'),
      body: z.string().describe('Article body in Markdown'),
      category: z.enum(['FAQ', 'POLICY', 'TROUBLESHOOTING', 'PRODUCT_GUIDE', 'PROCESS', 'OTHER'])
        .default('FAQ').describe('Article category'),
      tags: z.array(z.string()).default([]).describe('Tags for the article'),
    }).shape,
    async (params) => {
      const res = await fetch('/v1/kb/articles', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Article created: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // classify_intent — Classify customer message intent
  server.tool(
    'classify_intent',
    'Classify a customer message into an intent category with confidence score, urgency, and suggested KB articles.',
    z.object({
      message: z.string().describe('Customer message to classify'),
    }).shape,
    async ({ message }) => {
      const res = await fetch('/v1/classify-intent', {
        method: 'POST',
        body: { text: message },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
