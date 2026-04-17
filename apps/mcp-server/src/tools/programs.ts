import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerProgramTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // List programs
  server.tool(
    'list_programs',
    'List all loyalty programs for the brand.',
    {},
    async () => {
      const res = await fetch('/v1/programs')
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Create program
  server.tool(
    'create_program',
    'Create a new loyalty program with point currency settings.',
    z.object({
      name: z.string().describe('Program name'),
      description: z.string().optional().describe('Program description'),
      pointCurrencyName: z.string().default('Points').describe('Name of the point currency'),
      pointToCurrencyRatio: z.number().default(0.01).describe('Value of 1 point in dollars'),
    }).shape,
    async (params) => {
      const res = await fetch('/v1/programs', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Program created: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Get program details
  server.tool(
    'get_program',
    'Get program details including earning rules.',
    z.object({ programId: z.string().describe('Program ID') }).shape,
    async ({ programId }) => {
      const res = await fetch(`/v1/programs/${programId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
