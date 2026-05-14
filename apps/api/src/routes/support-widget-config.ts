import type { FastifyPluginAsync } from 'fastify'
import { UpdateSupportWidgetConfigSchema, type PublicWidgetBoot } from '@customerEQ/shared'

const WIDGET_CONFIG_DEFAULTS = {
  position: 'BOTTOM_RIGHT' as const,
  launcherIconUrl: null,
  darkModeAuto: false,
  greeting: 'Hi! How can we help?',
  offlineMessage: "We're not online right now. Leave us a message and we'll get back to you.",
  csatPromptText: 'Did this help?',
  escalateButtonText: 'Talk to a human',
  showCsatAfterAi: true,
  csatTimeoutSeconds: 30,
  anonAllowed: true,
}

const THEME_DEFAULTS = {
  primaryColor: '#6366f1',
  accentColor: '#818cf8',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonColor: '#6366f1',
  buttonTextColor: '#ffffff',
  fontFamily: 'system-ui',
  borderRadius: 'md',
}

const supportWidgetConfigRoutes: FastifyPluginAsync = async (fastify) => {
  // PUBLIC: GET /public/support/widget-config?brandId=...
  // Returns combined BrandTheme + SupportWidgetConfig boot payload for the embed widget.
  fastify.get<{ Querystring: { brandId?: string } }>(
    '/public/support/widget-config',
    { config: { public: true } },
    async (request, reply) => {
      const { brandId } = request.query
      if (!brandId) {
        return reply.status(400).send({ error: 'brandId query param required' })
      }

      const brand = await fastify.prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          defaultTheme: {
            select: {
              primaryColor: true,
              accentColor: true,
              backgroundColor: true,
              textColor: true,
              buttonColor: true,
              buttonTextColor: true,
              fontFamily: true,
              borderRadius: true,
            },
          },
          supportWidgetConfig: true,
        },
      })
      if (!brand) {
        return reply.status(404).send({ error: 'Brand not found' })
      }

      const cfg = brand.supportWidgetConfig
      const widget = cfg
        ? {
            position: cfg.position,
            launcherIconUrl: cfg.launcherIconUrl,
            darkModeAuto: cfg.darkModeAuto,
            greeting: cfg.greeting,
            offlineMessage: cfg.offlineMessage,
            csatPromptText: cfg.csatPromptText,
            escalateButtonText: cfg.escalateButtonText,
            showCsatAfterAi: cfg.showCsatAfterAi,
            csatTimeoutSeconds: cfg.csatTimeoutSeconds,
            anonAllowed: cfg.anonAllowed,
          }
        : WIDGET_CONFIG_DEFAULTS

      const theme = brand.defaultTheme ?? THEME_DEFAULTS

      const payload: PublicWidgetBoot = {
        brandId: brand.id,
        brandName: brand.name,
        theme,
        widget,
      }
      return reply.header('Cache-Control', 'public, max-age=60').send(payload)
    },
  )

  // ADMIN: PUT /support/widget-config (upsert by brandId from JWT)
  fastify.put('/support/widget-config', async (request, reply) => {
    const parse = UpdateSupportWidgetConfigSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({ error: 'Validation failed', issues: parse.error.issues })
    }
    const data = parse.data
    const updated = await fastify.prisma.supportWidgetConfig.upsert({
      where: { brandId: request.brandId },
      create: { brandId: request.brandId, ...data },
      update: data,
    })
    await fastify.prisma.auditEvent
      .create({
        data: {
          brandId: request.brandId,
          actorId: (request as any).clerkUserId ?? 'system',
          action: 'support_widget_config.update',
          resourceType: 'SupportWidgetConfig',
          resourceId: updated.id,
        },
      })
      .catch(() => undefined)
    return reply.send(updated)
  })
}

export default supportWidgetConfigRoutes
