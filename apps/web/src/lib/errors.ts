// Shared error-response parsing for admin/editor UI fetches.
// Consolidated from 4 Slice 4b call sites (Q8-002 — Phase 8 quality fix).
// All admin API responses follow the same envelope shape: { message?, error? }
// (see apps/api/src/utils/errorEnvelope.ts) — this helper unwraps it with a
// sensible fallback when the body isn't JSON or the response is empty.

export async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Request failed (HTTP ${res.status})`
  } catch {
    return `Request failed (HTTP ${res.status})`
  }
}
