/**
 * HTTP MCP endpoint  — /api/mcp
 *
 * This is the URL MCP clients call to execute tools after completing OAuth.
 * Authentication: Bearer <ceq_mcp_…> token issued by /mcp/token.
 *
 * Stateless design: each request creates a fresh MCP server + transport and
 * tears it down after the response, which is safe for serverless / edge
 * deployments and avoids in-memory session state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { prisma } from '@customerEQ/database'
import { createApiClient } from '@customerEQ/mcp-server/api-client'
import { createMcpServer } from '@customerEQ/mcp-server/server-factory'

// ─── CORS helpers ───────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function resolveApiKey(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null

  const rawToken = auth.slice(7).trim()
  if (!rawToken) return null

  const keyHash = createHash('sha256').update(rawToken).digest('hex')

  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { brandId: true, revokedAt: true, keyPrefix: true },
  })

  if (!record || record.revokedAt) return null

  return { rawToken, brandId: record.brandId }
}

// ─── Request wrappers (attach CORS headers to every MCP response) ───────────

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * POST  /api/mcp  — JSON-RPC tool calls
 * GET   /api/mcp  — SSE stream (long-running responses)
 * DELETE /api/mcp — terminate a session
 */
async function handleMcp(req: NextRequest): Promise<Response> {
  const key = await resolveApiKey(req)
  if (!key) {
    return NextResponse.json(
      { error: 'Missing or invalid Bearer token' },
      { status: 401, headers: CORS_HEADERS },
    )
  }

  // Brand-scoped fetch: every tool call hits the API with this key in X-Api-Key
  const brandFetch = createApiClient({
    baseUrl: process.env.CUSTOMEREQ_API_URL,
    apiKey: key.rawToken,
  })

  // Fresh server + stateless transport for this request
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no in-memory session
    enableJsonResponse: false,     // prefer SSE for streaming tool output
  })

  const server = createMcpServer(brandFetch)
  await server.connect(transport)

  const response = await transport.handleRequest(req)
  await server.close()

  return withCors(response)
}

export const GET = handleMcp
export const POST = handleMcp
export const DELETE = handleMcp
