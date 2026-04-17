import { getLocalApiBaseUrl } from './git-utils.js'

// Centralized API client - wraps auth + base URL for all tool calls

export type ApiFetch = <T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; params?: Record<string, string> },
) => Promise<ApiResponse<T>>

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
  error?: string
}

export interface ApiClientConfig {
  baseUrl?: string
  apiKey?: string
  token?: string
  testBrandId?: string
  testUserId?: string
}

/**
 * Factory that returns an apiFetch-compatible function using the provided config.
 * The HTTP MCP route uses this to inject a per-request API key (derived from the
 * OAuth bearer token) rather than reading from env vars.
 */
export function createApiClient(config: ApiClientConfig = {}): ApiFetch {
  const baseUrl =
    config.baseUrl ??
    process.env.CUSTOMEREQ_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production' ? undefined : getLocalApiBaseUrl())
  const apiKey = config.apiKey ?? process.env.CUSTOMEREQ_API_KEY ?? ''
  const token = config.token ?? process.env.CUSTOMEREQ_API_TOKEN ?? ''
  const testBrandId = config.testBrandId ?? process.env.CUSTOMEREQ_TEST_BRAND_ID ?? ''
  const testUserId = config.testUserId ?? process.env.CUSTOMEREQ_TEST_USER_ID ?? 'mcp-server'

  if (!baseUrl) {
    throw new Error('Missing API base URL. Set CUSTOMEREQ_API_URL or NEXT_PUBLIC_API_URL.')
  }

  return async function apiFetch<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, params } = options

    let url = `${baseUrl}${path}`
    if (params) {
      const qs = new URLSearchParams(params)
      url += `?${qs.toString()}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
    } else if (token) {
      headers.Authorization = `Bearer ${token}`
    } else if (testBrandId) {
      headers['X-Test-Brand-Id'] = testBrandId
      headers['X-Test-User-Id'] = testUserId
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: data as T,
          error: (data as Record<string, string>).error ?? `API returned ${res.status}`,
        }
      }

      return { ok: true, status: res.status, data: data as T }
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: {} as T,
        error: err instanceof Error ? err.message : 'Network error',
      }
    }
  }
}

// Default singleton - reads from env vars. Used by the stdio MCP server.
export const apiFetch: ApiFetch = createApiClient()
