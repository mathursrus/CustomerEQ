import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerCampaignTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // List campaigns
  server.tool(
    'list_campaigns',
    'List all campaigns for the brand with status, trigger type, and budget info.',
    {},
    async () => {
      const res = await fetch('/v1/campaigns')
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Create campaign
  server.tool(
    'create_campaign',
    'Create a new loyalty campaign with trigger conditions and reward actions. Starts in DRAFT status.',
    z.object({
      name: z.string().describe('Campaign name'),
      programId: z.string().describe('Loyalty program ID'),
      triggerType: z.string().describe('Event type to trigger on, e.g. cx.nps_response'),
      triggerCondition: z.object({
        field: z.string().describe('Payload field to evaluate, e.g. nps_score'),
        operator: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains']).describe('Comparison operator'),
        value: z.union([z.string(), z.number()]).describe('Value to compare against'),
      }).describe('Condition that triggers the campaign'),
      actionType: z.string().default('award_points').describe('Action type'),
      actionConfig: z.object({
        points: z.number().int().positive().describe('Points to award'),
        message: z.string().optional().describe('Notification message'),
      }).describe('Action configuration'),
      budgetCap: z.number().optional().describe('Maximum points budget'),
      startDate: z.string().optional().describe('Campaign start date (ISO)'),
      endDate: z.string().optional().describe('Campaign end date (ISO)'),
    }).shape,
    async (params) => {
      const res = await fetch('/v1/campaigns', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Campaign created: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Update campaign status
  server.tool(
    'update_campaign_status',
    'Activate, pause, or close a campaign.',
    z.object({
      campaignId: z.string().describe('Campaign ID'),
      status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).describe('New status'),
    }).shape,
    async ({ campaignId, status }) => {
      const res = await fetch(`/v1/campaigns/${campaignId}/status`, { method: 'PATCH', body: { status } })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Campaign updated: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )
}
