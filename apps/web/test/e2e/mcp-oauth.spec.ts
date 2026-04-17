import { createHash, createHmac, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

type PrismaModule = typeof import('@customerEQ/database')

loadEnv(resolve(process.cwd(), '.env.local'))

process.env.DATABASE_URL ??= 'postgresql://customereq:customereq@localhost:5432/customereq'

const TEST_USER_ID = 'playwright-mcp-user'
const TEST_BRAND_ID = process.env.PLAYWRIGHT_MCP_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'
const CLIENT_ID = 'antigravity-local'
const REDIRECT_URI = 'cursor://anysphere.cursor-mcp/oauth/callback'
const STATE_SECRET = process.env.MCP_OAUTH_STATE_SECRET ?? 'dev-insecure-mcp-state-secret'

let prismaModule: PrismaModule | null = null

test.describe.configure({ mode: 'serial' })

test.describe('MCP OAuth flow', () => {
  test.beforeAll(async () => {
    prismaModule = await import('@customerEQ/database')

    const brand = await prismaModule.prisma.brand.findUnique({
      where: { id: TEST_BRAND_ID },
      select: { id: true },
    })

    if (!brand) {
      throw new Error(`Missing MCP test brand ${TEST_BRAND_ID}. Set PLAYWRIGHT_MCP_BRAND_ID to a valid local brand.`)
    }
  })

  test.afterAll(async () => {
    if (!prismaModule) return

    await prismaModule.prisma.apiKey.deleteMany({
      where: {
        createdBy: TEST_USER_ID,
        name: {
          startsWith: 'MCP OAuth',
        },
      },
    })

    await prismaModule.prisma.mcpOAuthCode.deleteMany({
      where: {
        clerkUserId: TEST_USER_ID,
      },
    })

    await prismaModule.prisma.$disconnect()
  })

  test('publishes OAuth metadata, auth challenge, and client registration contract', async ({ request, baseURL }) => {
    const metadataResponse = await request.get('/.well-known/oauth-authorization-server')
    expect(metadataResponse.ok()).toBeTruthy()

    const metadata = await metadataResponse.json()
    expect(metadata).toMatchObject({
      issuer: baseURL,
      authorization_endpoint: `${baseURL}/mcp/authorize`,
      token_endpoint: `${baseURL}/mcp/token`,
      registration_endpoint: `${baseURL}/mcp/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      scopes_supported: ['mcp'],
    })

    const protectedResourceResponse = await request.get('/.well-known/oauth-protected-resource/mcp')
    expect(protectedResourceResponse.ok()).toBeTruthy()
    await expect(protectedResourceResponse.json()).resolves.toEqual({
      resource: `${baseURL}/api/mcp`,
      authorization_servers: [baseURL],
    })

    const unauthenticatedMcpResponse = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      },
    })

    expect(unauthenticatedMcpResponse.status()).toBe(401)
    expect(unauthenticatedMcpResponse.headers()['www-authenticate']).toContain(
      `resource_metadata="${baseURL}/.well-known/oauth-protected-resource/mcp"`,
    )

    const registrationResponse = await request.post('/mcp/register', {
      data: {
        client_name: 'Playwright MCP',
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
    })

    expect(registrationResponse.ok()).toBeTruthy()
    await expect(registrationResponse.json()).resolves.toMatchObject({
      client_id: CLIENT_ID,
      client_name: 'Playwright MCP',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
  })

  test('completes callback handoff, exchanges token, and calls authenticated MCP', async ({ request, baseURL }) => {
    const state = randomUUID()
    const verifier = `verifier-${randomUUID()}`
    const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url')
    const signedData = signCallbackData({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ts: Date.now(),
    })

    const authorizeResponse = await request.get(
      `/mcp/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(state)}&resource=${encodeURIComponent(`${baseURL}/api/mcp`)}&scope=mcp`,
      { maxRedirects: 0 },
    )

    expect(authorizeResponse.status()).toBe(307)
    expect(authorizeResponse.headers().location).toContain('/sign-in?redirect_url=')

    const callbackResponse = await request.get(`/api/mcp/callback?data=${encodeURIComponent(signedData)}`, {
      headers: {
        'x-playwright-test-user-id': TEST_USER_ID,
        'x-playwright-test-brand-id': TEST_BRAND_ID,
      },
    })

    expect(callbackResponse.status()).toBe(200)
    expect(callbackResponse.headers()['content-type']).toContain('text/html')

    const callbackHtml = await callbackResponse.text()
    expect(callbackHtml).toContain('Authentication complete')
    expect(callbackHtml).toContain('Return to your MCP client')

    const callbackUrl = extractCallbackUrl(callbackHtml)
    const parsedCallbackUrl = new URL(callbackUrl)
    const code = parsedCallbackUrl.searchParams.get('code')

    expect(parsedCallbackUrl.protocol).toBe('cursor:')
    expect(parsedCallbackUrl.searchParams.get('state')).toBe(state)
    expect(code).toBeTruthy()

    const tokenResponse = await request.post('/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        code: code!,
        code_verifier: verifier,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
      },
    })

    expect(tokenResponse.status()).toBe(200)
    const tokenPayload = await tokenResponse.json()
    expect(tokenPayload.token_type).toBe('Bearer')
    expect(tokenPayload.scope).toBe('mcp')
    expect(tokenPayload.access_token).toMatch(/^ceq_mcp_/)

    const reusedCodeResponse = await request.post('/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        code: code!,
        code_verifier: verifier,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
      },
    })

    expect(reusedCodeResponse.status()).toBe(400)
    await expect(reusedCodeResponse.json()).resolves.toMatchObject({
      error: 'invalid_grant',
    })

    const mcpResponse = await request.post('/api/mcp', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token as string}`,
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      },
    })

    expect(mcpResponse.status()).toBe(200)
    const mcpPayload = await mcpResponse.json()
    const tools = mcpPayload?.result?.tools

    expect(Array.isArray(tools)).toBeTruthy()
    expect(tools.length).toBeGreaterThan(0)
    expect(tools[0].securitySchemes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'oauth2',
          scopes: ['mcp'],
        }),
      ]),
    )
  })
})

function signCallbackData(payload: Record<string, unknown>) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
  const signature = createHmac('sha256', STATE_SECRET).update(payloadB64).digest('base64url')
  return `${payloadB64}.${signature}`
}

function extractCallbackUrl(html: string) {
  const match = html.match(/<a href="([^"]+)"/i)
  if (!match) {
    throw new Error('Missing callback link in MCP callback page')
  }

  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return

  const contents = readFileSync(filePath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}
