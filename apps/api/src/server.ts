import pino from 'pino'
import { buildApp } from './app.js'

const logger = pino({ name: 'api-server' })

async function main() {
  const fastify = await buildApp()

  const port = parseInt(process.env.API_PORT ?? '4000', 10)
  const host = process.env.API_HOST ?? '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    fastify.log.info({ port, host }, 'CustomerEQ API server is running')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

main().catch((err) => {
  logger.fatal(err, 'Fatal error during startup')
  process.exit(1)
})
