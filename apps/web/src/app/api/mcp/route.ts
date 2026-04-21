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
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getPublicBaseUrl } from '@/lib/request-origin'

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
async function handleMcp(nextReq: NextRequest): Promise<Response> {
  // Always derive base from the incoming request origin so the MCP client
  // sees correct port/host in WWW-Authenticate challenges.
  const base = await getPublicBaseUrl(nextReq)
  const key = await resolveApiKey(nextReq)
  if (!key) {
    return NextResponse.json(
      { error: 'Missing or invalid Bearer token' },
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", error_description="Authentication required to access CustomerEQ"`
        }
      },
    )
  }

  // Brand-scoped fetch: every tool call hits the API with this key in X-Api-Key
  const brandFetch = createApiClient({
    baseUrl: process.env.CUSTOMEREQ_API_URL,
    apiKey: key.rawToken,
  })

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no in-memory session
      enableJsonResponse: true,      // prefer SSE for streaming tool output
    })

    const server = createMcpServer(brandFetch)

    // ─── Antigravity OAuth Hardening ──────────────────────────────────────────
    // We intercept tools/list to inject securitySchemes. This tells the IDE
    // that these tools require authentication, triggering the "Authenticate" button.
    // We cast to any to access the underlying handlers map on the Protocol class.
    const mcpServer = server as any
    const lowLevelServer = mcpServer.server as any
    const originalHandler = lowLevelServer._requestHandlers.get(ListToolsRequestSchema.shape.method.value)

    if (originalHandler) {
      lowLevelServer.setRequestHandler(ListToolsRequestSchema, async (request: any, extra: any) => {
        const result = await originalHandler(request, extra)
        return {
          ...result,
          tools: (result.tools || []).map((tool: any) => ({
            ...tool,
            securitySchemes: [
              {
                type: 'oauth2',
                scopes: ['mcp'],
              },
            ],
          })),
        }
      })
    }

    await server.connect(transport)

    const safeHeaders = new Headers()
    Array.from(nextReq.headers.entries()).forEach(([k, v]) => safeHeaders.append(k, v))

    console.log(`[MCP] ${nextReq.method} ${nextReq.url}`)

    // Next.js 15 clones the request internal stream if we use nextReq.body directly.
    // However, some fetch environments prefer a fresh Request object.
    const plainReq = new Request(nextReq.url, {
      method: nextReq.method,
      headers: safeHeaders,
      body: nextReq.method === 'GET' || nextReq.method === 'HEAD' ? undefined : nextReq.body,
      // @ts-expect-error – duplex is needed for streaming body in Node.js 18+
      duplex: 'half',
    })

    const response = await transport.handleRequest(plainReq)
    console.log(`[MCP] Response status: ${response.status}`)
    
    // In stateless mode with WebStandardStreamableHTTPServerTransport,
    // the server should be kept alive for the duration of the response
    // (especially for GET/SSE). For POST, it's safe to close after handling,
    // but the transport itself manages the connection lifecycle.
    // We add a listener to close the server when the response starts streaming 
    // or finishes, but for simplicity in stateless mode, we can often 
    // rely on GC or explicit closure in a more controlled way.
    // For now, we'll keep the server closure but ensure it's in a way that 
    // doesn't block the return.
    if (nextReq.method !== 'GET') {
      await server.close()
    } else {
      // For SSE, the server must remain active. Since this is stateless,
      // it will be cleaned up once the request ends.
    }

    return withCors(response)
  } catch (err) {
    console.error('[MCP] Route Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export const GET = handleMcp
export const POST = handleMcp
export const DELETE = handleMcp
