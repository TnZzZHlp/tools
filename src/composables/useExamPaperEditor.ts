import {
  computed,
  inject,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'

import { parseExamJson, serializeExamJson } from '@/lib/exam-paper/parser'
import {
  clearDraftDocument,
  createEmptyExamDocument,
  createMathSkeletonDocument,
  createSampleExamDocument,
  loadDraftDocument,
  saveDraftDocument,
  type SectionPreset,
} from '@/lib/exam-paper/presets'
import {
  computePaperNumbering,
  computePaperStats,
  validateExamDocument,
  type PaperNumbering,
  type PaperStats,
  type ValidationIssue,
} from '@/lib/exam-paper/render'
import {
  createCompoundQuestion,
  createDefaultOptions,
  createGroupChildQuestion,
  createOption,
  createQuestionGroup,
  createSection,
  createStandardQuestion,
  createSubQuestion,
  type CompoundQuestionItem,
  type DifficultyLevel,
  type ExamDocument,
  type ExamSection,
  type GroupChildQuestion,
  type GroupDelimiterStyle,
  type QuestionGroupItem,
  type QuestionOption,
  type SectionItem,
  type SectionScoreMode,
  type StandardQuestionItem,
} from '@/lib/exam-paper/types'

export interface NavEntry {
  sectionId: string
  itemId: string
  childId?: string
  number: number
  label: string
}

export interface ItemIssueCounts {
  errors: number
  warnings: number
}

export interface OptionContainer {
  options: QuestionOption[]
}

export type AdvancedFieldKey = 'answer' | 'difficulty' | 'knowledge' | 'analysis'

export interface AdvancedFieldVisibility {
  answer: boolean
  difficulty: boolean
  knowledge: boolean
  analysis: boolean
}

export interface ExamPaperEditorContext {
  doc: Ref<ExamDocument>
  selectedSectionId: Ref<string>
  selectedItemId: Ref<string | null>
  selectedGroupChildId: Ref<string | null>
  selectedSubQuestionIndex: Ref<number>
  focusStemTick: Ref<number>
  advancedFields: Ref<AdvancedFieldVisibility>
  enabledAdvancedFieldCount: ComputedRef<number>

  canUndo: ComputedRef<boolean>
  numbering: ComputedRef<PaperNumbering>
  stats: ComputedRef<PaperStats>
  issues: ComputedRef<ValidationIssue[]>
  errorIssues: ComputedRef<ValidationIssue[]>
  warningIssues: ComputedRef<ValidationIssue[]>
  issueCountByItem: ComputedRef<Map<string, ItemIssueCounts>>
  paperKnowledgePoints: ComputedRef<string[]>

  activeSection: ComputedRef<ExamSection | null>
  activeItem: ComputedRef<SectionItem | null>
  activeGroupChild: ComputedRef<GroupChildQuestion | null>
  flatNavEntries: ComputedRef<NavEntry[]>
  activeNavIndex: ComputedRef<number>
  canGoPrev: ComputedRef<boolean>
  canGoNext: ComputedRef<boolean>

  pushUndoSnapshot: () => void
  undo: () => boolean

  selectSection: (sectionId: string) => void
  selectItem: (sectionId: string, itemId: string | null, childId?: string | null) => void
  jumpToIssue: (issue: ValidationIssue) => void
  goPrev: () => void
  goNext: () => void

  setTitle: (title: string) => void
  setSectionTitle: (sectionId: string, title: string) => void
  setSectionScoreMode: (sectionId: string, mode: SectionScoreMode) => void
  setSectionUniformScore: (sectionId: string, score: number | undefined) => void

  addSectionFromPreset: (preset: SectionPreset) => void
  moveSection: (index: number, delta: -1 | 1) => void
  removeSection: (index: number) => void

  addItem: (
    sectionId: string,
    kind: 'standard' | 'compound' | 'group',
    insertAfterId?: string,
  ) => void
  batchAddStandardQuestions: (sectionId: string, count: number) => void
  addNextQuestion: () => void
  moveItem: (sectionId: string, itemId: string, delta: -1 | 1) => void
  duplicateItem: (sectionId: string, itemId: string) => void
  removeItem: (sectionId: string, itemId: string) => void
  convertStandardToCompound: (sectionId: string, itemId: string) => void

  addSubQuestion: (compound: CompoundQuestionItem) => void
  moveSubQuestion: (compound: CompoundQuestionItem, index: number, delta: -1 | 1) => void
  removeSubQuestion: (compound: CompoundQuestionItem, index: number) => void

  addGroupChild: (group: QuestionGroupItem, insertAfterChildId?: string) => void
  moveGroupChild: (group: QuestionGroupItem, index: number, delta: -1 | 1) => void
  removeGroupChild: (group: QuestionGroupItem, index: number) => void
  setGroupDelimiterStyle: (group: QuestionGroupItem, style: GroupDelimiterStyle) => void

  addPresetOptions: (target: OptionContainer) => void
  addSingleOption: (target: OptionContainer) => void
  removeOptionAt: (target: OptionContainer, index: number) => void
  clearOptions: (target: OptionContainer) => void
  toggleChoiceAnswer: (currentAnswer: string, label: string, isMultiple: boolean) => string

  addStep: (steps: string[]) => void
  removeStepAt: (steps: string[], index: number) => void

  setDifficulty: (
    target: StandardQuestionItem | CompoundQuestionItem,
    difficulty: DifficultyLevel | '',
  ) => void

  setAdvancedField: (key: AdvancedFieldKey, visible: boolean) => void
  setAllAdvancedFields: (visible: boolean) => void

  applyImport: (imported: ExamDocument, mode: 'replace' | 'append') => void
  loadPresetDocument: (kind: 'sample' | 'empty' | 'skeleton') => void
}

export const examPaperContextKey: InjectionKey<ExamPaperEditorContext> = Symbol('exam-paper-editor')

const MAX_UNDO_HISTORY = 25

function isChoiceLikeTitle(title: string): boolean {
  return /选择|阅读|完形/.test(title)
}

function cloneItemWithFreshIds(item: SectionItem): SectionItem {
  if (item.kind === 'group') {
    return createQuestionGroup({
      delimiterStyle: item.delimiterStyle,
      passage: item.passage,
      questions: item.questions.map((child) =>
        createGroupChildQuestion({
          stem: child.stem,
          options: child.options,
          score: child.score,
          answer: child.answer,
          analysis: child.analysis,
          steps: child.steps,
        }),
      ),
    })
  }
  if (item.kind === 'compound') {
    return createCompoundQuestion({
      stem: item.stem,
      score: item.score,
      difficulty: item.difficulty,
      knowledgePoints: item.knowledgePoints,
      subQuestions: item.subQuestions.map((sub) =>
        createSubQuestion({
          stem: sub.stem,
          options: sub.options,
          answer: sub.answer,
          analysis: sub.analysis,
          steps: sub.steps,
        }),
      ),
    })
  }
  return createStandardQuestion({
    stem: item.stem,
    options: item.options,
    score: item.score,
    difficulty: item.difficulty,
    knowledgePoints: item.knowledgePoints,
    answer: item.answer,
    analysis: item.analysis,
    steps: item.steps,
  })
}

export function createExamPaperEditor(): ExamPaperEditorContext {
  const initialDoc = loadDraftDocument() ?? createSampleExamDocument()
  const doc = ref<ExamDocument>(initialDoc)

  const firstSection = initialDoc.sections[0] ?? null
  const firstItem = firstSection?.items[0] ?? null

  const selectedSectionId = ref<string>(firstSection?.id ?? '')
  const selectedItemId = ref<string | null>(firstItem?.id ?? null)
  const selectedGroupChildId = ref<string | null>(
    firstItem?.kind === 'group' ? (firstItem.questions[0]?.id ?? null) : null,
  )
  const selectedSubQuestionIndex = ref<number>(0)
  const focusStemTick = ref<number>(0)

  const advancedFields = ref<AdvancedFieldVisibility>({
    answer: false,
    difficulty: false,
    knowledge: false,
    analysis: false,
  })
  const enabledAdvancedFieldCount = computed(
    () => Object.values(advancedFields.value).filter(Boolean).length,
  )

  function setAdvancedField(key: AdvancedFieldKey, visible: boolean) {
    advancedFields.value[key] = visible
  }

  function setAllAdvancedFields(visible: boolean) {
    advancedFields.value.answer = visible
    advancedFields.value.difficulty = visible
    advancedFields.value.knowledge = visible
    advancedFields.value.analysis = visible
  }

  const undoStack = ref<string[]>([])
  const canUndo = computed(() => undoStack.value.length > 0)

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    doc,
    (nextDoc) => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveDraftDocument(nextDoc)
      }, 300)
    },
    { deep: true },
  )

  onBeforeUnmount(() => clearTimeout(saveTimer))

  function ensureSelectionValid() {
    const sections = doc.value.sections
    if (sections.length === 0) {
      selectedSectionId.value = ''
      selectedItemId.value = null
      selectedGroupChildId.value = null
      selectedSubQuestionIndex.value = 0
      return
    }

    let sec = sections.find((s) => s.id === selectedSectionId.value)
    if (!sec) {
      sec = sections[0]
      selectedSectionId.value = sec?.id ?? ''
    }
    if (!sec) return

    let item = sec.items.find((it) => it.id === selectedItemId.value)
    if (!item) {
      item = sec.items[0]
      selectedItemId.value = item?.id ?? null
    }

    if (item?.kind === 'group') {
      const childExists = item.questions.some((q) => q.id === selectedGroupChildId.value)
      if (!childExists) {
        selectedGroupChildId.value = item.questions[0]?.id ?? null
      }
    } else {
      selectedGroupChildId.value = null
    }

    if (item?.kind === 'compound') {
      const maxIdx = Math.max(0, item.subQuestions.length - 1)
      if (selectedSubQuestionIndex.value > maxIdx) {
        selectedSubQuestionIndex.value = maxIdx
      }
    } else {
      selectedSubQuestionIndex.value = 0
    }
  }

  function pushUndoSnapshot() {
    const serialized = serializeExamJson(doc.value)
    const last = undoStack.value[undoStack.value.length - 1]
    if (last === serialized) return
    undoStack.value.push(serialized)
    if (undoStack.value.length > MAX_UNDO_HISTORY) {
      undoStack.value.shift()
    }
  }

  function undo(): boolean {
    const snapshot = undoStack.value.pop()
    if (!snapshot) return false
    try {
      doc.value = parseExamJson(snapshot)
      ensureSelectionValid()
      return true
    } catch {
      return false
    }
  }

  const numbering = computed(() => computePaperNumbering(doc.value))
  const stats = computed(() => computePaperStats(doc.value))
  const issues = computed(() => validateExamDocument(doc.value))
  const errorIssues = computed(() => issues.value.filter((item) => item.severity === 'error'))
  const warningIssues = computed(() => issues.value.filter((item) => item.severity === 'warning'))

  const issueCountByItem = computed(() => {
    const map = new Map<string, ItemIssueCounts>()
    const bump = (id: string, severity: 'error' | 'warning') => {
      const entry = map.get(id) ?? { errors: 0, warnings: 0 }
      if (severity === 'error') {
        entry.errors += 1
      } else {
        entry.warnings += 1
      }
      map.set(id, entry)
    }

    for (const issue of issues.value) {
      if (issue.itemId) bump(issue.itemId, issue.severity)
      if (issue.childId) bump(issue.childId, issue.severity)
    }
    return map
  })

  const paperKnowledgePoints = computed(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const section of doc.value.sections) {
      for (const item of section.items) {
        if (item.kind === 'group') continue
        const parts = item.knowledgePoints
          .split(/[；;、,，\r\n]+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
        for (const part of parts) {
          if (!seen.has(part)) {
            seen.add(part)
            result.push(part)
          }
        }
      }
    }
    return result
  })

  const activeSection = computed<ExamSection | null>(() => {
    const found = doc.value.sections.find((s) => s.id === selectedSectionId.value)
    return found ?? doc.value.sections[0] ?? null
  })

  const activeItem = computed<SectionItem | null>(() => {
    const sec = activeSection.value
    if (!sec) return null
    const found = sec.items.find((it) => it.id === selectedItemId.value)
    return found ?? sec.items[0] ?? null
  })

  const activeGroupChild = computed<GroupChildQuestion | null>(() => {
    const item = activeItem.value
    if (!item || item.kind !== 'group') return null
    const found = item.questions.find((q) => q.id === selectedGroupChildId.value)
    return found ?? item.questions[0] ?? null
  })

  const flatNavEntries = computed<NavEntry[]>(() => {
    const entries: NavEntry[] = []
    const { questionNumbers } = numbering.value

    for (const section of doc.value.sections) {
      for (const item of section.items) {
        if (item.kind === 'group') {
          if (item.questions.length === 0) {
            entries.push({
              sectionId: section.id,
              itemId: item.id,
              number: 0,
              label: '空题组',
            })
          } else {
            for (const child of item.questions) {
              const num = questionNumbers.get(child.id) ?? 0
              entries.push({
                sectionId: section.id,
                itemId: item.id,
                childId: child.id,
                number: num,
                label: `第 ${num} 题`,
              })
            }
          }
        } else {
          const num = questionNumbers.get(item.id) ?? 0
          entries.push({
            sectionId: section.id,
            itemId: item.id,
            number: num,
            label: `第 ${num} 题`,
          })
        }
      }
    }

    return entries
  })

  const activeNavIndex = computed(() => {
    const item = activeItem.value
    if (!item) return -1
    if (item.kind === 'group') {
      const childId = activeGroupChild.value?.id
      const idx = flatNavEntries.value.findIndex(
        (entry) => entry.itemId === item.id && entry.childId === childId,
      )
      if (idx >= 0) return idx
    }
    return flatNavEntries.value.findIndex((entry) => entry.itemId === item.id)
  })

  const canGoPrev = computed(() => activeNavIndex.value > 0)
  const canGoNext = computed(
    () => activeNavIndex.value >= 0 && activeNavIndex.value < flatNavEntries.value.length - 1,
  )

  function selectSection(sectionId: string) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    selectedSectionId.value = section.id
    const first = section.items[0] ?? null
    selectedItemId.value = first?.id ?? null
    selectedGroupChildId.value = first?.kind === 'group' ? (first.questions[0]?.id ?? null) : null
    selectedSubQuestionIndex.value = 0
  }

  function selectItem(sectionId: string, itemId: string | null, childId?: string | null) {
    selectedSectionId.value = sectionId
    selectedItemId.value = itemId
    selectedSubQuestionIndex.value = 0

    const section = doc.value.sections.find((s) => s.id === sectionId)
    const item = section?.items.find((it) => it.id === itemId) ?? null
    if (item?.kind === 'group') {
      if (childId && item.questions.some((q) => q.id === childId)) {
        selectedGroupChildId.value = childId
      } else {
        selectedGroupChildId.value = item.questions[0]?.id ?? null
      }
    } else {
      selectedGroupChildId.value = null
    }
  }

  function jumpToIssue(issue: ValidationIssue) {
    if (!issue.sectionId) return
    if (issue.itemId) {
      selectItem(issue.sectionId, issue.itemId, issue.childId)
    } else {
      selectSection(issue.sectionId)
    }
  }

  function goPrev() {
    const idx = activeNavIndex.value
    if (idx <= 0) return
    const target = flatNavEntries.value[idx - 1]
    if (target) {
      selectItem(target.sectionId, target.itemId, target.childId)
    }
  }

  function goNext() {
    const idx = activeNavIndex.value
    if (idx < 0 || idx >= flatNavEntries.value.length - 1) return
    const target = flatNavEntries.value[idx + 1]
    if (target) {
      selectItem(target.sectionId, target.itemId, target.childId)
    }
  }

  function setTitle(title: string) {
    doc.value.title = title
  }

  function setSectionTitle(sectionId: string, title: string) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (section) section.title = title
  }

  function setSectionScoreMode(sectionId: string, mode: SectionScoreMode) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    pushUndoSnapshot()
    section.scoreMode = mode
    if (mode === 'uniform' && !section.scorePerQuestion) {
      section.scorePerQuestion = 3
    }
  }

  function setSectionUniformScore(sectionId: string, score: number | undefined) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (section) section.scorePerQuestion = score
  }

  function addSectionFromPreset(preset: SectionPreset) {
    pushUndoSnapshot()
    const created = preset.create()
    doc.value.sections.push(created)
    selectSection(created.id)
    focusStemTick.value += 1
  }

  function moveSection(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= doc.value.sections.length) return
    const current = doc.value.sections[index]
    const neighbor = doc.value.sections[target]
    if (!current || !neighbor) return
    pushUndoSnapshot()
    doc.value.sections[index] = neighbor
    doc.value.sections[target] = current
  }

  function removeSection(index: number) {
    const removed = doc.value.sections[index]
    if (!removed) return
    pushUndoSnapshot()
    doc.value.sections.splice(index, 1)
    if (selectedSectionId.value === removed.id) {
      const fallback =
        doc.value.sections[index] ?? doc.value.sections[Math.max(0, index - 1)] ?? null
      if (fallback) {
        selectSection(fallback.id)
      } else {
        ensureSelectionValid()
      }
    }
  }

  function buildNewItemForSection(
    section: ExamSection,
    kind: 'standard' | 'compound' | 'group',
  ): SectionItem {
    const withChoiceOptions = isChoiceLikeTitle(section.title)
    const defaultScore = section.scoreMode === 'per-question' ? 10 : undefined

    if (kind === 'compound') {
      return createCompoundQuestion({ score: defaultScore })
    }
    if (kind === 'group') {
      return createQuestionGroup({
        questions: [
          createGroupChildQuestion({
            options: withChoiceOptions ? createDefaultOptions() : [],
          }),
          createGroupChildQuestion({
            options: withChoiceOptions ? createDefaultOptions() : [],
          }),
        ],
      })
    }
    return createStandardQuestion({
      options: /选择/.test(section.title) ? createDefaultOptions() : [],
      score: defaultScore,
    })
  }

  function addItem(
    sectionId: string,
    kind: 'standard' | 'compound' | 'group',
    insertAfterId?: string,
  ) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    pushUndoSnapshot()
    const created = buildNewItemForSection(section, kind)
    if (insertAfterId) {
      const idx = section.items.findIndex((it) => it.id === insertAfterId)
      if (idx >= 0) {
        section.items.splice(idx + 1, 0, created)
      } else {
        section.items.push(created)
      }
    } else {
      section.items.push(created)
    }
    selectItem(
      section.id,
      created.id,
      created.kind === 'group' ? (created.questions[0]?.id ?? null) : null,
    )
    focusStemTick.value += 1
  }

  function batchAddStandardQuestions(sectionId: string, count: number) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    const safeCount = Math.max(1, Math.min(20, Math.floor(count)))
    pushUndoSnapshot()
    const createdItems = Array.from({ length: safeCount }, () =>
      buildNewItemForSection(section, 'standard'),
    )
    section.items.push(...createdItems)
    const firstNew = createdItems[0]
    if (firstNew) {
      selectItem(section.id, firstNew.id)
      focusStemTick.value += 1
    }
  }

  function addNextQuestion() {
    const sec = activeSection.value
    if (!sec) {
      pushUndoSnapshot()
      const createdSection = createSection({
        title: '选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [createStandardQuestion({ options: createDefaultOptions() })],
      })
      doc.value.sections.push(createdSection)
      selectSection(createdSection.id)
      focusStemTick.value += 1
      return
    }

    const item = activeItem.value
    if (item?.kind === 'group') {
      addGroupChild(item, activeGroupChild.value?.id)
      return
    }

    addItem(sec.id, 'standard', item?.id)
  }

  function moveItem(sectionId: string, itemId: string, delta: -1 | 1) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    const index = section.items.findIndex((it) => it.id === itemId)
    const target = index + delta
    if (index < 0 || target < 0 || target >= section.items.length) return
    const current = section.items[index]
    const neighbor = section.items[target]
    if (!current || !neighbor) return
    pushUndoSnapshot()
    section.items[index] = neighbor
    section.items[target] = current
  }

  function duplicateItem(sectionId: string, itemId: string) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    const index = section.items.findIndex((it) => it.id === itemId)
    const source = section.items[index]
    if (!source) return
    pushUndoSnapshot()
    const cloned = cloneItemWithFreshIds(source)
    section.items.splice(index + 1, 0, cloned)
    selectItem(
      section.id,
      cloned.id,
      cloned.kind === 'group' ? (cloned.questions[0]?.id ?? null) : null,
    )
  }

  function removeItem(sectionId: string, itemId: string) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    const index = section.items.findIndex((it) => it.id === itemId)
    if (index < 0) return
    pushUndoSnapshot()
    section.items.splice(index, 1)
    if (selectedItemId.value === itemId) {
      const next = section.items[index] ?? section.items[Math.max(0, index - 1)] ?? null
      selectItem(
        section.id,
        next?.id ?? null,
        next?.kind === 'group' ? (next.questions[0]?.id ?? null) : null,
      )
    }
  }

  function convertStandardToCompound(sectionId: string, itemId: string) {
    const section = doc.value.sections.find((s) => s.id === sectionId)
    if (!section) return
    const index = section.items.findIndex((it) => it.id === itemId)
    const source = section.items[index]
    if (!source || source.kind !== 'standard') return

    pushUndoSnapshot()
    const converted = createCompoundQuestion({
      id: source.id,
      stem: source.stem,
      score: source.score,
      difficulty: source.difficulty,
      knowledgePoints: source.knowledgePoints,
      subQuestions: [
        createSubQuestion({
          stem: '',
          options: source.options,
          answer: source.answer,
          analysis: source.analysis,
          steps: source.steps,
        }),
        createSubQuestion(),
      ],
    })
    section.items[index] = converted
    selectedSubQuestionIndex.value = 0
  }

  function addSubQuestion(compound: CompoundQuestionItem) {
    pushUndoSnapshot()
    compound.subQuestions.push(createSubQuestion())
    selectedSubQuestionIndex.value = Math.max(0, compound.subQuestions.length - 1)
  }

  function moveSubQuestion(compound: CompoundQuestionItem, index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= compound.subQuestions.length) return
    const current = compound.subQuestions[index]
    const neighbor = compound.subQuestions[target]
    if (!current || !neighbor) return
    pushUndoSnapshot()
    compound.subQuestions[index] = neighbor
    compound.subQuestions[target] = current
    selectedSubQuestionIndex.value = target
  }

  function removeSubQuestion(compound: CompoundQuestionItem, index: number) {
    if (index < 0 || index >= compound.subQuestions.length) return
    pushUndoSnapshot()
    compound.subQuestions.splice(index, 1)
    selectedSubQuestionIndex.value = Math.max(
      0,
      Math.min(selectedSubQuestionIndex.value, compound.subQuestions.length - 1),
    )
  }

  function addGroupChild(group: QuestionGroupItem, insertAfterChildId?: string) {
    pushUndoSnapshot()
    const templateNeighbor = group.questions[group.questions.length - 1]
    const shouldCopyOptions = (templateNeighbor?.options.length ?? 0) > 0
    const created = createGroupChildQuestion({
      options: shouldCopyOptions
        ? (templateNeighbor?.options ?? []).map((o) => createOption(o.label, ''))
        : [],
    })

    if (insertAfterChildId) {
      const idx = group.questions.findIndex((q) => q.id === insertAfterChildId)
      if (idx >= 0) {
        group.questions.splice(idx + 1, 0, created)
      } else {
        group.questions.push(created)
      }
    } else {
      group.questions.push(created)
    }
    selectedGroupChildId.value = created.id
    focusStemTick.value += 1
  }

  function moveGroupChild(group: QuestionGroupItem, index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= group.questions.length) return
    const current = group.questions[index]
    const neighbor = group.questions[target]
    if (!current || !neighbor) return
    pushUndoSnapshot()
    group.questions[index] = neighbor
    group.questions[target] = current
  }

  function removeGroupChild(group: QuestionGroupItem, index: number) {
    const removed = group.questions[index]
    if (!removed) return
    pushUndoSnapshot()
    group.questions.splice(index, 1)
    if (selectedGroupChildId.value === removed.id) {
      const next = group.questions[index] ?? group.questions[Math.max(0, index - 1)] ?? null
      selectedGroupChildId.value = next?.id ?? null
    }
  }

  function setGroupDelimiterStyle(group: QuestionGroupItem, style: GroupDelimiterStyle) {
    group.delimiterStyle = style
  }

  function addPresetOptions(target: OptionContainer) {
    if (target.options.length === 0) {
      target.options.push(...createDefaultOptions())
      return
    }
    addSingleOption(target)
  }

  function addSingleOption(target: OptionContainer) {
    const nextCharCode = 65 + target.options.length
    const label =
      nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : `项${target.options.length + 1}`
    target.options.push(createOption(label, ''))
  }

  function removeOptionAt(target: OptionContainer, index: number) {
    target.options.splice(index, 1)
  }

  function clearOptions(target: OptionContainer) {
    target.options.splice(0, target.options.length)
  }

  function toggleChoiceAnswer(currentAnswer: string, label: string, isMultiple: boolean): string {
    const cleanLabel = label.trim().toUpperCase()
    if (!cleanLabel) return currentAnswer
    if (!isMultiple) {
      return currentAnswer.trim().toUpperCase() === cleanLabel ? '' : cleanLabel
    }
    const existing = new Set(
      currentAnswer
        .toUpperCase()
        .replace(/[^A-H]/g, '')
        .split('')
        .filter((ch) => ch.length > 0),
    )
    if (existing.has(cleanLabel)) {
      existing.delete(cleanLabel)
    } else {
      existing.add(cleanLabel)
    }
    return Array.from(existing).sort().join('')
  }

  function addStep(steps: string[]) {
    steps.push('')
  }

  function removeStepAt(steps: string[], index: number) {
    steps.splice(index, 1)
  }

  function setDifficulty(
    target: StandardQuestionItem | CompoundQuestionItem,
    difficulty: DifficultyLevel | '',
  ) {
    target.difficulty = difficulty
  }

  function applyImport(imported: ExamDocument, mode: 'replace' | 'append') {
    pushUndoSnapshot()
    if (mode === 'replace') {
      doc.value = imported
      const sec = imported.sections[0]
      if (sec) {
        selectSection(sec.id)
      } else {
        ensureSelectionValid()
      }
      return
    }
    doc.value.sections.push(...imported.sections)
    const firstAdded = imported.sections[0]
    if (firstAdded) {
      selectSection(firstAdded.id)
    }
  }

  function loadPresetDocument(kind: 'sample' | 'empty' | 'skeleton') {
    pushUndoSnapshot()
    if (kind === 'empty') {
      doc.value = createEmptyExamDocument()
      clearDraftDocument()
    } else if (kind === 'skeleton') {
      doc.value = createMathSkeletonDocument()
    } else {
      doc.value = createSampleExamDocument()
    }
    const sec = doc.value.sections[0]
    if (sec) {
      selectSection(sec.id)
    } else {
      ensureSelectionValid()
    }
  }

  return {
    doc,
    selectedSectionId,
    selectedItemId,
    selectedGroupChildId,
    selectedSubQuestionIndex,
    focusStemTick,
    advancedFields,
    enabledAdvancedFieldCount,
    canUndo,
    numbering,
    stats,
    issues,
    errorIssues,
    warningIssues,
    issueCountByItem,
    paperKnowledgePoints,
    activeSection,
    activeItem,
    activeGroupChild,
    flatNavEntries,
    activeNavIndex,
    canGoPrev,
    canGoNext,
    pushUndoSnapshot,
    undo,
    selectSection,
    selectItem,
    jumpToIssue,
    goPrev,
    goNext,
    setTitle,
    setSectionTitle,
    setSectionScoreMode,
    setSectionUniformScore,
    addSectionFromPreset,
    moveSection,
    removeSection,
    addItem,
    batchAddStandardQuestions,
    addNextQuestion,
    moveItem,
    duplicateItem,
    removeItem,
    convertStandardToCompound,
    addSubQuestion,
    moveSubQuestion,
    removeSubQuestion,
    addGroupChild,
    moveGroupChild,
    removeGroupChild,
    setGroupDelimiterStyle,
    addPresetOptions,
    addSingleOption,
    removeOptionAt,
    clearOptions,
    toggleChoiceAnswer,
    addStep,
    removeStepAt,
    setDifficulty,
    setAdvancedField,
    setAllAdvancedFields,
    applyImport,
    loadPresetDocument,
  }
}

export function useExamPaperContext(): ExamPaperEditorContext {
  const ctx = inject(examPaperContextKey, null)
  if (!ctx) {
    throw new Error('useExamPaperContext() must be called inside ExamPaperView.')
  }
  return ctx
}
