import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerMemberTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // Enroll member — Issue #231 PR2 polymorphic identifier shape.
  server.tool(
    'enroll_member',
    'Enroll a new member in a loyalty program. Idempotent — re-enrolling the same identifier returns 200 with the existing member and any field updates applied.',
    z.object({
      email: z.string().email().describe('Member email — used as both the identifier and PII sidecar for EMAIL brands'),
      programId: z.string().describe('Loyalty program ID'),
      firstName: z.string().describe('First name'),
      lastName: z.string().describe('Last name'),
      phone: z.string().optional().describe('Phone number'),
    }).shape,
    async (params) => {
      const { email, ...rest } = params
      const res = await fetch('/v1/members/enroll', {
        method: 'POST',
        body: {
          ...rest,
          memberId: email,
          email,
          consentGivenAt: new Date().toISOString(),
          consentVersion: '1.0',
        },
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
      const res = await fetch(`/v1/members/${memberId}/balance`)
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
      const res = await fetch(`/v1/members/${memberId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Get Customer 360 view with health score breakdown
  server.tool(
    'get_member_360',
    'Get a comprehensive Customer 360 view including profile, health score breakdown, loyalty events, ' +
    'survey responses, redemptions, campaign events, open cases (alert-rule escalations), ' +
    'open support conversations (chat tickets), and summary statistics.',
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

      const res = await fetch(`/v1/members/${params.memberId}/360`, { params: queryParams })
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
    'NPS score, points balance, health score, status, enrollment date).',
    z.object({
      q: z.string().optional().describe('Text search across name and email'),
      tier: z.string().optional().describe('Filter by tier name'),
      sentimentMin: z.number().min(-1).max(1).optional().describe('Min sentiment (-1.0 to 1.0)'),
      sentimentMax: z.number().min(-1).max(1).optional().describe('Max sentiment (-1.0 to 1.0)'),
      npsMin: z.number().min(0).max(10).optional().describe('Min NPS score (0-10)'),
      npsMax: z.number().min(0).max(10).optional().describe('Max NPS score (0-10)'),
      balanceMin: z.number().int().min(0).optional().describe('Min points balance'),
      balanceMax: z.number().int().min(0).optional().describe('Max points balance'),
      healthScoreMin: z.number().int().min(0).max(100).optional().describe('Min health score (0-100)'),
      healthScoreMax: z.number().int().min(0).max(100).optional().describe('Max health score (0-100)'),
      status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional().describe('Member status filter'),
      page: z.number().int().min(1).default(1).optional().describe('Page number (default: 1)'),
      pageSize: z.number().int().min(1).max(100).default(20).optional().describe('Results per page (default: 20)'),
    }).shape,
    async (params) => {
      const queryParams: Record<string, string> = {}
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) queryParams[key] = String(value)
      }

      const res = await fetch('/v1/members', { params: queryParams })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // List CRM notes on a customer
  server.tool(
    'list_customer_notes',
    'List CRM-style notes recorded against a customer (most recent first). Notes capture calls, emails, meetings, escalations, and free-form context.',
    z.object({
      memberId: z.string().describe('Customer / member ID'),
    }).shape,
    async ({ memberId }) => {
      const res = await fetch(`/v1/members/${memberId}/notes`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Add a CRM note to a customer
  server.tool(
    'add_customer_note',
    'Add a CRM-style note to a customer record. Append-only audit trail — notes cannot be edited or deleted once recorded. Use for call summaries, action taken, context, or follow-up reminders.',
    z.object({
      memberId: z.string().describe('Customer / member ID'),
      body: z.string().min(1).max(4000).describe('Note text (max 4000 chars)'),
      category: z.enum(['call', 'email', 'meeting', 'note', 'escalation', 'win-back']).optional()
        .describe('Note category (default: note)'),
      sentiment: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']).optional()
        .describe('Rep-tagged customer sentiment. If set, overrides automated health score signals. Use very_negative for churn risk, very_positive for advocates. Leave unset if uncertain.'),
      author: z.string().optional().describe('Author name or email (defaults to the authenticated caller)'),
    }).shape,
    async (params) => {
      const res = await fetch(`/v1/members/${params.memberId}/notes`, {
        method: 'POST',
        body: {
          body: params.body,
          category: params.category,
          sentiment: params.sentiment,
          author: params.author,
        },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Note added: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Update an existing CRM note
  server.tool(
    'update_customer_note',
    'Edit an existing customer note (body, category, and/or sentiment). Pass sentiment as null to clear a rep-tag (which will remove the note modifier from the customer health score).',
    z.object({
      memberId: z.string().describe('Customer / member ID'),
      noteId: z.string().describe('Note ID'),
      body: z.string().min(1).max(4000).optional().describe('New note text'),
      category: z.enum(['call', 'email', 'meeting', 'note', 'escalation', 'win-back']).nullable().optional()
        .describe('New category, or null to clear'),
      sentiment: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']).nullable().optional()
        .describe('New sentiment tag, or null to clear. Changing sentiment triggers a health-score recompute.'),
    }).shape,
    async (params) => {
      const body: Record<string, unknown> = {}
      if (params.body !== undefined) body.body = params.body
      if (params.category !== undefined) body.category = params.category
      if (params.sentiment !== undefined) body.sentiment = params.sentiment
      const res = await fetch(`/v1/members/${params.memberId}/notes/${params.noteId}`, {
        method: 'PATCH',
        body,
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Note updated: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Delete a CRM note
  server.tool(
    'delete_customer_note',
    'Delete a customer note by ID. If the note carried a sentiment tag, the customer health score will recompute — the next-most-recent tagged note (or none) will drive the modifier instead.',
    z.object({
      memberId: z.string().describe('Customer / member ID'),
      noteId: z.string().describe('Note ID to delete'),
    }).shape,
    async (params) => {
      const res = await fetch(`/v1/members/${params.memberId}/notes/${params.noteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Note ${params.noteId} deleted.` }] }
    },
  )
}
