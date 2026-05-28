import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useSurveys, usePrograms, type SurveyQuestion, type CreateSurveyInput } from '../../hooks/useSurveys'
import { useSurveyDetail, type ResponseFilters } from '../../hooks/useSurveyDetail'

const FILTERS = ['All', 'Active', 'Paused', 'Completed', 'Stopped'] as const
type Filter = typeof FILTERS[number]
const TYPE_COLORS: Record<string, string> = { NPS: '#4F46E5', CSAT: '#0ea5e9', STAR: '#f59e0b', CES: '#8b5cf6', CUSTOM: '#6b7280' }

const RESPONSE_POLICIES = [
  { value: 'ONCE', label: 'Once', desc: 'One response per member' },
  { value: 'MULTIPLE', label: 'Multiple', desc: 'Members can respond again' },
  { value: 'LATEST_OVERWRITES', label: 'Latest wins', desc: 'New response replaces old' },
] as const

function defaultQuestions(type: string): SurveyQuestion[] {
  if (type === 'NPS') return [
    { id: 'q1', text: 'How likely are you to recommend us? (0–10)', type: 'rating', required: true, config: { min: 0, max: 10 } },
    { id: 'q2', text: 'What stood out most? (optional)', type: 'text', required: false, config: {} },
  ]
  if (type === 'CSAT') return [
    { id: 'q1', text: 'How satisfied were you? (1–5)', type: 'rating', required: true, config: { min: 1, max: 5 } },
    { id: 'q2', text: 'Any comments? (optional)', type: 'text', required: false, config: {} },
  ]
  if (type === 'CES') return [
    { id: 'q1', text: 'How easy was it to resolve your issue? (1–7)', type: 'rating', required: true, config: { min: 1, max: 7 } },
    { id: 'q2', text: 'Anything else to share? (optional)', type: 'text', required: false, config: {} },
  ]
  return [{ id: 'q1', text: 'Your question here', type: 'text', required: true, config: {} }]
}

export default function SurveysScreen() {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [selectedSurveyName, setSelectedSurveyName] = useState('')
  const [step, setStep] = useState(1)
  const [detailPage, setDetailPage] = useState(1)
  const [detailFilters, setDetailFilters] = useState<ResponseFilters>({})

  // Create form state
  const [surveyName, setSurveyName] = useState('')
  const [surveyTitle, setSurveyTitle] = useState('')
  const [surveyDesc, setSurveyDesc] = useState('')
  const [surveyType, setSurveyType] = useState('NPS')
  const [responsePolicy, setResponsePolicy] = useState<'ONCE' | 'MULTIPLE' | 'LATEST_OVERWRITES'>('ONCE')
  const [questions, setQuestions] = useState<SurveyQuestion[]>(defaultQuestions('NPS'))
  const [programId, setProgramId] = useState<string | undefined>()
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null)
  const [editingQText, setEditingQText] = useState('')

  const { data: surveys, isLoading, isError, createSurvey } = useSurveys()
  const { data: programs } = usePrograms()
  const { data: detail, isLoading: detailLoading } = useSurveyDetail(selectedSurveyId, detailPage, detailFilters)

  const filtered = filter === 'All' ? surveys : surveys.filter((s) => s.status?.toUpperCase() === filter.toUpperCase())

  function selectType(t: string) {
    setSurveyType(t)
    setQuestions(defaultQuestions(t))
  }

  function addQuestion() {
    const newQ: SurveyQuestion = { id: `q${Date.now()}`, text: 'New question', type: 'text', required: false, config: {} }
    setQuestions(prev => [...prev, newQ])
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  function saveQuestionText() {
    if (editingQIdx === null) return
    setQuestions(prev => prev.map((q, i) => i === editingQIdx ? { ...q, text: editingQText } : q))
    setEditingQIdx(null)
  }

  function resetCreate() {
    setStep(1); setSurveyName(''); setSurveyTitle(''); setSurveyDesc('')
    setSurveyType('NPS'); setResponsePolicy('ONCE')
    setQuestions(defaultQuestions('NPS')); setProgramId(programs?.[0]?.id)
    setEditingQIdx(null)
  }

  async function handlePublish() {
    if (!surveyName.trim()) { Alert.alert('Name required', 'Please enter a survey name.'); return }
    if (questions.length === 0) { Alert.alert('Questions required', 'Add at least one question.'); return }
    const payload: CreateSurveyInput = {
      name: surveyName.trim(),
      title: surveyTitle.trim() || surveyName.trim(),
      description: surveyDesc.trim() || undefined,
      type: surveyType,
      programId: programId ?? programs?.[0]?.id,
      responsePolicy,
      questions,
    }
    try {
      await createSurvey.mutateAsync(payload)
      setCreateOpen(false)
      resetCreate()
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Failed to create survey')
    }
  }

  function openDetail(id: string, name: string) {
    setSelectedSurveyId(id)
    setSelectedSurveyName(name)
    setDetailPage(1)
    setDetailFilters({})
  }

  function toggleSentimentFilter(s: 'positive' | 'neutral' | 'negative') {
    setDetailPage(1)
    setDetailFilters(prev => ({ ...prev, sentiment: prev.sentiment === s ? undefined : s }))
  }

  function toggleScoreFilter(band: 'promoter' | 'passive' | 'detractor') {
    setDetailPage(1)
    setDetailFilters(prev => ({ ...prev, scoreBand: prev.scoreBand === band ? undefined : band }))
  }

  const verbatims = detail?.items ?? []
  const hasMore = detail?.hasMore ?? false

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>Surveys</Text>
        <Pressable style={s.addBtn} onPress={() => { resetCreate(); setCreateOpen(true) }}>
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
        {isError && <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 32, fontSize: 14 }}>Unable to load surveys. Pull to refresh.</Text>}
        {!isLoading && !isError && filtered.length === 0 && (
          <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32, fontSize: 14 }}>No surveys yet. Tap + to create one.</Text>
        )}
        {filtered.map((sv) => (
          <Pressable key={sv.id} style={s.card} onPress={() => openDetail(sv.id, sv.name)}>
            <View style={s.cardTop}>
              <Text style={s.cardName}>{sv.title || sv.name || 'Untitled Survey'}</Text>
              <View style={[s.typeBadge, { backgroundColor: TYPE_COLORS[sv.type] ?? '#6b7280' }]}>
                <Text style={s.typeBadgeText}>{sv.type}</Text>
              </View>
            </View>
            {sv.name !== sv.title && sv.title && <Text style={s.cardSubname}>{sv.name}</Text>}
            <View style={s.cardMeta}>
              <Text style={s.cardMetaText}>{sv.responseCount ?? 0} {(sv.responseCount ?? 0) === 1 ? 'response' : 'responses'}</Text>
              <Text style={s.cardMetaText}>Score: {sv.score ?? '--'}</Text>
              <View style={[s.statusChip, { backgroundColor: sv.status === 'ACTIVE' ? '#ecfdf5' : sv.status === 'PAUSED' ? '#fff7ed' : '#f3f4f6' }]}>
                <Text style={[s.statusText, { color: sv.status === 'ACTIVE' ? '#059669' : sv.status === 'PAUSED' ? '#d97706' : '#6b7280' }]}>{sv.status}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Survey Detail Modal ─────────────────────────────────────────── */}
      <Modal visible={!!selectedSurveyId} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{selectedSurveyName}</Text>
            <Pressable onPress={() => setSelectedSurveyId(null)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          {/* Filters */}
          <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(['positive', 'neutral', 'negative'] as const).map(s2 => (
                <Pressable key={s2} style={[s.chip, detailFilters.sentiment === s2 && s.chipActive]} onPress={() => toggleSentimentFilter(s2)}>
                  <Text style={[s.chipText, detailFilters.sentiment === s2 && s.chipTextActive]}>{s2}</Text>
                </Pressable>
              ))}
              <View style={{ width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 4 }} />
              {(['promoter', 'passive', 'detractor'] as const).map(b => (
                <Pressable key={b} style={[s.chip, detailFilters.scoreBand === b && s.chipActive]} onPress={() => toggleScoreFilter(b)}>
                  <Text style={[s.chipText, detailFilters.scoreBand === b && s.chipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <ScrollView style={s.modalBody}>
            {detail?.total != null && (
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{detail.total} total {detail.total === 1 ? 'response' : 'responses'}</Text>
            )}
            {detailLoading && detailPage === 1 && <ActivityIndicator color="#4F46E5" style={{ marginTop: 20 }} />}
            {verbatims.length === 0 && !detailLoading && (
              <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>No responses match the current filters.</Text>
            )}
            {verbatims.map((v, i) => (
              <View key={v.id ?? i} style={s.verbatimCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  {v.score !== null && <Text style={{ fontSize: 22, fontWeight: '800', color: '#4F46E5' }}>{v.score}</Text>}
                  {v.sentiment && (
                    <View style={[s.sentimentChip, { backgroundColor: v.sentiment === 'positive' ? '#ecfdf5' : v.sentiment === 'negative' ? '#fef2f2' : '#f3f4f6' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: v.sentiment === 'positive' ? '#059669' : v.sentiment === 'negative' ? '#dc2626' : '#6b7280' }}>{v.sentiment}</Text>
                    </View>
                  )}
                  {v.memberName && <Text style={{ fontSize: 12, color: '#6b7280' }}>{v.memberName}</Text>}
                  {v.completedAt && <Text style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(v.completedAt).toLocaleDateString()}</Text>}
                </View>
                {v.textResponses?.map((tr, j) => (
                  tr.text ? <Text key={j} style={s.verbatimText}>&ldquo;{tr.text}&rdquo;</Text> : null
                ))}
              </View>
            ))}
            {hasMore && (
              <Pressable style={[s.nextBtn, { marginTop: 8, backgroundColor: '#f3f4f6' }]} onPress={() => setDetailPage(p => p + 1)} disabled={detailLoading}>
                {detailLoading ? <ActivityIndicator color="#4F46E5" /> : <Text style={[s.nextBtnText, { color: '#374151' }]}>Load more</Text>}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Create Survey Modal ─────────────────────────────────────────── */}
      <Modal visible={createOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{step === 1 ? 'New Survey' : step === 2 ? 'Questions' : 'Review & Publish'}</Text>
            <Pressable onPress={() => setCreateOpen(false)}><Text style={s.closeBtn}>✕</Text></Pressable>
          </View>
          <View style={s.stepDots}>
            {[1,2,3].map((i) => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}
          </View>

          {/* ── Step 1: Basics ── */}
          {step === 1 && (
            <ScrollView style={s.modalBody}>
              <Text style={s.formLabel}>Internal Name *</Text>
              <TextInput style={s.formInput} placeholder="e.g. Post-Purchase NPS Q2" value={surveyName} onChangeText={setSurveyName} />
              <Text style={s.formLabel}>Title (shown to respondents)</Text>
              <TextInput style={s.formInput} placeholder="e.g. Tell us about your experience" value={surveyTitle} onChangeText={setSurveyTitle} />
              <Text style={s.formLabel}>Description (internal notes)</Text>
              <TextInput style={[s.formInput, { height: 70 }]} placeholder="Optional context for your team" value={surveyDesc} onChangeText={setSurveyDesc} multiline />
              <Text style={s.formLabel}>Survey Type *</Text>
              <View style={s.typeGrid}>
                {['NPS', 'CSAT', 'CES', 'CUSTOM'].map((t) => (
                  <Pressable key={t} style={[s.typeOpt, surveyType === t && s.typeOptSel]} onPress={() => selectType(t)}>
                    <Text style={[s.typeOptText, surveyType === t && s.typeOptTextSel]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.formLabel}>Response Policy</Text>
              {RESPONSE_POLICIES.map((p) => (
                <Pressable key={p.value} style={[s.policyOpt, responsePolicy === p.value && s.policyOptSel]} onPress={() => setResponsePolicy(p.value)}>
                  <Text style={[s.policyLabel, responsePolicy === p.value && s.policyLabelSel]}>{p.label}</Text>
                  <Text style={s.policyDesc}>{p.desc}</Text>
                </Pressable>
              ))}
              {programs && programs.length > 1 && (
                <>
                  <Text style={s.formLabel}>Program</Text>
                  <View style={s.typeGrid}>
                    {programs.map(p => (
                      <Pressable key={p.id} style={[s.typeOpt, programId === p.id && s.typeOptSel]} onPress={() => setProgramId(p.id)}>
                        <Text style={[s.typeOptText, { fontSize: 13 }, programId === p.id && s.typeOptTextSel]}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Pressable style={[s.nextBtn, !surveyName.trim() && s.nextBtnDisabled]} onPress={() => surveyName.trim() && setStep(2)}>
                <Text style={s.nextBtnText}>Next: Questions →</Text>
              </Pressable>
            </ScrollView>
          )}

          {/* ── Step 2: Question Editor ── */}
          {step === 2 && (
            <ScrollView style={s.modalBody}>
              {editingQIdx !== null ? (
                <View>
                  <Text style={s.formLabel}>Edit question text</Text>
                  <TextInput style={[s.formInput, { height: 80 }]} value={editingQText} onChangeText={setEditingQText} multiline autoFocus />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Pressable style={[s.nextBtn, { flex: 1 }]} onPress={saveQuestionText}><Text style={s.nextBtnText}>Save</Text></Pressable>
                    <Pressable style={[s.nextBtn, { flex: 1, backgroundColor: '#f3f4f6' }]} onPress={() => setEditingQIdx(null)}><Text style={[s.nextBtnText, { color: '#374151' }]}>Cancel</Text></Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{questions.length} question{questions.length !== 1 ? 's' : ''} — tap to edit text</Text>
                  {questions.map((q, i) => (
                    <Pressable key={q.id} style={s.qCard} onPress={() => { setEditingQIdx(i); setEditingQText(q.text) }}>
                      <View style={s.qNum}><Text style={s.qNumText}>{i+1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.qText}>{q.text}</Text>
                        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{q.type}{q.required ? ' · required' : ' · optional'}</Text>
                      </View>
                      {!q.required && (
                        <Pressable onPress={() => removeQuestion(i)} hitSlop={12}>
                          <Text style={{ color: '#dc2626', fontSize: 18, paddingHorizontal: 6 }}>✕</Text>
                        </Pressable>
                      )}
                    </Pressable>
                  ))}
                  <Pressable style={[s.nextBtn, { backgroundColor: '#f3f4f6', marginTop: 4 }]} onPress={addQuestion}>
                    <Text style={[s.nextBtnText, { color: '#374151' }]}>+ Add Open-Text Question</Text>
                  </Pressable>
                  <Pressable style={[s.nextBtn, { marginTop: 10 }]} onPress={() => setStep(3)}>
                    <Text style={s.nextBtnText}>Preview →</Text>
                  </Pressable>
                  <Pressable style={[s.nextBtn, { backgroundColor: '#f3f4f6', marginTop: 8 }]} onPress={() => setStep(1)}>
                    <Text style={[s.nextBtnText, { color: '#374151' }]}>← Back to Basics</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}

          {/* ── Step 3: Preview + Publish ── */}
          {step === 3 && (
            <ScrollView style={s.modalBody}>
              <View style={s.previewCard}>
                <Text style={s.previewTitle}>{surveyTitle || surveyName || 'Untitled'}</Text>
                {surveyTitle && surveyTitle !== surveyName && <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Internal: {surveyName}</Text>}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <View style={[s.typeBadge, { backgroundColor: TYPE_COLORS[surveyType] ?? '#6b7280' }]}>
                    <Text style={s.typeBadgeText}>{surveyType}</Text>
                  </View>
                  <View style={s.chip}><Text style={s.chipText}>{responsePolicy.replace('_', ' ').toLowerCase()}</Text></View>
                </View>
                {surveyDesc ? <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{surveyDesc}</Text> : null}
                <Text style={s.formLabel}>{questions.length} QUESTION{questions.length !== 1 ? 'S' : ''}</Text>
                {questions.map((q, i) => (
                  <Text key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{i+1}. {q.text}</Text>
                ))}
              </View>
              <Pressable style={[s.nextBtn, { backgroundColor: '#059669' }, createSurvey.isPending && s.nextBtnDisabled]} onPress={handlePublish} disabled={createSurvey.isPending}>
                {createSurvey.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.nextBtnText}>🚀 Publish Survey</Text>
                }
              </Pressable>
              <Pressable style={[s.nextBtn, { backgroundColor: '#f3f4f6', marginTop: 8 }]} onPress={() => setStep(2)}>
                <Text style={[s.nextBtnText, { color: '#374151' }]}>← Back to Questions</Text>
              </Pressable>
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  cardSubname: { fontSize: 12, color: '#9ca3af', marginBottom: 6 },
  typeBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
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
  policyOpt: { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  policyOptSel: { borderColor: '#4F46E5', backgroundColor: '#eef2ff' },
  policyLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  policyLabelSel: { color: '#4F46E5' },
  policyDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  nextBtn: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  qCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  qNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  qNumText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  qText: { flex: 1, fontSize: 13, color: '#374151' },
  previewTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  previewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  verbatimCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  sentimentChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  verbatimText: { fontSize: 13, color: '#374151', lineHeight: 18, fontStyle: 'italic' },
})
