import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Modal, FlatList, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth, useUser, useOrganization, useOrganizationList } from '@clerk/clerk-expo'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { userMemberships, setActive, isLoaded: orgsLoaded } = useOrganizationList({ userMemberships: true })
  const router = useRouter()
  const queryClient = useQueryClient()
  const [anomalyAlerts, setAnomalyAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [newReview, setNewReview] = useState(true)
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  async function handleSwitchOrg(orgId: string) {
    if (!setActive) return
    setSwitching(true)
    try {
      await setActive({ organization: orgId })
      queryClient.invalidateQueries()
      setOrgPickerOpen(false)
    } finally {
      setSwitching(false)
    }
  }

  const combined = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')
  const initials = combined || (user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?')
  const memberships = userMemberships?.data ?? []

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}>
      <View style={s.header}><Text style={s.title}>Profile</Text></View>
      <View style={s.accountCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={s.email}>{user?.emailAddresses?.[0]?.emailAddress}</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>ORGANIZATION</Text>
      <View style={s.section}>
        <Pressable style={s.row} onPress={() => setOrgPickerOpen(true)} disabled={!orgsLoaded || memberships.length <= 1}>
          <View>
            <Text style={s.rowLabel}>{organization?.name ?? 'No organization'}</Text>
            {memberships.length > 1 && <Text style={s.rowSub}>Tap to switch</Text>}
          </View>
          {memberships.length > 1 && <Text style={s.chevron}>›</Text>}
        </Pressable>
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
        <View style={s.row}><Text style={s.rowLabel}>Loyalty Program Management</Text><Text style={s.lockIcon}>🔒</Text></View>
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}><Text style={s.rowLabel}>Support Queue</Text><Text style={s.lockIcon}>🔒</Text></View>
      </View>
      <Pressable style={s.signOutBtn} onPress={handleSignOut}><Text style={s.signOutText}>Sign Out</Text></Pressable>

      <Modal visible={orgPickerOpen} transparent animationType="slide" onRequestClose={() => setOrgPickerOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setOrgPickerOpen(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Switch Organization</Text>
            {switching
              ? <ActivityIndicator color="#4F46E5" style={{ marginVertical: 24 }} />
              : (
                <FlatList
                  data={memberships}
                  keyExtractor={(m) => m.organization.id}
                  renderItem={({ item: m }) => (
                    <Pressable
                      style={[s.orgRow, m.organization.id === organization?.id && s.orgRowActive]}
                      onPress={() => handleSwitchOrg(m.organization.id)}
                    >
                      <Text style={[s.orgName, m.organization.id === organization?.id && s.orgNameActive]}>
                        {m.organization.name}
                      </Text>
                      {m.organization.id === organization?.id && <Text style={s.checkmark}>✓</Text>}
                    </Pressable>
                  )}
                />
              )}
          </View>
        </Pressable>
      </Modal>
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
  rowSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  chevron: { fontSize: 20, color: '#9ca3af' },
  connected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  connectedText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  grayText: { fontSize: 13, color: '#9ca3af' },
  lockIcon: { fontSize: 16 },
  signOutBtn: { margin: 16, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  signOutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  orgRow: { padding: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orgRowActive: { backgroundColor: '#ede9fe' },
  orgName: { fontSize: 15, color: '#374151', fontWeight: '500' },
  orgNameActive: { color: '#4F46E5', fontWeight: '700' },
  checkmark: { fontSize: 16, color: '#4F46E5' },
})
