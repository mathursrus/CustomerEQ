// Issue #231 PR2 — wire the IpGeoProvider into Fastify so the survey-respond
// route can capture R18 enrollment signals (best-effort country lookup) on
// auto-enroll. The provider is selected from env at boot time and decorated
// onto the fastify instance as `fastify.ipGeoProvider`.
//
// Until AZURE_MAPS_KEY is provisioned in Key Vault, the AzureMapsIpGeoProvider
// holds a null subscription key and returns null on every lookup. That's the
// designed fallback behavior — the auto-enroll path proceeds with
// `enrollmentSignals = { ipHash, ipCountryIso: null, capturedAt }` and never
// blocks on the absent provider key.

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { selectIpGeoProvider, type IpGeoProvider } from '../services/ipGeo.js'

declare module 'fastify' {
  interface FastifyInstance {
    ipGeoProvider: IpGeoProvider
  }
}

const ipGeoPlugin: FastifyPluginAsync = async (fastify) => {
  const provider = selectIpGeoProvider(
    {
      IP_GEO_PROVIDER: process.env.IP_GEO_PROVIDER,
      AZURE_MAPS_KEY: process.env.AZURE_MAPS_KEY,
    },
    fastify.log,
  )
  fastify.decorate('ipGeoProvider', provider)
}

export default fp(ipGeoPlugin, {
  name: 'ipGeoProvider',
})
