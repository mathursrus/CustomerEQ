import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useClusters } from '../../hooks/useClusters'

const STATUS_COLORS: Record<string, string> = { Spiking: '#dc2626', Growing: '#d97706', Stable: '#059669', Declining: '#6b7280' }

export default function InsightsScreen() {
  const insets = useSafeAreaInsets()
  const { clusters, anomaly, isLoading } = useClusters()

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>AI Insights</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {isLoading && <ActivityIndicator color="#4F46E5" />}
        {anomaly && (
          <View style={s.anomalyCard}>
            <Text style={s.anomalyBadge}>🔴 ANOMALY DETECTED</Text>
            <Text style={s.anomalyText}>{anomaly.clusterLabel ?? anomaly.summary}</Text>
            <Text style={s.anomalyMeta}>Severity: {anomaly.severity} · Detected {new Date(anomaly.detectedAt).toLocaleDateString()}</Text>
          </View>
        )}
        {clusters.map((c) => {
          const trendUp = c.trend > 0
          const status = Math.abs(c.trend) > 20 && trendUp ? 'Spiking' : trendUp ? 'Growing' : Math.abs(c.trend) < 5 ? 'Stable' : 'Declining'
          return (
            <View key={c.id} style={s.clusterCard}>
              <View style={s.clusterTop}>
                <Text style={s.clusterName}>{c.label}</Text>
                <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[status] + '20' }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[status] }]}>{status}</Text>
                </View>
              </View>
              <View style={s.clusterMeta}>
                <Text style={s.clusterCount}>{c.responseCount} responses</Text>
                <View style={[s.trendChip, { backgroundColor: trendUp ? '#fef2f2' : '#f0fdf4' }]}>
                  <Text style={[s.trendText, { color: trendUp ? '#dc2626' : '#059669' }]}>{trendUp ? '↑' : '↓'}{Math.abs(c.trend)}% this week</Text>
                </View>
              </View>
              {c.description && <Text style={s.clusterDesc} numberOfLines={2}>{c.description}</Text>}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  anomalyCard: { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca', borderLeftWidth: 4, borderLeftColor: '#dc2626', borderRadius: 12, padding: 14 },
  anomalyBadge: { fontSize: 11, fontWeight: '800', color: '#dc2626', marginBottom: 4 },
  anomalyText: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  anomalyMeta: { fontSize: 12, color: '#6b7280' },
  clusterCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  clusterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  clusterName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  clusterMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clusterCount: { fontSize: 12, color: '#6b7280' },
  trendChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  trendText: { fontSize: 12, fontWeight: '700' },
  clusterDesc: { fontSize: 13, color: '#6b7280', marginTop: 6 },
})
