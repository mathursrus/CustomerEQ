// Centralized API client — wraps auth + base URL for all tool calls

const API_BASE_URL = process.env.CUSTOMEREQ_API_URL ?? 'http://localhost:4000'
const API_TOKEN = process.env.CUSTOMEREQ_API_TOKEN ?? ''
const API_KEY = process.env.CUSTOMEREQ_API_KEY ?? ''

// For local dev: when API runs with NODE_ENV=test, use test headers instead of JWT
const TEST_BRAND_ID = process.env.CUSTOMEREQ_TEST_BRAND_ID ?? ''
const TEST_USER_ID = process.env.CUSTOMEREQ_TEST_USER_ID ?? 'mcp-server'

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
  error?: string
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string
    body?: unknown
    params?: Record<string, string>
  } = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, params } = options

  let url = `${API_BASE_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(params)
    url += `?${qs.toString()}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (API_KEY) {
    // API key auth (production MCP) — maps to brand via server-side MCP_BRAND_ID
    headers['X-Api-Key'] = API_KEY
  } else if (API_TOKEN) {
    // Clerk JWT auth
    headers.Authorization = `Bearer ${API_TOKEN}`
  } else if (TEST_BRAND_ID) {
    // Local dev mode: use test headers (requires API NODE_ENV=test)
    headers['X-Test-Brand-Id'] = TEST_BRAND_ID
    headers['X-Test-User-Id'] = TEST_USER_ID
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
