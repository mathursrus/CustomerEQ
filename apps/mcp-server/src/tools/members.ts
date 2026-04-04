import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'

export function registerMemberTools(server: McpServer) {
  // Enroll member
  server.tool(
    'enroll_member',
    'Enroll a new member in a loyalty program. Idempotent — returns existing member if email already enrolled.',
    z.object({
      email: z.string().email().describe('Member email address'),
      programId: z.string().describe('Loyalty program ID'),
      firstName: z.string().describe('First name'),
      lastName: z.string().describe('Last name'),
      phone: z.string().optional().describe('Phone number'),
    }).shape,
    async (params) => {
      const res = await apiFetch('/v1/members/enroll', {
        method: 'POST',
        body: { ...params, consentGivenAt: new Date().toISOString(), consentVersion: '1.0' },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Member enrolled: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Get member balance
  server.tool(
    'get_member_balance',
    'Get a member\'s points balance and recent loyalty events.',
    z.object({
      memberId: z.string().describe('Member ID'),
    }).shape,
    async ({ memberId }) => {
      const res = await apiFetch(`/v1/members/${memberId}/balance`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Get member details
  server.tool(
    'get_member',
    'Get full member details including email, status, consent, points balance, and health score.',
    z.object({
      memberId: z.string().describe('Member ID'),
    }).shape,
    async ({ memberId }) => {
      const res = await apiFetch(`/v1/members/${memberId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Get member 360 view
  server.tool(
    'get_member_360',
    'Get full Customer 360 view including health score breakdown, recent activity, and engagement stats.',
    z.object({
      memberId: z.string().describe('Member ID'),
    }).shape,
    async ({ memberId }) => {
      const res = await apiFetch(`/v1/members/${memberId}/360`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
