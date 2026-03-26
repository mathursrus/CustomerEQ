// Centralized API client — wraps auth + base URL for all tool calls

const API_BASE_URL = process.env.CUSTOMEREQ_API_URL ?? 'http://localhost:4000'
const API_TOKEN = process.env.CUSTOMEREQ_API_TOKEN ?? ''

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
  if (API_TOKEN) {
    headers.Authorization = `Bearer ${API_TOKEN}`
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
