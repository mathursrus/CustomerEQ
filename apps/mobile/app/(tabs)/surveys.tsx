import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useSurveys } from '../../hooks/useSurveys'
import { useSurveyDetail } from '../../hooks/useSurveyDetail'

const FILTERS = ['All', 'Active', 'Paused', 'Completed'] as const
type Filter = typeof FILTERS[number]
const TYPE_COLORS: Record<string, string> = { NPS: '#4F46E5', CSAT: '#0ea5e9', STAR: '#f59e0b', CES: '#8b5cf6' }

export default function SurveysScreen() {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [selectedSurveyName, setSelectedSurveyName] = useState('')
  const [step, setStep] = useState(1)
  const [surveyName, setSurveyName] = useState('')
  const [surveyType, setSurveyType] = useState('NPS')
  const { data: surveys = [], isLoading } = useSurveys()
  const { data: verbatims = [], isLoading: verbatimsLoading } = useSurveyDetail(selectedSurveyId)

  const filtered = filter === 'All' ? surveys : surveys.filter((s) => s.status?.toUpperCase() === filter.toUpperCase())

  function publishSurvey() {
    setCreateOpen(false)
    setStep(1)
    setSurveyName('')
    setSurveyType('NPS')
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>Surveys</Text>
        <Pressable style={s.addBtn} onPress={() => setCreateOpen(true)}>
          <Text style={s.addBtnText}>+</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {FILTERS.map((f) => (
          <Pressable key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {isLoading && <ActivityIndicator color="#4F46E5" />}
        {filtered.map((sv) => (
          <Pressable key={sv.id} style={s.card} onPress={() => { setSelectedSurveyId(sv.id); setSelectedSurveyName(sv.name) }}>
            <View style={s.cardTop}>
              <Text style={s.cardName}>{sv.name}</Text>
              <View style={[s.typeBadge, { backgroundColor: TYPE_COLORS[sv.type] ?? '#6b7280' }]}>
                <Text style={s.typeBadgeText}>{sv.type}</Text>
              </View>
            </View>
            <View style={s.cardMeta}>
              <Text style={s.cardMetaText}>{sv.responseCount ?? 0} responses</Text>
              <Text style={s.cardMetaText}>Score: {sv.score ?? '--'}</Text>
              <View style={[s.statusChip, { backgroundColor: sv.status === 'ACTIVE' ? '#ecfdf5' : sv.status === 'PAUSED' ? '#fff7ed' : '#f3f4f6' }]}>
                <Text style={[s.statusText, { color: sv.status === 'ACTIVE' ? '#059669' : sv.status === 'PAUSED' ? '#d97706' : '#6b7280' }]}>{sv.status}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {/* Survey Detail Sheet — AC3 */}
      <Modal visible={!!selectedSurveyId} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{selectedSurveyName}</Text>
            <Pressable onPress={() => setSelectedSurveyId(null)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.formLabel}>RECENT VERBATIMS</Text>
            {verbatimsLoading && <ActivityIndicator color="#4F46E5" style={{ marginTop: 20 }} />}
            {verbatims.length === 0 && !verbatimsLoading && (
              <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>No responses yet.</Text>
            )}
            {verbatims.map((v, i) => (
              <View key={v.id ?? i} style={s.verbatimCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {v.score !== null && <Text style={{ fontSize: 22, fontWeight: '800', color: '#4F46E5' }}>{v.score}</Text>}
                  {v.sentiment && (
                    <View style={[s.sentimentChip, { backgroundColor: v.sentiment === 'positive' ? '#ecfdf5' : v.sentiment === 'negative' ? '#fef2f2' : '#f3f4f6' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: v.sentiment === 'positive' ? '#059669' : v.sentiment === 'negative' ? '#dc2626' : '#6b7280' }}>{v.sentiment}</Text>
                    </View>
                  )}
                </View>
                {v.textResponses?.map((tr, j) => (
                  tr.text ? <Text key={j} style={s.verbatimText}>&ldquo;{tr.text}&rdquo;</Text> : null
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
      {/* Create Survey Modal */}
      <Modal visible={createOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{step === 1 ? 'New Survey' : step === 2 ? 'Add Questions' : 'Preview'}</Text>
            <Pressable onPress={() => setCreateOpen(false)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          <View style={s.stepDots}>
            {[1,2,3].map((i) => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}
          </View>
          {step === 1 && (
            <ScrollView style={s.modalBody}>
              <Text style={s.formLabel}>Survey Name</Text>
              <TextInput style={s.formInput} placeholder="e.g. Post-Purchase NPS" value={surveyName} onChangeText={setSurveyName} />
              <Text style={s.formLabel}>Survey Type</Text>
              <View style={s.typeGrid}>
                {['NPS', 'CSAT', 'Custom', 'CES'].map((t) => (
                  <Pressable key={t} style={[s.typeOpt, surveyType === t && s.typeOptSel]} onPress={() => setSurveyType(t)}>
                    <Text style={[s.typeOptText, surveyType === t && s.typeOptTextSel]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={s.nextBtn} onPress={() => setStep(2)}><Text style={s.nextBtnText}>Next: Add Questions →</Text></Pressable>
            </ScrollView>
          )}
          {step === 2 && (
            <ScrollView style={s.modalBody}>
              {['Q1: How likely are you to recommend us? (NPS)', 'Q2: Rate your checkout experience (1-5★)', 'Q3: Which area needs improvement? (Choice)', 'Q4: Any other comments? (Open Text)'].map((q, i) => (
                <View key={i} style={s.qCard}>
                  <View style={s.qNum}><Text style={s.qNumText}>{i+1}</Text></View>
                  <Text style={s.qText}>{q}</Text>
                </View>
              ))}
              <Pressable style={s.nextBtn} onPress={() => setStep(3)}><Text style={s.nextBtnText}>Preview →</Text></Pressable>
            </ScrollView>
          )}
          {step === 3 && (
            <ScrollView style={s.modalBody}>
              <Text style={s.previewTitle}>{surveyName || 'Untitled Survey'}</Text>
              <Text style={s.previewSubtitle}>4 questions · {surveyType}</Text>
              <View style={s.previewCard}>
                <Text style={s.previewQ}>Q1: How likely are you to recommend us?</Text>
                <View style={s.npsRow}>{Array.from({length:11},(_,i)=>(
                  <Pressable key={i} style={s.npsBtn}><Text style={s.npsBtnText}>{i}</Text></Pressable>
                ))}</View>
              </View>
              <Pressable style={[s.nextBtn, { backgroundColor: '#059669' }]} onPress={publishSurvey}><Text style={s.nextBtnText}>🚀 Publish Survey</Text></Pressable>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '300', lineHeight: 26 },
  filterRow: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#eef2ff' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#4F46E5', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  typeBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMetaText: { fontSize: 12, color: '#6b7280' },
  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { fontSize: 18, color: '#6b7280' },
  stepDots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive: { width: 20, borderRadius: 4, backgroundColor: '#4F46E5' },
  modalBody: { flex: 1, padding: 20 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  typeOpt: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  typeOptSel: { borderColor: '#4F46E5', backgroundColor: '#eef2ff' },
  typeOptText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  typeOptTextSel: { color: '#4F46E5' },
  nextBtn: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  qCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  qNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  qNumText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  qText: { flex: 1, fontSize: 13, color: '#374151' },
  previewTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  previewSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  previewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  previewQ: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 12 },
  npsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  npsBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  npsBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  verbatimCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  sentimentChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  verbatimText: { fontSize: 13, color: '#374151', lineHeight: 18, fontStyle: 'italic' },
})
