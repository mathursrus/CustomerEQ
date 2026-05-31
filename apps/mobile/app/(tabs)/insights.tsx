import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Chip, EmptyState, ErrorState, LoadingBlock, ScreenHeader, colors, formatDate } from '../../components/ui'
import { type Cluster, useClusters } from '../../hooks/useClusters'

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Spiking: { bg: colors.redSoft, fg: colors.red },
  Growing: { bg: colors.amberSoft, fg: colors.amber },
  Stable: { bg: colors.greenSoft, fg: colors.green },
  Declining: { bg: '#f1f5f9', fg: colors.muted },
}

function clusterStatus(cluster: Cluster) {
  const trend = cluster.trending?.toLowerCase()
  if (trend === 'up') return Math.abs(cluster.trend) >= 20 ? 'Spiking' : 'Growing'
  if (trend === 'down') return 'Declining'
  if (cluster.trend >= 20) return 'Spiking'
  if (cluster.trend > 4) return 'Growing'
  if (cluster.trend < -4) return 'Declining'
  return 'Stable'
}

function sentimentLabel(value: number | null) {
  if (value === null) return 'Not analyzed'
  if (value > 0.1) return 'Positive'
  if (value < -0.1) return 'Negative'
  return 'Neutral'
}

function sentimentTone(value: number | null) {
  if (value === null) return { bg: '#f1f5f9', fg: colors.muted }
  if (value > 0.1) return { bg: colors.greenSoft, fg: colors.green }
  if (value < -0.1) return { bg: colors.redSoft, fg: colors.red }
  return { bg: colors.amberSoft, fg: colors.amber }
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets()
  const { clusters, anomaly, isLoading, isError, error } = useClusters()
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)

  const topClusters = [...clusters].sort((a, b) => b.responseCount - a.responseCount)

  return (
    <View style={s.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Insights" subtitle="Topics, anomalies, and sentiment from customer feedback" />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {isLoading ? <LoadingBlock label="Loading insights" /> : null}
        {isError ? <ErrorState message={(error as Error | null)?.message ?? 'Unable to load insights.'} /> : null}

        {!isLoading && !isError && !anomaly && topClusters.length === 0 ? (
          <EmptyState icon="bulb-outline" title="No insights yet" body="Insights appear after survey responses are clustered and analyzed." />
        ) : null}

        {anomaly ? (
          <View style={s.alertCard}>
            <View style={s.alertTop}>
              <View style={s.alertIcon}><Ionicons name="alert-circle" size={18} color={colors.red} /></View>
              <Text style={s.alertLabel}>Active anomaly</Text>
              <Text style={s.alertDate}>{formatDate(anomaly.detectedAt)}</Text>
            </View>
            <Text style={s.alertTitle}>{anomaly.clusterLabel ?? 'Feedback anomaly'}</Text>
            <Text style={s.alertBody}>{anomaly.summary}</Text>
            <View style={[s.smallBadge, { backgroundColor: colors.redSoft }]}>
              <Text style={[s.smallBadgeText, { color: colors.red }]}>{anomaly.severity}</Text>
            </View>
          </View>
        ) : null}

        {topClusters.length > 0 ? (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Feedback clusters</Text>
            <Text style={s.sectionMeta}>{topClusters.length} active</Text>
          </View>
        ) : null}

        {topClusters.map((cluster) => {
          const status = clusterStatus(cluster)
          const statusTone = STATUS_COLORS[status]
          const sentiment = sentimentTone(cluster.avgSentiment)
          return (
            <Pressable key={cluster.id} style={s.clusterCard} onPress={() => setSelectedCluster(cluster)}>
              <View style={s.clusterTop}>
                <Text style={s.clusterName} numberOfLines={2}>{cluster.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </View>
              {cluster.description ? <Text style={s.clusterDesc} numberOfLines={3}>{cluster.description}</Text> : null}
              <View style={s.metaRow}>
                <Chip label={`${cluster.responseCount} responses`} />
                <View style={[s.smallBadge, { backgroundColor: statusTone.bg }]}>
                  <Text style={[s.smallBadgeText, { color: statusTone.fg }]}>{status}</Text>
                </View>
                <View style={[s.smallBadge, { backgroundColor: sentiment.bg }]}>
                  <Text style={[s.smallBadgeText, { color: sentiment.fg }]}>{sentimentLabel(cluster.avgSentiment)}</Text>
                </View>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>

      {selectedCluster ? (
        <View style={s.overlay}>
          <View style={[s.sheetHeader, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle} numberOfLines={1}>{selectedCluster?.label}</Text>
              <Text style={s.sheetSub}>{selectedCluster?.responseCount ?? 0} responses</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close cluster details" onPress={() => setSelectedCluster(null)} style={s.closeButton}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {selectedCluster ? (
              <>
                <View style={s.detailGrid}>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Trend</Text>
                    <Text style={s.metricValue}>{Math.abs(selectedCluster.trend)}%</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Sentiment</Text>
                    <Text style={s.metricValue}>{sentimentLabel(selectedCluster.avgSentiment)}</Text>
                  </View>
                </View>
                {selectedCluster.description ? (
                  <View style={s.summaryCard}>
                    <Text style={s.summaryLabel}>AI summary</Text>
                    <Text style={s.summaryText}>{selectedCluster.description}</Text>
                  </View>
                ) : null}
                {selectedCluster.keywords.length > 0 ? (
                  <View>
                    <Text style={s.sectionTitle}>Keywords</Text>
                    <View style={s.keywordWrap}>
                      {selectedCluster.keywords.map((keyword) => <Chip key={keyword} label={keyword} />)}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 20, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  alertCard: { borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', borderLeftWidth: 4, borderLeftColor: colors.red, backgroundColor: '#fff', padding: 14 },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  alertIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.redSoft },
  alertLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: colors.red, textTransform: 'uppercase' },
  alertDate: { fontSize: 12, color: colors.faint, fontWeight: '700' },
  alertTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.ink },
  alertBody: { marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.muted },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sectionMeta: { fontSize: 12, fontWeight: '700', color: colors.faint },
  clusterCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 14 },
  clusterTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clusterName: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.ink },
  clusterDesc: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  smallBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  smallBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  sheetTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800', color: colors.ink },
  sheetSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  closeButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  detailGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, minHeight: 86, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, justifyContent: 'space-between' },
  metricLabel: { fontSize: 12, fontWeight: '800', color: colors.faint, textTransform: 'uppercase' },
  metricValue: { fontSize: 19, fontWeight: '800', color: colors.ink },
  summaryCard: { borderRadius: 8, backgroundColor: colors.primarySoft, padding: 14, borderWidth: 1, borderColor: '#c7d2fe' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', marginBottom: 6 },
  summaryText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  keywordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
})
