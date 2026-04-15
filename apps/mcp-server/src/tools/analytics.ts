import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiFetch } from '../api-client.js'
import type { ApiFetch } from '../api-client.js'

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return { startDate: start.toISOString(), endDate: end.toISOString() }
}

export function registerAnalyticsTools(server: McpServer, fetch: ApiFetch = apiFetch) {
  // CX Analytics
  server.tool(
    'get_cx_analytics',
    'Get CX analytics: NPS score, CSAT, CES, sentiment distribution, feedback clusters, and anomalies. Defaults to last 30 days.',
    z.object({
      startDate: z.string().optional().describe('ISO start date (default: 30 days ago)'),
      endDate: z.string().optional().describe('ISO end date (default: now)'),
    }).shape,
    async (params) => {
      const dates = { ...defaultDateRange(), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }
      const res = await fetch('/v1/analytics/cx', { params: dates })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Loyalty overview
  server.tool(
    'get_loyalty_overview',
    'Get loyalty program overview: total members, points issued/redeemed, ROI, top rewards.',
    z.object({
      startDate: z.string().optional().describe('ISO start date'),
      endDate: z.string().optional().describe('ISO end date'),
    }).shape,
    async (params) => {
      const dates = { ...defaultDateRange(), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }
      const res = await fetch('/v1/analytics/overview', { params: dates })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Feedback clusters
  server.tool(
    'get_feedback_clusters',
    'Get all feedback clusters with trend data (up/down/stable), response counts, and daily snapshots.',
    z.object({
      startDate: z.string().optional().describe('ISO start date'),
      endDate: z.string().optional().describe('ISO end date'),
    }).shape,
    async (params) => {
      const dates = { ...defaultDateRange(), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }
      const res = await fetch('/v1/analytics/cx/clusters', { params: dates })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Cluster trend detail
  server.tool(
    'get_cluster_trend',
    'Get daily volume trend for a specific feedback cluster. Shows anomaly days highlighted.',
    z.object({
      clusterId: z.string().describe('Cluster ID'),
      startDate: z.string().optional().describe('ISO start date'),
      endDate: z.string().optional().describe('ISO end date'),
    }).shape,
    async ({ clusterId, ...params }) => {
      const dates = { ...defaultDateRange(), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }
      const res = await fetch(`/v1/analytics/cx/clusters/${clusterId}/trend`, { params: dates })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Anomalies
  server.tool(
    'get_anomalies',
    'Get detected feedback anomalies: volume spikes, sentiment drops, new themes. Filter by severity.',
    z.object({
      severity: z.enum(['low', 'medium', 'high']).optional().describe('Filter by severity'),
      startDate: z.string().optional().describe('ISO start date'),
      endDate: z.string().optional().describe('ISO end date'),
    }).shape,
    async ({ severity, ...params }) => {
      const dates: Record<string, string> = { ...defaultDateRange(), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }
      if (severity) dates.severity = severity
      const res = await fetch('/v1/analytics/cx/anomalies', { params: dates })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )

  // Trigger clustering
  server.tool(
    'trigger_clustering',
    'Manually trigger a feedback clustering batch job. Discovers new themes and detects anomalies.',
    {},
    async () => {
      const res = await fetch('/v1/analytics/cx/clustering/trigger', { method: 'POST' })
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(res.data, null, 2) }] }
    },
  )
}
