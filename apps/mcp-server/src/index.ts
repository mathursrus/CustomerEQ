#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerSurveyTools } from './tools/surveys.js'
import { registerAnalyticsTools } from './tools/analytics.js'
import { registerEventTools } from './tools/events.js'
import { registerCampaignTools } from './tools/campaigns.js'
import { registerMemberTools } from './tools/members.js'
import { registerProgramTools } from './tools/programs.js'
import { registerKBTools } from './tools/kb.js'
import { registerSupportTools } from './tools/support.js'

const server = new McpServer({
  name: 'CustomerEQ',
  version: '0.1.0',
  description: 'CustomerEQ CX-to-Loyalty platform — manage surveys, analyze feedback, run loyalty campaigns',
})

// Register all tool domains
registerSurveyTools(server)
registerAnalyticsTools(server)
registerEventTools(server)
registerCampaignTools(server)
registerMemberTools(server)
registerProgramTools(server)
registerKBTools(server)
registerSupportTools(server)

// Start server on stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)
