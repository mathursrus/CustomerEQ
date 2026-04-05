import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'

export function registerSupportTools(server: McpServer) {
  // List support conversations (tickets)
  server.tool(
    'list_support_conversations',
    'List support conversations (chat tickets). Filter by status (ACTIVE, WAITING_ON_CUSTOMER, ESCALATED, RESOLVED, CLOSED). Each conversation is a customer support ticket with AI + agent messages.',
    z.object({
      status: z.enum(['ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED']).optional()
        .describe('Filter by conversation status'),
      page: z.number().int().min(1).default(1).optional().describe('Page number (default: 1)'),
      pageSize: z.number().int().min(1).max(100).default(25).optional().describe('Results per page (default: 25)'),
    }).shape,
    async (params) => {
      const queryParams: Record<string, string> = {}
      if (params.status) queryParams.status = params.status
      if (params.page) queryParams.page = String(params.page)
      if (params.pageSize) queryParams.pageSize = String(params.pageSize)
      const res = await apiFetch('/v1/support/conversations', { params: queryParams })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Get support conversation detail (with messages)
  server.tool(
    'get_support_conversation',
    'Get full conversation detail including member info and all messages (customer, AI, and agent turns).',
    z.object({
      conversationId: z.string().describe('Conversation ID'),
    }).shape,
    async ({ conversationId }) => {
      const res = await apiFetch(`/v1/support/conversations/${conversationId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Update conversation status (resolve, close, escalate, reassign)
  server.tool(
    'update_conversation_status',
    'Update a support conversation: change status (ACTIVE/WAITING_ON_CUSTOMER/ESCALATED/RESOLVED/CLOSED) and optionally reassign. Escalation/resolution/closure timestamps are set automatically.',
    z.object({
      conversationId: z.string().describe('Conversation ID'),
      status: z.enum(['ACTIVE', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'])
        .describe('New status'),
      assignee: z.string().optional().describe('Human agent email (for escalation/reassignment)'),
    }).shape,
    async ({ conversationId, status, assignee }) => {
      const res = await apiFetch(`/v1/support/conversations/${conversationId}`, {
        method: 'PATCH',
        body: { status, ...(assignee ? { assignee } : {}) },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Conversation updated: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Send an agent message in a conversation
  server.tool(
    'send_support_message',
    'Post an agent message into a support conversation. The message is recorded with role=AGENT.',
    z.object({
      conversationId: z.string().describe('Conversation ID'),
      content: z.string().min(1).describe('Message text to send to the customer'),
    }).shape,
    async ({ conversationId, content }) => {
      const res = await apiFetch(`/v1/support/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content },
      })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Message sent: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )
}
