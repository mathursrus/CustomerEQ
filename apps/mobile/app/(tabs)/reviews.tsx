import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useReviews } from '../../hooks/useReviews'

function Stars({ rating }: { rating: number }) {
  return <Text style={{ color: '#f59e0b', fontSize: 14 }}>{Array.from({length:5},(_,i) => i < rating ? '★' : '☆').join('')}</Text>
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets()
  const { reviews, meta, isLoading, submitReply } = useReviews()
  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitReply() {
    if (!replyTarget || !replyText.trim()) return
    setSubmitting(true)
    await submitReply(replyTarget, replyText)
    setSubmitting(false)
    setReplyTarget(null)
    setReplyText('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>Reviews</Text>
        <View style={s.platformTab}><Text style={s.platformTabText}>Google</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {meta && (
          <View style={s.scoreCard}>
            <Text style={s.overallScore}>{meta.overallRating?.toFixed(1) ?? '--'}</Text>
            <Stars rating={Math.round(meta.overallRating ?? 0)} />
            <Text style={s.reviewCount}>({meta.total} reviews)</Text>
          </View>
        )}
        {isLoading && <ActivityIndicator color="#4F46E5" />}
        {reviews.map((r) => (
          <View key={r.id} style={s.reviewCard}>
            <View style={s.reviewTop}>
              <View style={s.avatar}><Text style={s.avatarText}>{r.author.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewAuthor}>{r.author}</Text>
                <Stars rating={r.rating} />
              </View>
              <Text style={s.reviewDate}>{r.date ? new Date(r.date).toLocaleDateString() : ''}</Text>
            </View>
            <Text style={s.reviewText} numberOfLines={2}>{r.text}</Text>
            <View style={s.reviewFooter}>
              {r.replied
                ? <View style={s.repliedChip}><Text style={s.repliedText}>Replied ✓</Text></View>
                : <Pressable style={s.replyBtn} onPress={() => setReplyTarget(r.id)}><Text style={s.replyBtnText}>Reply</Text></Pressable>
              }
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!replyTarget} animationType="slide" presentationStyle="pageSheet">
        <View style={s.replyModal}>
          <View style={s.replyHeader}>
            <Text style={s.replyTitle}>Write Reply</Text>
            <Pressable onPress={() => setReplyTarget(null)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          <View style={{ padding: 20, flex: 1 }}>
            <TextInput style={s.replyInput} placeholder="Thank you for your feedback..." multiline value={replyText} onChangeText={setReplyText} maxLength={1500} />
            <Text style={s.charCount}>{replyText.length} / 1500</Text>
            <Pressable style={s.submitBtn} onPress={handleSubmitReply} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Reply</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  platformTab: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  platformTabText: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
  scoreCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  overallScore: { fontSize: 40, fontWeight: '800', color: '#111827' },
  reviewCount: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  reviewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#9ca3af' },
  reviewText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  reviewFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  repliedChip: { backgroundColor: '#ecfdf5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  repliedText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  replyBtn: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  replyBtnText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
  replyModal: { flex: 1, backgroundColor: '#f8fafc' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  replyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { fontSize: 18, color: '#6b7280' },
  replyInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, minHeight: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
