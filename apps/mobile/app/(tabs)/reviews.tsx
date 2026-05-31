import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Chip, EmptyState, ErrorState, LoadingBlock, ScreenHeader, colors, formatDate } from '../../components/ui'
import { type Review, useReviews } from '../../hooks/useReviews'

function Stars({ rating }: { rating: number }) {
  return (
    <View style={s.stars} accessibilityLabel={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons key={i} name={i < Math.round(rating) ? 'star' : 'star-outline'} size={15} color="#f59e0b" />
      ))}
    </View>
  )
}

function ReviewCard({ review, onReply }: { review: Review; onReply: () => void }) {
  const initial = review.author.trim().charAt(0).toUpperCase() || '?'
  return (
    <View style={s.reviewCard}>
      <View style={s.reviewTop}>
        <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.author} numberOfLines={1}>{review.author || 'Anonymous'}</Text>
          <Stars rating={review.rating} />
        </View>
        <Text style={s.date}>{formatDate(review.date)}</Text>
      </View>
      <Text style={s.reviewText}>{review.text || 'No written review.'}</Text>
      <View style={s.reviewFooter}>
        {review.replied ? (
          <View style={[s.statusBadge, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.green} />
            <Text style={[s.statusText, { color: colors.green }]}>Replied</Text>
          </View>
        ) : (
          <Pressable style={s.replyButton} onPress={onReply}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
            <Text style={s.replyButtonText}>Reply</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets()
  const [page, setPage] = useState(1)
  const { reviews, meta, isLoading, isFetching, isError, error, submitReply } = useReviews(page)
  const [replyTarget, setReplyTarget] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewItems, setReviewItems] = useState<Review[]>([])

  useEffect(() => {
    setReviewItems((prev) => page === 1 ? reviews : [...prev, ...reviews.filter((next) => !prev.some((existing) => existing.id === next.id))])
  }, [page, reviews])

  async function handleSubmitReply() {
    if (!replyTarget || !replyText.trim()) return
    setSubmitting(true)
    try {
      await submitReply(replyTarget.id, replyText)
      setReplyTarget(null)
      setReplyText('')
      Alert.alert('Reply saved', 'The review is now marked as replied.')
    } catch (e) {
      Alert.alert('Reply failed', (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const replied = reviewItems.filter((r) => r.replied).length
  const needsReply = reviewItems.length - replied

  return (
    <View style={s.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="Responses"
          subtitle="Google reviews and reply follow-up"
          right={<Chip label="Google" active />}
        />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {meta ? (
          <View style={s.summaryCard}>
            <View style={s.scoreBlock}>
              <Text style={s.overallScore}>{meta.overallRating?.toFixed(1) ?? '--'}</Text>
              <Stars rating={meta.overallRating ?? 0} />
              <Text style={s.reviewCount}>{meta.total} total reviews</Text>
            </View>
            <View style={s.summaryStats}>
              <View style={s.statRow}><Text style={s.statLabel}>Needs reply</Text><Text style={s.statValue}>{needsReply}</Text></View>
              <View style={s.statRow}><Text style={s.statLabel}>Replied</Text><Text style={s.statValue}>{replied}</Text></View>
            </View>
          </View>
        ) : null}

        {isLoading ? <LoadingBlock label="Loading responses" /> : null}
        {isError ? <ErrorState message={(error as Error | null)?.message ?? 'Unable to load responses.'} /> : null}
        {!isLoading && !isError && reviewItems.length === 0 ? (
          <EmptyState icon="chatbubble-ellipses-outline" title="No responses yet" body="Connect Google Business in Settings to import reviews and manage replies here." />
        ) : null}

        {reviewItems.length > 0 ? (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Latest reviews</Text>
            {isFetching && !isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
        ) : null}

        {reviewItems.map((review) => (
          <ReviewCard key={review.id} review={review} onReply={() => { setReplyTarget(review); setReplyText('') }} />
        ))}

        {meta?.hasMore ? (
          <Pressable style={s.loadMoreButton} onPress={() => setPage((p) => p + 1)} disabled={isFetching}>
            {isFetching ? <ActivityIndicator color={colors.primary} /> : <Text style={s.loadMoreText}>Load more</Text>}
          </Pressable>
        ) : null}
      </ScrollView>

      {replyTarget ? (
        <View style={s.overlay}>
          <View style={[s.replyHeader, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.replyTitle}>Reply to {replyTarget?.author ?? 'review'}</Text>
              <Text style={s.replySub} numberOfLines={1}>{replyTarget?.text}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close reply composer" onPress={() => setReplyTarget(null)} style={s.closeButton}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <View style={s.replyBody}>
            <TextInput
              style={s.replyInput}
              placeholder="Thank you for your feedback..."
              multiline
              value={replyText}
              onChangeText={setReplyText}
              maxLength={1500}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{replyText.length} / 1500</Text>
            <Pressable style={[s.submitButton, (!replyText.trim() || submitting) && s.disabled]} onPress={handleSubmitReply} disabled={!replyText.trim() || submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit reply</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 20, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  stars: { flexDirection: 'row', gap: 1, alignItems: 'center' },
  summaryCard: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 16 },
  scoreBlock: { width: 112, alignItems: 'center', justifyContent: 'center' },
  overallScore: { fontSize: 42, lineHeight: 48, fontWeight: '900', color: colors.ink },
  reviewCount: { marginTop: 4, fontSize: 12, color: colors.muted, fontWeight: '700', textAlign: 'center' },
  summaryStats: { flex: 1, gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  statLabel: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  statValue: { fontSize: 17, color: colors.ink, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 14 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  author: { fontSize: 14, lineHeight: 19, color: colors.ink, fontWeight: '800' },
  date: { fontSize: 12, color: colors.faint, fontWeight: '700' },
  reviewText: { marginTop: 10, fontSize: 14, lineHeight: 20, color: colors.muted },
  reviewFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontSize: 12, fontWeight: '800' },
  replyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  replyButtonText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  loadMoreButton: { height: 44, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  replyTitle: { fontSize: 19, lineHeight: 25, color: colors.ink, fontWeight: '800' },
  replySub: { marginTop: 2, fontSize: 13, color: colors.muted },
  closeButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  replyBody: { flex: 1, padding: 20 },
  replyInput: { minHeight: 150, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14, fontSize: 15, lineHeight: 21, color: colors.ink },
  charCount: { marginTop: 6, textAlign: 'right', color: colors.faint, fontSize: 12, fontWeight: '700' },
  submitButton: { height: 48, marginTop: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
})
