import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useDashboard } from '../../hooks/useDashboard'
import { NpsSparkline } from '../../components/NpsSparkline'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data, isLoading, error } = useDashboard()

  if (isLoading) return <View style={s.center}><ActivityIndicator color="#4F46E5" size="large" /></View>
  if (error) return <View style={s.center}><Text style={{ color: '#6b7280', fontSize: 14 }}>Unable to load dashboard. Pull to refresh.</Text></View>

  const nps = data?.nps
  const delta = nps?.delta ?? 0
  const anomaly = data?.activeAnomaly

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.appName}>CustomerEQ</Text>
      </View>
      {/* NPS Hero */}
      <View style={s.heroCard}>
        <View style={s.heroTop}>
          <Text style={s.npsLabel}>NPS SCORE</Text>
          <View style={[s.deltaChip, { backgroundColor: delta >= 0 ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.2)' }]}>
            <Text style={[s.deltaText, { color: delta >= 0 ? '#6ee7b7' : '#fca5a5' }]}>{delta >= 0 ? '↑' : '↓'}{Math.abs(delta)} pts vs last week</Text>
          </View>
        </View>
        <Text style={s.npsScore}>{nps?.currentScore ?? '--'}</Text>
        <Text style={s.npsSub}>{data?.totalResponses ?? 0} responses · {data?.responseRate ?? 0}% response rate this week</Text>
        {nps?.weeklyTrend && <NpsSparkline data={nps.weeklyTrend.map((w) => w.nps ?? 0)} />}
      </View>
      {/* Anomaly banner */}
      {anomaly && (
        <Pressable style={s.anomalyBanner} onPress={() => router.push('/(tabs)/insights')}>
          <View style={{ flex: 1 }}>
            <Text style={s.anomalyTag}>⚠ ANOMALY</Text>
            <Text style={s.anomalyText}>{anomaly.clusterLabel} spiked — tap to investigate</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  appName: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  heroCard: { marginHorizontal: 16, borderRadius: 20, padding: 20, backgroundColor: '#4F46E5', marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  npsLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  deltaChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  deltaText: { fontSize: 12, fontWeight: '700' },
  npsScore: { fontSize: 66, fontWeight: '800', color: '#fff', lineHeight: 70 },
  npsSub: { color: 'rgba(255,255,255,0.58)', fontSize: 11, marginTop: 4 },
  anomalyBanner: { marginHorizontal: 16, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderLeftWidth: 4, borderLeftColor: '#f97316', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  anomalyTag: { fontSize: 10, fontWeight: '800', color: '#c2410c' },
  anomalyText: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 2 },
  chevron: { fontSize: 20, color: '#9ca3af' },
})
