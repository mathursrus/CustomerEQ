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
    'Get full member details including email, status, consent, and points balance.',
    z.object({
      memberId: z.string().describe('Member ID'),
    }).shape,
    async ({ memberId }) => {
      const res = await apiFetch(`/v1/members/${memberId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Get Customer 360 view (Issue #98)
  server.tool(
    'get_customer_360',
    'Get a comprehensive Customer 360 view including profile, loyalty events, survey responses, ' +
    'redemptions, campaign events, open cases, and summary statistics.',
    z.object({
      memberId: z.string().describe('Member ID'),
      eventsLimit: z.number().int().min(1).max(100).default(20).optional()
        .describe('Max recent events to return (default: 20)'),
      surveysLimit: z.number().int().min(1).max(50).default(10).optional()
        .describe('Max survey responses to return (default: 10)'),
    }).shape,
    async (params) => {
      const queryParams: Record<string, string> = {}
      if (params.eventsLimit) queryParams.eventsLimit = String(params.eventsLimit)
      if (params.surveysLimit) queryParams.surveysLimit = String(params.surveysLimit)

      const res = await apiFetch(`/v1/members/${params.memberId}/360`, { params: queryParams })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }

      const data = res.data as Record<string, unknown>
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        }],
      }
    },
  )

  // Search members (Issue #98)
  server.tool(
    'search_members',
    'Search for loyalty program members by name, email, or behavioral filters (tier, sentiment, ' +
    'NPS score, points balance, status, enrollment date).',
    z.object({
      q: z.string().optional().describe('Text search across name and email'),
      tier: z.string().optional().describe('Filter by tier name'),
      sentimentMin: z.number().min(-1).max(1).optional().describe('Min sentiment (-1.0 to 1.0)'),
      sentimentMax: z.number().min(-1).max(1).optional().describe('Max sentiment (-1.0 to 1.0)'),
      npsMin: z.number().min(0).max(10).optional().describe('Min NPS score (0-10)'),
      npsMax: z.number().min(0).max(10).optional().describe('Max NPS score (0-10)'),
      balanceMin: z.number().int().min(0).optional().describe('Min points balance'),
      balanceMax: z.number().int().min(0).optional().describe('Max points balance'),
      status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional().describe('Member status filter'),
      page: z.number().int().min(1).default(1).optional().describe('Page number (default: 1)'),
      pageSize: z.number().int().min(1).max(100).default(20).optional().describe('Results per page (default: 20)'),
    }).shape,
    async (params) => {
      const queryParams: Record<string, string> = {}
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) queryParams[key] = String(value)
      }

      const res = await apiFetch('/v1/members', { params: queryParams })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
