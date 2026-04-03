import type { FastifyPluginAsync } from 'fastify'
import type { SpinWheelConfig, ScratchCardConfig, MysteryBoxConfig } from '@customerEQ/shared'

const campaignPlayRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/public/campaigns/:id/play — member plays an interactive campaign
  // Auth: member email in Authorization Bearer header (MVP)
  // Future: Clerk member JWT with verifyToken()
  fastify.post(
    '/public/campaigns/:id/play',
    { config: { public: true } },
    async (request, reply) => {
      const { id: campaignId } = request.params as { id: string }

      // 1. Authenticate member via Bearer token
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Authentication required' })
      }
      const memberEmail = authHeader.slice(7).trim()
      if (!memberEmail || !memberEmail.includes('@')) {
        return reply.status(401).send({ error: 'Invalid authentication token' })
      }

      // 2. Find campaign (any interactive type, must be ACTIVE)
      const campaign = await fastify.prisma.campaign.findFirst({
        where: { id: campaignId, status: 'ACTIVE' },
        select: {
          id: true,
          brandId: true,
          actionType: true,
          actionConfig: true,
          startDate: true,
          endDate: true,
        },
      })
      if (!campaign) {
        return reply.status(404).send({ error: 'Campaign not found' })
      }
      if (campaign.endDate && campaign.endDate < new Date()) {
        return reply.status(410).send({ error: 'Campaign has ended' })
      }

      // 3. Look up member by email within the campaign's brand
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, brandId: campaign.brandId, deletedAt: null },
        select: { id: true, consentGivenAt: true, erased: true },
      })
      if (!member || member.erased) {
        return reply.status(404).send({ error: 'Member not found' })
      }
      if (!member.consentGivenAt) {
        return reply.status(403).send({ error: 'Consent required' })
      }

      // 4. Find the CampaignEvent created by the trigger processor
      const event = await fastify.prisma.campaignEvent.findFirst({
        where: { campaignId: campaign.id, memberId: member.id },
        select: { id: true, result: true, status: true },
      })

      if (!event) {
        return reply.status(404).send({
          error: 'Spin not ready yet. Please try again in a moment.',
        })
      }

      // 5. Check if already played (status = 'played')
      // 'executed' = trigger fired, result determined, but member hasn't seen the wheel yet
      // 'played' = member has already played/viewed the wheel
      if (event.status === 'played') {
        return reply.status(200).send({
          alreadyPlayed: true,
          reward: event.result,
        })
      }

      // 6. Mark as played (first time viewing)
      await fastify.prisma.campaignEvent.update({
        where: { id: event.id },
        data: { status: 'played' },
      })

      // 7. Return campaign-type-specific response
      if (campaign.actionType === 'spin_wheel') {
        const config = campaign.actionConfig as SpinWheelConfig
        const resultData = event.result as {
          winningIndex: number
          rewardId: string | null
          points: number
          label: string
        }

        return reply.status(200).send({
          alreadyPlayed: false,
          campaignType: 'spin_wheel',
          segments: config.segments.map((s, i) => ({
            label: s.label,
            color: s.color,
            index: i,
          })),
          winningIndex: resultData.winningIndex,
          wheelStyle: config.wheelStyle ?? 'classic',
          reward: {
            type: resultData.rewardId ? 'reward' : 'points',
            points: resultData.points,
            label: resultData.label,
            rewardId: resultData.rewardId,
          },
        })
      }

      if (campaign.actionType === 'scratch_card') {
        const config = campaign.actionConfig as ScratchCardConfig
        const resultData = event.result as {
          winningIndex: number
          rewardId: string | null
          points: number
          label: string
        }

        return reply.status(200).send({
          alreadyPlayed: false,
          campaignType: 'scratch_card',
          cardStyle: config.cardStyle ?? 'gold',
          scratchText: config.scratchText ?? 'Scratch to reveal!',
          brandColor: config.brandColor ?? null,
          prize: {
            type: resultData.rewardId ? 'reward' : 'points',
            points: resultData.points,
            label: resultData.label,
            rewardId: resultData.rewardId,
          },
        })
      }

      if (campaign.actionType === 'mystery_box') {
        const config = campaign.actionConfig as MysteryBoxConfig
        const resultData = event.result as {
          winningIndex: number
          rewardId: string | null
          points: number
          label: string
        }

        return reply.status(200).send({
          alreadyPlayed: false,
          campaignType: 'mystery_box',
          boxStyle: config.boxStyle ?? 'gift',
          brandColor: config.brandColor ?? null,
          prize: {
            type: resultData.rewardId ? 'reward' : 'points',
            points: resultData.points,
            label: resultData.label,
            rewardId: resultData.rewardId,
          },
        })
      }

      // Default: return raw result for future campaign types
      return reply.status(200).send({
        alreadyPlayed: false,
        campaignType: campaign.actionType,
        reward: event.result,
      })
    },
  )
}

export default campaignPlayRoutes
