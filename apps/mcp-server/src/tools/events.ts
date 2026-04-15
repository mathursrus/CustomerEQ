import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerEventTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // Ingest event
  server.tool(
    'ingest_event',
    'Ingest a CX event into the loyalty pipeline. Triggers campaign evaluation and may award points.',
    z.object({
      eventType: z.string().describe('Event type, e.g. cx.nps_submitted, cx.purchase_completed'),
      memberId: z.string().describe('Member ID'),
      payload: z.record(z.unknown()).describe('Event payload (e.g. { nps_score: 9, comment: "..." })'),
      idempotencyKey: z.string().optional().describe('Unique key to prevent duplicate processing'),
    }).shape,
    async (params) => {
      const res = await fetch('/v1/events', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // List recent events
  server.tool(
    'list_events',
    'List recent loyalty events (last 50). Shows event types, points earned, and timestamps.',
    {},
    async () => {
      const res = await fetch('/v1/events')
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
