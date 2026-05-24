import { View, Text, ScrollView, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useClusters } from '../../hooks/useClusters'

const STATUS_COLORS: Record<string, string> = { Spiking: '#dc2626', Growing: '#d97706', Stable: '#059669', Declining: '#6b7280' }

interface Cluster { id: string; label: string; description: string | null; responseCount: number; trend: number }

function clusterStatus(trend: number) {
  return Math.abs(trend) > 20 && trend > 0 ? 'Spiking' : trend > 0 ? 'Growing' : Math.abs(trend) < 5 ? 'Stable' : 'Declining'
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets()
  const { clusters, anomaly, isLoading } = useClusters()
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)

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
          const status = clusterStatus(c.trend)
          return (
            <Pressable key={c.id} style={s.clusterCard} onPress={() => setSelectedCluster(c)}>
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
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Cluster Detail Sheet — AC5 */}
      <Modal visible={!!selectedCluster} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle} numberOfLines={1}>{selectedCluster?.label}</Text>
            <Pressable onPress={() => setSelectedCluster(null)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View style={s.metaRow}>
              <Text style={s.metaItem}>{selectedCluster?.responseCount} responses</Text>
              {selectedCluster && (
                <View style={[s.trendChip, { backgroundColor: selectedCluster.trend > 0 ? '#fef2f2' : '#f0fdf4' }]}>
                  <Text style={[s.trendText, { color: selectedCluster.trend > 0 ? '#dc2626' : '#059669' }]}>
                    {selectedCluster.trend > 0 ? '↑' : '↓'}{Math.abs(selectedCluster.trend)}% this week
                  </Text>
                </View>
              )}
            </View>
            {selectedCluster?.description && (
              <View style={s.aiSummaryCard}>
                <Text style={s.aiLabel}>AI SUMMARY</Text>
                <Text style={s.aiText}>{selectedCluster.description}</Text>
              </View>
            )}
            <View style={s.sentimentCard}>
              <Text style={s.aiLabel}>SENTIMENT BREAKDOWN</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>Detailed sentiment available in web dashboard</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  closeBtn: { fontSize: 18, color: '#6b7280' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem: { fontSize: 14, color: '#6b7280' },
  aiSummaryCard: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 14 },
  aiLabel: { fontSize: 10, fontWeight: '800', color: '#6b7280', letterSpacing: 0.6, marginBottom: 6 },
  aiText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  sentimentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
})
