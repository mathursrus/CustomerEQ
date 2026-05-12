import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

export function registerSurveyTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // List surveys
  server.tool(
    'list_surveys',
    'List all surveys for the brand. Returns survey names, types, statuses, and response counts.',
    {},
    async () => {
      const res = await fetch('/v1/surveys')
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Create survey
  const CreateSurveySchema = z.object({
    name: z.string().describe('Survey name'),
    programId: z.string().describe('ID of the loyalty program'),
    type: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']).describe('Survey type'),
    questions: z.array(z.object({
      id: z.string(),
      text: z.string(),
      type: z.enum(['rating', 'text']),
      required: z.boolean().default(true),
    })).describe('Survey questions'),
  })

  server.tool(
    'create_survey',
    'Create a new survey. Starts in DRAFT status. Must activate before responses can be submitted.',
    CreateSurveySchema.shape,
    async (params) => {
      const res = await fetch('/v1/surveys', { method: 'POST', body: params })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Survey created: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )

  // Get survey detail
  server.tool(
    'get_survey',
    'Get survey details including response stats, recent responses with sentiment and topics.',
    z.object({ surveyId: z.string().describe('Survey ID') }).shape,
    async ({ surveyId }) => {
      const res = await fetch(`/v1/surveys/${surveyId}`)
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Update survey status
  server.tool(
    'update_survey_status',
    'Activate, pause, or close a survey. Valid transitions: DRAFT->ACTIVE, ACTIVE->PAUSED, ACTIVE->CLOSED, PAUSED->ACTIVE, PAUSED->CLOSED.',
    z.object({
      surveyId: z.string().describe('Survey ID'),
      status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED']).describe('New status'),
    }).shape,
    async ({ surveyId, status }) => {
      const res = await fetch(`/v1/surveys/${surveyId}/status`, { method: 'PATCH', body: { status } })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: `Survey updated: ${JSON.stringify(res.data, null, 2)}` }] }
    },
  )
}
