import { NextResponse, type NextRequest } from 'next/server'

/**
 * POST /mcp/register
 * 
 * Dynamic Client Registration (RFC 7591)
 * 
 * This endpoint allows the MCP client to register itself dynamically.
 * For local development, we return a static client_id and ignore other params.
 */
export async function POST(req: NextRequest) {
  try {
    // Dynamic client registration clients often validate the response against
    // the metadata they sent, so echo back key fields like redirect_uris.
    const body = (await req.json().catch(() => ({}))) as {
      client_name?: string
      redirect_uris?: unknown
      grant_types?: unknown
      response_types?: unknown
      token_endpoint_auth_method?: string
    }

    const clientName = body.client_name || 'Antigravity'
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((value): value is string => typeof value === 'string')
      : []
    const grantTypes = Array.isArray(body.grant_types)
      ? body.grant_types.filter((value): value is string => typeof value === 'string')
      : ['authorization_code']
    const responseTypes = Array.isArray(body.response_types)
      ? body.response_types.filter((value): value is string => typeof value === 'string')
      : ['code']

    return NextResponse.json({
      client_id: 'antigravity-local',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: body.token_endpoint_auth_method || 'none',
    })
  } catch (error) {
    console.error('[MCP/Register] Registration failed:', error)
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Failed to process registration request' },
      { status: 400 }
    )
  }
}
