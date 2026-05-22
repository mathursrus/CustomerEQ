import crypto from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'

const CEQ_OAUTH_STATE_SECRET = process.env.CEQ_OAUTH_STATE_SECRET ?? 'dev-oauth-state-secret-change-me'
const CEQ_OAUTH_CALLBACK_BASE_URL = process.env.CEQ_OAUTH_CALLBACK_BASE_URL ?? process.env.API_URL ?? 'http://localhost:4000'
const CEQ_ADMIN_UI_BASE_URL = process.env.CEQ_ADMIN_UI_BASE_URL ?? 'http://localhost:3000'

const PROVIDERS: Record<string, {
  authUrl: string
  tokenUrl: string
  scopes: string
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/business.manage',
    clientIdEnv: 'CEQ_GOOGLE_CLIENT_ID',
    clientSecretEnv: 'CEQ_GOOGLE_CLIENT_SECRET',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'r_organization_social',
    clientIdEnv: 'CEQ_LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'CEQ_LINKEDIN_CLIENT_SECRET',
  },
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000

function signState(payload: Record<string, unknown>): string {
  const withTimestamp = { ...payload, iat: Date.now() }
  const data = Buffer.from(JSON.stringify(withTimestamp)).toString('base64url')
  const sig = crypto.createHmac('sha256', CEQ_OAUTH_STATE_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verifyState(state: string): Record<string, unknown> | null {
  const dotIndex = state.indexOf('.')
  if (dotIndex < 1) return null
  const data = state.slice(0, dotIndex)
  const sig = state.slice(dotIndex + 1)
  if (!sig) return null

  const expected = crypto.createHmac('sha256', CEQ_OAUTH_STATE_SECRET).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as Record<string, unknown>
    const iat = payload.iat as number | undefined
    if (!iat || Date.now() - iat > STATE_MAX_AGE_MS) return null
    return payload
  } catch {
    return null
  }
}

const oauthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/integrations/oauth/:provider/authorize (authenticated)
  fastify.get<{
    Params: { provider: string }
    Querystring: { sourceId: string }
  }>(
    '/admin/integrations/oauth/:provider/authorize',
    async (request, reply) => {
      const { provider } = request.params
      const { sourceId } = request.query as { sourceId?: string }
      const config = PROVIDERS[provider]

      if (!config) {
        return reply.status(400).send({ error: `Unsupported OAuth provider: ${provider}` })
      }

      if (!sourceId) {
        return reply.status(400).send({ error: 'sourceId query parameter is required' })
      }

      const clientId = process.env[config.clientIdEnv]
      if (!clientId) {
        return reply.status(503).send({
          error: `${config.clientIdEnv} not configured on the platform`,
        })
      }

      const source = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: sourceId, brandId: request.brandId },
        select: { id: true },
      })

      if (!source) {
        return reply.status(404).send({ error: 'Source not found' })
      }

      const state = signState({ sourceId, brandId: request.brandId })
      const redirectUri = `${CEQ_OAUTH_CALLBACK_BASE_URL}/v1/integrations/oauth/${provider}/callback`

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes,
        state,
      })

      // Google-specific: request offline access for refresh token
      if (provider === 'google') {
        params.set('access_type', 'offline')
        params.set('prompt', 'consent')
      }

      const authorizationUrl = `${config.authUrl}?${params}`
      return reply.status(200).send({ authorizationUrl })
    },
  )

  // GET /integrations/oauth/:provider/callback (public — browser redirect from provider)
  fastify.get<{
    Params: { provider: string }
    Querystring: { code?: string; state?: string; error?: string }
  }>(
    '/integrations/oauth/:provider/callback',
    { config: { public: true } },
    async (request, reply) => {
      const { provider } = request.params
      const { code, state, error: oauthError } = request.query as {
        code?: string
        state?: string
        error?: string
      }
      const config = PROVIDERS[provider]

      if (!config) {
        return reply.redirect(`${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=invalid_provider`)
      }

      // User denied consent
      if (oauthError) {
        fastify.log.warn({ provider, error: oauthError }, 'oauth.user_denied')
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_denied&provider=${provider}`,
        )
      }

      if (!code || !state) {
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
        )
      }

      // Verify CSRF state
      const statePayload = verifyState(state)
      if (!statePayload || !statePayload.sourceId || !statePayload.brandId) {
        fastify.log.error({ provider }, 'oauth.invalid_state')
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
        )
      }

      const { sourceId, brandId } = statePayload as { sourceId: string; brandId: string }

      // Verify source ownership BEFORE exchanging the OAuth code — if the source
      // was deleted between authorize and callback, we don't want an orphan token.
      const source = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: sourceId, brandId },
        select: { id: true, scopeConfig: true },
      })

      if (!source) {
        fastify.log.error({ sourceId, brandId }, 'oauth.source_not_found')
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
        )
      }

      const clientId = process.env[config.clientIdEnv]
      const clientSecret = process.env[config.clientSecretEnv]
      if (!clientId || !clientSecret) {
        fastify.log.error({ provider }, 'oauth.missing_platform_credentials')
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
        )
      }

      const redirectUri = `${CEQ_OAUTH_CALLBACK_BASE_URL}/v1/integrations/oauth/${provider}/callback`

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        })

        if (!tokenResponse.ok) {
          const text = await tokenResponse.text().catch(() => '')
          fastify.log.error(
            { provider, status: tokenResponse.status, body: text.slice(0, 200) },
            'oauth.token_exchange_failed',
          )
          return reply.redirect(
            `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
          )
        }

        const tokens = (await tokenResponse.json()) as Record<string, unknown>

        if (typeof tokens.access_token !== 'string' || !tokens.access_token) {
          fastify.log.error({ provider }, 'oauth.invalid_token_response')
          return reply.redirect(
            `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
          )
        }

        const expiresIn = (tokens.expires_in as number) ?? 3600
        const existingConfig = (source.scopeConfig ?? {}) as Record<string, unknown>

        await fastify.prisma.externalSignalSource.update({
          where: { id: sourceId },
          data: {
            enabled: true,
            connectionMethod: 'oauth',
            healthStatus: 'pending',
            scopeConfig: {
              ...existingConfig,
              credentials: {
                accessToken: tokens.access_token,
                refreshToken: (tokens.refresh_token as string) ?? undefined,
                tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
              },
            },
          },
        })

        fastify.log.info({ provider, sourceId, brandId }, 'oauth.connected')

        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?connected=${provider}&sourceId=${sourceId}`,
        )
      } catch (err) {
        fastify.log.error({ provider, err }, 'oauth.callback_error')
        return reply.redirect(
          `${CEQ_ADMIN_UI_BASE_URL}/admin/integrations?error=oauth_failed&provider=${provider}`,
        )
      }
    },
  )
  // GET /admin/integrations/oauth/google/locations?sourceId=xxx (authenticated)
  // Fetches Google Business accounts and locations using the source's stored OAuth tokens
  fastify.get<{
    Querystring: { sourceId: string }
  }>(
    '/admin/integrations/oauth/google/locations',
    async (request, reply) => {
      const { sourceId } = request.query as { sourceId?: string }
      if (!sourceId) {
        return reply.status(400).send({ error: 'sourceId query parameter is required' })
      }

      const source = await fastify.prisma.externalSignalSource.findFirst({
        where: { id: sourceId, brandId: request.brandId },
        select: { id: true, scopeConfig: true },
      })

      if (!source) {
        return reply.status(404).send({ error: 'Source not found' })
      }

      const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>
      const credentials = scopeConfig.credentials as Record<string, unknown> | undefined
      if (!credentials?.accessToken) {
        return reply.status(400).send({ error: 'Source not connected — complete OAuth first' })
      }

      try {
        // Fetch accounts
        const accountsRes = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
        )

        if (accountsRes.status === 401) {
          return reply.status(401).send({ error: 'Google token expired — reconnect your account' })
        }
        if (accountsRes.status === 429) {
          const text = await accountsRes.text().catch(() => '')
          fastify.log.error({ status: 429, body: text.slice(0, 200) }, 'google.quota_exceeded')
          return reply.status(429).send({
            error: 'Google API quota exceeded. Your Google Cloud project has 0/minute quota for "My Business Account Management API". Request a quota increase at https://console.cloud.google.com/iam-admin/quotas (search for mybusinessaccountmanagement.googleapis.com).',
          })
        }
        if (accountsRes.status === 403) {
          const text = await accountsRes.text().catch(() => '')
          fastify.log.error({ status: 403, body: text.slice(0, 200) }, 'google.permission_denied')
          return reply.status(403).send({
            error: 'Google API not enabled or insufficient permissions. Enable "My Business Account Management API" and "My Business Business Information API" in Google Cloud Console.',
          })
        }
        if (!accountsRes.ok) {
          const text = await accountsRes.text().catch(() => '')
          fastify.log.error({ status: accountsRes.status, body: text.slice(0, 200) }, 'google.accounts_fetch_failed')
          return reply.status(502).send({ error: `Google API error (${accountsRes.status}): ${text.slice(0, 200)}` })
        }

        const accountsData = (await accountsRes.json()) as { accounts?: Array<{ name: string; accountName: string; type: string }> }
        const accounts = accountsData.accounts ?? []

        const locationResults = await Promise.all(
          accounts.map(async (account) => {
            try {
              const locRes = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
                { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
              )
              if (!locRes.ok) return []
              const locData = (await locRes.json()) as {
                locations?: Array<{
                  name: string
                  title: string
                  storefrontAddress?: { addressLines?: string[]; locality?: string; regionCode?: string }
                }>
              }
              return (locData.locations ?? []).map((loc) => {
                const addr = loc.storefrontAddress
                const address = [...(addr?.addressLines ?? []), addr?.locality, addr?.regionCode]
                  .filter(Boolean)
                  .join(', ')
                return {
                  accountId: account.name,
                  accountName: account.accountName,
                  locationId: loc.name,
                  locationName: loc.title,
                  address,
                }
              })
            } catch {
              return []
            }
          }),
        )
        const locations = locationResults.flat()

        return reply.status(200).send({ accounts, locations })
      } catch (err) {
        fastify.log.error({ err }, 'google.locations_fetch_error')
        return reply.status(500).send({ error: 'Failed to fetch Google Business locations' })
      }
    },
  )
}

export default oauthRoutes
