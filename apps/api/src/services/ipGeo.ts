// Issue #231 R18 — audit-only IP-derived enrollment-signal capture.
//
// This V0 service ships in PR1 (Foundation). PR2 wires the call site at
// `POST /v1/public/surveys/:surveyId/respond` for SURVEY_RESPONSE and
// EMBEDDED_FORM auto-enrollment paths. Until PR2 lands, no caller invokes
// this service, so an unconfigured AZURE_MAPS_KEY is acceptable and the
// service simply returns null.
//
// Per RFC § Enrollment-signal capture (issue-231 RFC):
//   - Provider abstraction: IpGeoProvider interface; V0 ships
//     AzureMapsIpGeoProvider; V1+ swap to MaxMind self-hosted is a
//     single-file change.
//   - Provider selected via `IP_GEO_PROVIDER` env var (default `azure-maps`).
//   - Hard timeout 500ms; lookup failure / timeout → null country, never
//     blocks the caller.
//   - Raw IP never logged or persisted. The service receives the IP only
//     for the lookup; the caller is responsible for hashing it for any
//     audit-trail storage.
//   - Hero #6 SLA: <250ms p99 with the Azure Maps fallback path; well
//     within the <1s synchronous-submit budget.

interface PinoLikeLogger {
  warn: (obj: unknown, msg: string) => void
}

export interface IpGeoProvider {
  /**
   * Best-effort IP → ISO 3166-1 alpha-2 country code lookup.
   * Returns `null` on miss, timeout, network error, malformed response,
   * or when the provider is not configured. Never throws.
   */
  getCountryFromIp(ip: string): Promise<string | null>
}

export interface AzureMapsIpGeoOptions {
  /**
   * Azure Maps subscription key. Sourced from Azure Key Vault per the
   * project's production-secrets policy (CLAUDE.md). Pass `null` to
   * disable lookups (service returns null without making a request).
   */
  subscriptionKey: string | null
  logger: PinoLikeLogger
  /**
   * Injectable fetch — defaults to `globalThis.fetch`. Tests pass a mock.
   */
  fetch?: typeof globalThis.fetch
  /**
   * Hard upper bound on the lookup. Default 500ms — chosen so that even
   * the worst-case provider latency stays inside the hero #6 <1s
   * synchronous-submit budget.
   */
  timeoutMs?: number
}

interface AzureMapsResponse {
  countryRegion?: { isoCode?: string }
  ipAddress?: string
}

export class AzureMapsIpGeoProvider implements IpGeoProvider {
  private readonly subscriptionKey: string | null
  private readonly logger: PinoLikeLogger
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly timeoutMs: number

  constructor(opts: AzureMapsIpGeoOptions) {
    this.subscriptionKey = opts.subscriptionKey
    this.logger = opts.logger
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.timeoutMs = opts.timeoutMs ?? 500
  }

  async getCountryFromIp(ip: string): Promise<string | null> {
    if (!this.subscriptionKey) {
      // Service disabled (no key configured). Silently return null —
      // expected during PR1 before AZURE_MAPS_KEY is provisioned.
      return null
    }

    if (!ip || typeof ip !== 'string') {
      this.logger.warn({ ip: typeof ip }, 'ipGeo: empty or non-string ip; returning null')
      return null
    }

    const url =
      `https://atlas.microsoft.com/geolocation/ip/json` +
      `?subscription-key=${encodeURIComponent(this.subscriptionKey)}` +
      `&api-version=1.0&ip=${encodeURIComponent(ip)}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await this.fetchImpl(url, { signal: controller.signal })
      if (!res.ok) {
        this.logger.warn(
          { status: res.status, ipCountryReason: 'non-2xx' },
          'ipGeo: Azure Maps returned non-2xx; falling back to null country',
        )
        return null
      }
      const body = (await res.json()) as AzureMapsResponse
      const iso = body?.countryRegion?.isoCode
      if (typeof iso !== 'string' || !/^[A-Z]{2}$/.test(iso)) {
        this.logger.warn(
          { ipCountryReason: 'malformed' },
          'ipGeo: Azure Maps response missing or malformed isoCode',
        )
        return null
      }
      return iso
    } catch (err) {
      const reason = (err as { name?: string })?.name === 'AbortError' ? 'timeout' : 'error'
      this.logger.warn(
        { ipCountryReason: reason },
        'ipGeo: Azure Maps lookup failed; falling back to null country',
      )
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * No-op provider for when IP_GEO_PROVIDER is unset or unrecognized.
 * Returns null for every lookup. Used by V0 callers that have not yet
 * provisioned AZURE_MAPS_KEY.
 */
export class NoopIpGeoProvider implements IpGeoProvider {
  async getCountryFromIp(_ip: string): Promise<string | null> {
    return null
  }
}

export interface SelectIpGeoProviderEnv {
  IP_GEO_PROVIDER?: string
  AZURE_MAPS_KEY?: string
}

/**
 * Factory that picks the right IpGeoProvider based on env vars.
 *
 * - `IP_GEO_PROVIDER=azure-maps` (default) + `AZURE_MAPS_KEY` set →
 *   `AzureMapsIpGeoProvider`.
 * - `IP_GEO_PROVIDER=azure-maps` + key missing → `AzureMapsIpGeoProvider`
 *   with `subscriptionKey: null` (returns null on every lookup).
 *   Acceptable during PR1 before the secret is provisioned.
 * - `IP_GEO_PROVIDER=noop` or any unrecognized value → `NoopIpGeoProvider`.
 *
 * `IP_GEO_PROVIDER=maxmind` is reserved for V1+ when the swap target lands;
 * see RFC § Enrollment-signal capture for swap trigger conditions.
 */
export function selectIpGeoProvider(
  env: SelectIpGeoProviderEnv,
  logger: PinoLikeLogger,
): IpGeoProvider {
  const provider = env.IP_GEO_PROVIDER ?? 'azure-maps'
  switch (provider) {
    case 'azure-maps':
      return new AzureMapsIpGeoProvider({
        subscriptionKey: env.AZURE_MAPS_KEY ?? null,
        logger,
      })
    case 'noop':
      return new NoopIpGeoProvider()
    default:
      logger.warn(
        { provider, ipCountryReason: 'unknown_provider' },
        `ipGeo: unrecognized IP_GEO_PROVIDER value; defaulting to noop`,
      )
      return new NoopIpGeoProvider()
  }
}
