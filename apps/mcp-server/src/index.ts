#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server-factory.js'

const server = createMcpServer()

// Start server on stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)
