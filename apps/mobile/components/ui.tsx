import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

export const colors = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  ink: '#111827',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  green: '#059669',
  greenSoft: '#ecfdf5',
  amber: '#d97706',
  amberSoft: '#fffbeb',
  red: '#dc2626',
  redSoft: '#fef2f2',
  blue: '#0284c7',
  blueSoft: '#f0f9ff',
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <View style={ui.header}>
      <View style={{ flex: 1 }}>
        <Text style={ui.headerTitle}>{title}</Text>
        {subtitle ? <Text style={ui.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  )
}

export function IconButton({
  name,
  label,
  onPress,
  disabled,
}: {
  name: ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[ui.iconButton, disabled && ui.disabled]}>
      <Ionicons name={name} size={20} color="#fff" />
    </Pressable>
  )
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[ui.chip, active && ui.chipActive]}>
      <Text style={[ui.chipText, active && ui.chipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

export function EmptyState({ icon, title, body }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  return (
    <View style={ui.state}>
      <View style={ui.stateIcon}><Ionicons name={icon} size={24} color={colors.primary} /></View>
      <Text style={ui.stateTitle}>{title}</Text>
      <Text style={ui.stateBody}>{body}</Text>
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const friendlyMessage = message === 'Failed to fetch' ? 'Unable to reach the CustomerEQ API.' : message
  return (
    <View style={[ui.state, { borderColor: '#fecaca', backgroundColor: colors.redSoft }]}>
      <View style={[ui.stateIcon, { backgroundColor: '#fee2e2' }]}><Ionicons name="warning-outline" size={24} color={colors.red} /></View>
      <Text style={ui.stateTitle}>Something went wrong</Text>
      <Text style={ui.stateBody}>{friendlyMessage}</Text>
      {onRetry ? (
        <Pressable style={ui.retryButton} onPress={onRetry}>
          <Text style={ui.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={ui.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={ui.loadingText}>{label}</Text>
    </View>
  )
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function statusColor(status: string | null | undefined) {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return { bg: colors.greenSoft, fg: colors.green }
    case 'PAUSED':
      return { bg: colors.amberSoft, fg: colors.amber }
    case 'STOPPED':
      return { bg: '#f1f5f9', fg: colors.muted }
    case 'DRAFT':
      return { bg: colors.blueSoft, fg: colors.blue }
    default:
      return { bg: '#f1f5f9', fg: colors.muted }
  }
}

export const ui = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.ink },
  headerSubtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.muted },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.45 },
  chip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: '#c7d2fe' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: colors.primary },
  state: {
    marginTop: 12,
    padding: 18,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stateTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  stateBody: { marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  retryButton: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  retryText: { color: colors.red, fontWeight: '800', fontSize: 13 },
  loading: { gap: 10, paddingVertical: 36, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
})
