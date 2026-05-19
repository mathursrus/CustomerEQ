import crypto from 'node:crypto'

export interface VerifySlackArgs {
  signingSecret: string
  timestamp: string
  rawBody: string
  signature: string
}

export function verifySlackSignature(args: VerifySlackArgs): boolean {
  const tsNum = Number(args.timestamp)
  if (!Number.isFinite(tsNum)) return false
  const skew = Math.abs(Date.now() / 1000 - tsNum)
  if (skew > 300) return false
  const base = `v0:${args.timestamp}:${args.rawBody}`
  const computed = 'v0=' + crypto.createHmac('sha256', args.signingSecret).update(base).digest('hex')
  if (computed.length !== args.signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(args.signature))
}
