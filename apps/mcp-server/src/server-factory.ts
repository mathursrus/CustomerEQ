import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiFetch } from './api-client.js'
import { apiFetch } from './api-client.js'
import { registerSurveyTools } from './tools/surveys.js'
import { registerAnalyticsTools } from './tools/analytics.js'
import { registerEventTools } from './tools/events.js'
import { registerCampaignTools } from './tools/campaigns.js'
import { registerMemberTools } from './tools/members.js'
import { registerProgramTools } from './tools/programs.js'
import { registerKBTools } from './tools/kb.js'
import { registerSupportTools } from './tools/support.js'

/**
 * Creates and configures a fully-loaded MCP server instance.
 *
 * Accepts an optional `fetch` override so the HTTP OAuth route can inject
 * a brand-scoped API client (derived from the Bearer token), while the
 * stdio entry point keeps using the env-var singleton.
 */
export function createMcpServer(fetch: ApiFetch = apiFetch): McpServer {
  const server = new McpServer({
    name: 'CustomerEQ',
    version: '0.1.0',
    description: 'CustomerEQ CX-to-Loyalty platform — manage surveys, analyze feedback, run loyalty campaigns',
  })

  registerSurveyTools(server, fetch)
  registerAnalyticsTools(server, fetch)
  registerEventTools(server, fetch)
  registerCampaignTools(server, fetch)
  registerMemberTools(server, fetch)
  registerProgramTools(server, fetch)
  registerKBTools(server, fetch)
  registerSupportTools(server, fetch)

  return server
}
