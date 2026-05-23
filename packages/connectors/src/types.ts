import pino from 'pino'

const logger = pino({ name: 'connector' })

// ---------------------------------------------------------------------------
// Connector interface
// ---------------------------------------------------------------------------

export interface ConnectorContext {
  sourceId: string
  brandId: string
  scopeConfig: Record<string, unknown>
  lastCursor: Record<string, unknown> | null
  credentialRef: string | null
}

export interface ConnectorResult {
  deliveries: Record<string, unknown>[]
  nextCursor: Record<string, unknown> | null
  updatedCredentials?: Record<string, unknown>
}

export type ProviderConnector = (ctx: ConnectorContext) => Promise<ConnectorResult>

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ConnectorAuthError extends Error {
  updatedCredentials?: Record<string, unknown>
  constructor(provider: string, message: string, updatedCredentials?: Record<string, unknown>) {
    super(`[${provider}] Auth error: ${message}`)
    this.name = 'ConnectorAuthError'
    this.updatedCredentials = updatedCredentials
  }
}

export class ConnectorRateLimitError extends Error {
  retryAfterMs: number
  constructor(provider: string, retryAfterMs: number) {
    super(`[${provider}] Rate limited`)
    this.name = 'ConnectorRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

// ---------------------------------------------------------------------------
// Shared HTTP helper
// ---------------------------------------------------------------------------

export async function connectorFetch(
  provider: string,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, options)

  if (response.status === 401 || response.status === 403) {
    const text = await response.text().catch(() => '')
    throw new ConnectorAuthError(provider, `HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    const ms = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000
    throw new ConnectorRateLimitError(provider, ms)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[${provider}] HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  return response
}

// ---------------------------------------------------------------------------
// OAuth token refresh helper
// ---------------------------------------------------------------------------

interface OAuthCredentials {
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: string
  clientId?: string
  clientSecret?: string
}

interface TokenRefreshConfig {
  provider: string
  tokenUrl: string
  credentials: OAuthCredentials
  extraParams?: Record<string, string>
}

interface TokenRefreshResult {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export function getCredentials(scopeConfig: Record<string, unknown>): OAuthCredentials | null {
  const creds = scopeConfig.credentials as Record<string, unknown> | undefined
  if (!creds || typeof creds !== 'object') return null
  if (!creds.accessToken && !creds.clientId) return null
  return creds as unknown as OAuthCredentials
}

/**
 * Merges platform-level env var credentials into per-org credentials.
 * Env vars fill in missing clientId/clientSecret so org admins don't need to
 * configure OAuth app credentials — only per-org tokens (accessToken/refreshToken).
 */
export function mergeEnvCredentials(
  credentials: OAuthCredentials | null,
  provider: 'GOOGLE' | 'LINKEDIN' | 'REDDIT',
): OAuthCredentials | null {
  const envClientId = process.env[`CEQ_${provider}_CLIENT_ID`]
  const envClientSecret = process.env[`CEQ_${provider}_CLIENT_SECRET`]

  if (!credentials) {
    if (!envClientId || !envClientSecret) return null
    return {
      accessToken: '',
      clientId: envClientId,
      clientSecret: envClientSecret,
    }
  }

  return {
    ...credentials,
    clientId: credentials.clientId || envClientId,
    clientSecret: credentials.clientSecret || envClientSecret,
  }
}

export function isTokenExpired(credentials: OAuthCredentials, bufferMs = 5 * 60 * 1000): boolean {
  if (!credentials.tokenExpiresAt) return false
  return new Date(credentials.tokenExpiresAt).getTime() - bufferMs < Date.now()
}

export async function refreshOAuthToken(config: TokenRefreshConfig): Promise<TokenRefreshResult> {
  const { provider, tokenUrl, credentials, extraParams } = config

  if (!credentials.refreshToken) {
    throw new ConnectorAuthError(provider, 'No refresh token available')
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    ...(credentials.clientId ? { client_id: credentials.clientId } : {}),
    ...(credentials.clientSecret ? { client_secret: credentials.clientSecret } : {}),
    ...extraParams,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ConnectorAuthError(provider, `Token refresh failed: HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json() as Record<string, unknown>
  const expiresIn = (data.expires_in as number) ?? 3600

  logger.info({ provider }, 'oauth_token_refreshed')

  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) ?? credentials.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}
