import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { freshPresetFor, type SurveyType } from '../../../../packages/shared/src/surveyPresets'
import { Chip, EmptyState, ErrorState, IconButton, LoadingBlock, ScreenHeader, colors, formatDate, statusColor } from '../../components/ui'
import { type CreateSurveyInput, type Survey, type SurveyQuestion, usePrograms, useSurveys } from '../../hooks/useSurveys'
import { type ResponseFilters, type Verbatim, useSurveyDetail } from '../../hooks/useSurveyDetail'

const FILTERS = ['All', 'Draft', 'Active', 'Paused', 'Stopped'] as const
type Filter = typeof FILTERS[number]

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  NPS: { bg: colors.primarySoft, fg: colors.primary },
  CSAT: { bg: colors.blueSoft, fg: colors.blue },
  CES: { bg: colors.amberSoft, fg: colors.amber },
  CUSTOM: { bg: '#f1f5f9', fg: colors.muted },
}

const RESPONSE_POLICIES = [
  { value: 'ONCE', label: 'Once', desc: 'One response per member' },
  { value: 'MULTIPLE', label: 'Multiple', desc: 'Members can respond more than once' },
  { value: 'LATEST_OVERWRITES', label: 'Latest wins', desc: 'Newest response replaces the prior one' },
] as const

function questionPreset(type: SurveyType): SurveyQuestion[] {
  const preset = freshPresetFor(type)
  if (preset.length === 0) {
    return [{ id: `q_${Date.now()}`, text: 'What would you like to ask?', type: 'text', required: true, config: { multiline: true } }]
  }
  return preset.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type as SurveyQuestion['type'],
    required: q.required ?? true,
    config: q.config ?? {},
    isScoreField: q.isScoreField,
  }))
}

function TypeBadge({ type }: { type: string }) {
  const tone = TYPE_COLORS[type] ?? TYPE_COLORS.CUSTOM
  return (
    <View style={[s.badge, { backgroundColor: tone.bg }]}>
      <Text style={[s.badgeText, { color: tone.fg }]}>{type}</Text>
    </View>
  )
}

function SurveyCard({ survey, onPress }: { survey: Survey; onPress: () => void }) {
  const status = statusColor(survey.status)
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{survey.title || survey.name || 'Untitled survey'}</Text>
          {survey.name && survey.title && survey.name !== survey.title ? <Text style={s.cardSub} numberOfLines={1}>{survey.name}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </View>
      <View style={s.cardMeta}>
        <TypeBadge type={survey.type} />
        <View style={[s.badge, { backgroundColor: status.bg }]}>
          <Text style={[s.badgeText, { color: status.fg }]}>{survey.status}</Text>
        </View>
      </View>
      <View style={s.statLine}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{survey.responseCount ?? 0}</Text>
          <Text style={s.statLabel}>Responses</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{survey.score != null ? survey.score.toFixed(1) : '--'}</Text>
          <Text style={s.statLabel}>Avg score</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{formatDate(survey.createdAt) || '--'}</Text>
          <Text style={s.statLabel}>Created</Text>
        </View>
      </View>
    </Pressable>
  )
}

function ResponseCard({ response }: { response: Verbatim }) {
  const sentimentTone = response.sentiment === 'positive'
    ? { bg: colors.greenSoft, fg: colors.green }
    : response.sentiment === 'negative'
      ? { bg: colors.redSoft, fg: colors.red }
      : { bg: colors.amberSoft, fg: colors.amber }

  return (
    <View style={s.responseCard}>
      <View style={s.responseTop}>
        <Text style={s.responseScore}>{response.score ?? '--'}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.responseMember} numberOfLines={1}>{response.memberName || response.memberEmail || 'Anonymous response'}</Text>
          <Text style={s.responseDate}>{formatDate(response.completedAt)}{response.channel ? ` - ${response.channel}` : ''}</Text>
        </View>
        {response.sentiment ? (
          <View style={[s.badge, { backgroundColor: sentimentTone.bg }]}>
            <Text style={[s.badgeText, { color: sentimentTone.fg }]}>{response.sentiment}</Text>
          </View>
        ) : null}
      </View>
      {response.summary ? <Text style={s.responseSummary}>{response.summary}</Text> : null}
      {response.textResponses.length > 0 ? (
        response.textResponses.map((tr, index) => <Text key={`${response.id}-${index}`} style={s.responseText}>{tr.text}</Text>)
      ) : (
        <Text style={s.noText}>No written answer</Text>
      )}
    </View>
  )
}

export default function SurveysScreen() {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<Filter>('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detailFilters, setDetailFilters] = useState<ResponseFilters>({})
  const [responses, setResponses] = useState<Verbatim[]>([])

  const [step, setStep] = useState(1)
  const [surveyName, setSurveyName] = useState('')
  const [surveyTitle, setSurveyTitle] = useState('')
  const [surveyDesc, setSurveyDesc] = useState('')
  const [surveyType, setSurveyType] = useState<SurveyType>('NPS')
  const [responsePolicy, setResponsePolicy] = useState<CreateSurveyInput['responsePolicy']>('ONCE')
  const [questions, setQuestions] = useState<SurveyQuestion[]>(questionPreset('NPS'))
  const [programId, setProgramId] = useState<string | undefined>()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  const { data: surveys, isLoading, isError, error, refetch, createSurvey } = useSurveys()
  const { data: programs } = usePrograms()
  const { data: detail, isLoading: detailLoading, isError: detailError } = useSurveyDetail(selectedSurvey?.id ?? null, detailPage, detailFilters)

  useEffect(() => {
    if (!programId && programs?.[0]?.id) setProgramId(programs[0].id)
  }, [programId, programs])

  useEffect(() => {
    if (!detail?.items) return
    setResponses((prev) => detailPage === 1 ? detail.items : [...prev, ...detail.items.filter((next) => !prev.some((existing) => existing.id === next.id))])
  }, [detail, detailPage])

  const filtered = useMemo(() => {
    if (filter === 'All') return surveys
    return surveys.filter((survey) => survey.status?.toUpperCase() === filter.toUpperCase())
  }, [filter, surveys])

  const totalResponses = surveys.reduce((sum, survey) => sum + (survey.responseCount ?? 0), 0)
  const activeCount = surveys.filter((survey) => survey.status === 'ACTIVE').length

  function resetCreate() {
    setStep(1)
    setSurveyName('')
    setSurveyTitle('')
    setSurveyDesc('')
    setSurveyType('NPS')
    setResponsePolicy('ONCE')
    setQuestions(questionPreset('NPS'))
    setProgramId(programs?.[0]?.id)
    setEditingIndex(null)
    setEditingText('')
  }

  function selectType(type: SurveyType) {
    setSurveyType(type)
    setQuestions(questionPreset(type))
    setEditingIndex(null)
  }

  function openDetail(survey: Survey) {
    setSelectedSurvey(survey)
    setDetailPage(1)
    setDetailFilters({})
    setResponses([])
  }

  function updateDetailFilter(next: ResponseFilters) {
    setDetailPage(1)
    setResponses([])
    setDetailFilters(next)
  }

  function saveQuestion() {
    if (editingIndex === null) return
    const text = editingText.trim()
    if (!text) return
    setQuestions((prev) => prev.map((q, index) => index === editingIndex ? { ...q, text } : q))
    setEditingIndex(null)
    setEditingText('')
  }

  function addTextQuestion() {
    setQuestions((prev) => [...prev, { id: `q_${Date.now()}`, type: 'text', text: 'Anything else you would like us to know?', required: false, config: { multiline: true } }])
  }

  async function handleCreate() {
    if (!surveyName.trim()) {
      Alert.alert('Name required', 'Add an internal survey name before continuing.')
      return
    }
    if (!programId) {
      Alert.alert('Program required', 'Create a loyalty program before creating a survey.')
      return
    }
    try {
      await createSurvey.mutateAsync({
        name: surveyName.trim(),
        title: surveyTitle.trim() || surveyName.trim(),
        description: surveyDesc.trim() || undefined,
        type: surveyType,
        programId,
        responsePolicy,
        questions,
      })
      setCreateOpen(false)
      resetCreate()
    } catch (e) {
      Alert.alert('Survey not created', (e as Error).message)
    }
  }

  return (
    <View style={s.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="Surveys"
          subtitle={`${activeCount} active - ${totalResponses} total responses`}
          right={<IconButton name="add" label="Create survey" onPress={() => { resetCreate(); setCreateOpen(true) }} />}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroller} contentContainerStyle={s.filterContent}>
        {FILTERS.map((item) => <Chip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />)}
      </ScrollView>

      <ScrollView contentContainerStyle={s.content}>
        {isLoading ? <LoadingBlock label="Loading surveys" /> : null}
        {isError ? <ErrorState message={(error as Error | null)?.message ?? 'Unable to load surveys.'} onRetry={() => refetch()} /> : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <EmptyState icon="clipboard-outline" title="No surveys here" body={filter === 'All' ? 'Create a survey to start collecting CX signals.' : `No ${filter.toLowerCase()} surveys match this view.`} />
        ) : null}
        {filtered.map((survey) => <SurveyCard key={survey.id} survey={survey} onPress={() => openDetail(survey)} />)}
      </ScrollView>

      {selectedSurvey ? (
        <View style={s.overlay}>
          <View style={[s.sheetHeader, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle} numberOfLines={1}>{selectedSurvey?.title || selectedSurvey?.name}</Text>
              <Text style={s.sheetSub}>{detail?.total ?? selectedSurvey?.responseCount ?? 0} responses</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close survey responses" onPress={() => setSelectedSurvey(null)} style={s.closeButton}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <View style={s.detailFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {(['positive', 'neutral', 'negative'] as const).map((sentiment) => (
                <Chip key={sentiment} label={sentiment} active={detailFilters.sentiment === sentiment} onPress={() => updateDetailFilter({ ...detailFilters, sentiment: detailFilters.sentiment === sentiment ? undefined : sentiment })} />
              ))}
              {(['promoter', 'passive', 'detractor'] as const).map((scoreBand) => (
                <Chip key={scoreBand} label={scoreBand} active={detailFilters.scoreBand === scoreBand} onPress={() => updateDetailFilter({ ...detailFilters, scoreBand: detailFilters.scoreBand === scoreBand ? undefined : scoreBand })} />
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={s.content}>
            {detailLoading && detailPage === 1 ? <LoadingBlock label="Loading responses" /> : null}
            {detailError ? <ErrorState message="Unable to load survey responses." /> : null}
            {!detailLoading && !detailError && responses.length === 0 ? (
              <EmptyState icon="document-text-outline" title="No matching responses" body="Change the filters or wait for new responses to arrive." />
            ) : null}
            {responses.map((response) => <ResponseCard key={response.id} response={response} />)}
            {detail?.hasMore ? (
              <Pressable style={s.loadMoreButton} onPress={() => setDetailPage((page) => page + 1)} disabled={detailLoading}>
                {detailLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={s.loadMoreText}>Load more</Text>}
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {createOpen ? (
        <View style={s.overlay}>
          <View style={[s.sheetHeader, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{step === 1 ? 'New survey' : step === 2 ? 'Questions' : 'Review'}</Text>
              <Text style={s.sheetSub}>Step {step} of 3</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close survey creator" onPress={() => setCreateOpen(false)} style={s.closeButton}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>

          {step === 1 ? (
            <ScrollView contentContainerStyle={s.formContent}>
              <Text style={s.label}>Internal name</Text>
              <TextInput style={s.input} placeholder="Q3 post-purchase NPS" value={surveyName} onChangeText={setSurveyName} />
              <Text style={s.label}>Respondent title</Text>
              <TextInput style={s.input} placeholder="Tell us about your experience" value={surveyTitle} onChangeText={setSurveyTitle} />
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, s.textArea]} placeholder="Optional internal notes" value={surveyDesc} onChangeText={setSurveyDesc} multiline textAlignVertical="top" />
              <Text style={s.label}>Survey type</Text>
              <View style={s.optionGrid}>
                {(['NPS', 'CSAT', 'CES', 'CUSTOM'] as SurveyType[]).map((type) => (
                  <Pressable key={type} style={[s.typeOption, surveyType === type && s.typeOptionActive]} onPress={() => selectType(type)}>
                    <Text style={[s.typeOptionText, surveyType === type && s.typeOptionTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.label}>Response policy</Text>
              {RESPONSE_POLICIES.map((policy) => (
                <Pressable key={policy.value} style={[s.policyOption, responsePolicy === policy.value && s.policyOptionActive]} onPress={() => setResponsePolicy(policy.value)}>
                  <Text style={s.policyTitle}>{policy.label}</Text>
                  <Text style={s.policyDesc}>{policy.desc}</Text>
                </Pressable>
              ))}
              {programs && programs.length > 1 ? (
                <>
                  <Text style={s.label}>Program</Text>
                  <View style={s.optionGrid}>
                    {programs.map((program) => (
                      <Pressable key={program.id} style={[s.programOption, programId === program.id && s.typeOptionActive]} onPress={() => setProgramId(program.id)}>
                        <Text style={[s.programText, programId === program.id && s.typeOptionTextActive]} numberOfLines={1}>{program.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              <Pressable style={[s.primaryButton, !surveyName.trim() && s.disabled]} disabled={!surveyName.trim()} onPress={() => setStep(2)}>
                <Text style={s.primaryText}>Next: questions</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {step === 2 ? (
            <ScrollView contentContainerStyle={s.formContent}>
              {editingIndex !== null ? (
                <View>
                  <Text style={s.label}>Question text</Text>
                  <TextInput style={[s.input, s.textArea]} value={editingText} onChangeText={setEditingText} multiline autoFocus textAlignVertical="top" />
                  <View style={s.buttonRow}>
                    <Pressable style={[s.primaryButton, { flex: 1 }]} onPress={saveQuestion}><Text style={s.primaryText}>Save</Text></Pressable>
                    <Pressable style={[s.secondaryButton, { flex: 1 }]} onPress={() => setEditingIndex(null)}><Text style={s.secondaryText}>Cancel</Text></Pressable>
                  </View>
                </View>
              ) : (
                <>
                  {questions.map((question, index) => (
                    <Pressable key={question.id} style={s.questionCard} onPress={() => { setEditingIndex(index); setEditingText(question.text) }}>
                      <View style={s.questionNumber}><Text style={s.questionNumberText}>{index + 1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.questionText}>{question.text}</Text>
                        <Text style={s.questionMeta}>{question.type}{question.required ? ' - required' : ' - optional'}{question.isScoreField ? ' - score field' : ''}</Text>
                      </View>
                      {!question.required ? (
                        <Pressable accessibilityLabel="Remove question" onPress={() => setQuestions((prev) => prev.filter((_, i) => i !== index))} hitSlop={12}>
                          <Ionicons name="trash-outline" size={18} color={colors.red} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable style={s.secondaryButton} onPress={addTextQuestion}><Text style={s.secondaryText}>Add open-text question</Text></Pressable>
                  <View style={s.buttonRow}>
                    <Pressable style={[s.secondaryButton, { flex: 1 }]} onPress={() => setStep(1)}><Text style={s.secondaryText}>Back</Text></Pressable>
                    <Pressable style={[s.primaryButton, { flex: 1 }]} onPress={() => setStep(3)}><Text style={s.primaryText}>Review</Text></Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          ) : null}

          {step === 3 ? (
            <ScrollView contentContainerStyle={s.formContent}>
              <View style={s.previewCard}>
                <Text style={s.previewTitle}>{surveyTitle || surveyName || 'Untitled survey'}</Text>
                <View style={s.cardMeta}><TypeBadge type={surveyType} /><Chip label={responsePolicy.replace(/_/g, ' ').toLowerCase()} /></View>
                {surveyDesc ? <Text style={s.previewDesc}>{surveyDesc}</Text> : null}
                {questions.map((question, index) => <Text key={question.id} style={s.previewQuestion}>{index + 1}. {question.text}</Text>)}
              </View>
              <Pressable style={[s.primaryButton, createSurvey.isPending && s.disabled]} onPress={handleCreate} disabled={createSurvey.isPending}>
                {createSurvey.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Create survey</Text>}
              </Pressable>
              <Pressable style={s.secondaryButton} onPress={() => setStep(2)}><Text style={s.secondaryText}>Back to questions</Text></Pressable>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 20, backgroundColor: colors.bg },
  filterScroller: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, flexGrow: 0 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.ink },
  cardSub: { marginTop: 2, fontSize: 12, color: colors.faint, fontWeight: '700' },
  cardMeta: { marginTop: 10, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'capitalize' },
  statLine: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statItem: { flex: 1, borderRadius: 8, backgroundColor: '#f8fafc', padding: 10 },
  statValue: { fontSize: 15, fontWeight: '900', color: colors.ink },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: '700', color: colors.faint },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  sheetTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800', color: colors.ink },
  sheetSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  closeButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  detailFilters: { paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  responseCard: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 14 },
  responseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  responseScore: { width: 42, fontSize: 25, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  responseMember: { fontSize: 14, fontWeight: '800', color: colors.ink },
  responseDate: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.faint },
  responseSummary: { marginTop: 10, fontSize: 14, lineHeight: 20, color: colors.ink, fontWeight: '600' },
  responseText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  noText: { marginTop: 8, fontSize: 13, color: colors.faint, fontStyle: 'italic' },
  loadMoreButton: { height: 44, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  formContent: { padding: 20, gap: 10, paddingBottom: 32 },
  label: { marginTop: 4, fontSize: 13, fontWeight: '800', color: colors.ink },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  textArea: { minHeight: 92 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeOption: { flexBasis: '47%', flexGrow: 1, minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  typeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeOptionText: { fontSize: 15, fontWeight: '900', color: colors.muted },
  typeOptionTextActive: { color: colors.primary },
  programOption: { flexBasis: '47%', flexGrow: 1, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  programText: { fontSize: 13, fontWeight: '800', color: colors.muted },
  policyOption: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12 },
  policyOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  policyTitle: { fontSize: 14, color: colors.ink, fontWeight: '800' },
  policyDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.muted },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  questionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12 },
  questionNumber: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  questionNumberText: { fontSize: 13, fontWeight: '900', color: colors.primary },
  questionText: { fontSize: 14, lineHeight: 19, color: colors.ink, fontWeight: '700' },
  questionMeta: { marginTop: 2, fontSize: 12, color: colors.faint, fontWeight: '700' },
  previewCard: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16 },
  previewTitle: { fontSize: 20, lineHeight: 26, color: colors.ink, fontWeight: '900' },
  previewDesc: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.muted },
  previewQuestion: { marginTop: 10, fontSize: 14, lineHeight: 20, color: colors.ink },
})
