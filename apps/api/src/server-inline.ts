process.env.QUEUE_MODE = 'inline'
process.env.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? 'whsec_dGVzdA=='
process.env.DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH ?? 'true'
process.env.DEV_BRAND_ID = process.env.DEV_BRAND_ID ?? process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'

await import('./server.js')
