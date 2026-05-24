import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useState } from 'react'
import { useRouter } from 'expo-router'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const [anomalyAlerts, setAnomalyAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [newReview, setNewReview] = useState(true)

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  const combined = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')
  const initials = combined || (user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?')

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}>
      <View style={s.header}><Text style={s.title}>Profile</Text></View>
      <View style={s.accountCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <View>
          <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={s.email}>{user?.emailAddresses?.[0]?.emailAddress}</Text>
        </View>
      </View>
      <Text style={s.sectionLabel}>INTEGRATIONS</Text>
      <View style={s.section}>
        <View style={s.row}><Text style={s.rowLabel}>Google Business</Text><View style={s.connected}><View style={s.greenDot} /><Text style={s.connectedText}>Connected</Text></View></View>
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}><Text style={s.rowLabel}>Zapier</Text><Text style={s.grayText}>Not connected</Text></View>
      </View>
      <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
      <View style={s.section}>
        {[
          { label: 'Anomaly alerts', value: anomalyAlerts, toggle: setAnomalyAlerts },
          { label: 'Weekly NPS digest', value: weeklyDigest, toggle: setWeeklyDigest },
          { label: 'New review received', value: newReview, toggle: setNewReview },
        ].map((item, i) => (
          <View key={i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}>
            <Text style={s.rowLabel}>{item.label}</Text>
            <Switch value={item.value} onValueChange={item.toggle} trackColor={{ true: '#4F46E5' }} />
          </View>
        ))}
      </View>
      <Text style={s.sectionLabel}>COMING SOON</Text>
      <View style={[s.section, { opacity: 0.5 }]}>
        <View style={s.row}><Text style={s.rowLabel}>🎁 Loyalty Program Management</Text><Text style={s.lockIcon}>🔒</Text></View>
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}><Text style={s.rowLabel}>💬 Support Queue</Text><Text style={s.lockIcon}>🔒</Text></View>
      </View>
      <Pressable style={s.signOutBtn} onPress={handleSignOut}><Text style={s.signOutText}>Sign Out</Text></Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  email: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', paddingHorizontal: 20, marginBottom: 6, marginTop: 16, letterSpacing: 0.7 },
  section: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  connected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  connectedText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  grayText: { fontSize: 13, color: '#9ca3af' },
  lockIcon: { fontSize: 16 },
  signOutBtn: { margin: 16, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  signOutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
})
