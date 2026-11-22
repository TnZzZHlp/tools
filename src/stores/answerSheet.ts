import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  parseAnswerSheetStream,
  reparseQuestionGroupApi,
  reviewQuestionGroupApi,
  type ParseStageUpdateEvent,
  type ParseReasoningDeltaEvent,
  type ParseStreamOutput,
  type ParsedQuestionEvent,
} from '@/lib/answer-sheet/api'
import {
  clearAnswerSheetDrafts,
  clearPdfCheckpoints,
  createDefaultLayoutConfig,
  deleteAnswerSheetDraft,
  ensurePaperOverrides,
  listAnswerSheetDrafts,
  loadAnswerSheetDraft,
  loadPdfCheckpoints,
  saveAnswerSheetDraft,
  saveDraftAsset,
  type AnswerSheetDraft,
  type AnswerSheetListItem,
  type DraftAsset,
  type DraftQuestionReview,
  type DraftSource,
  type GroupReviewStatus,
} from '@/lib/answer-sheet/draft'
import { inferSubjectFromText, isPdf, parsePdfByPage } from '@/lib/answer-sheet/pdfPipeline'
import type { OcrPage } from '@/lib/answer-sheet/pdfPipelineTypes'
import type { PaginatedSheetModel } from '@/lib/answer-sheet/layout/model'
import { captureQuestionReview } from '@/lib/answer-sheet/layout/reviewCapture'
import { PAPER_PROFILES, type PaperProfile } from '@/lib/answer-sheet/paper'
import {
  buildQuestionGroupsFromBlocks,
  buildSampleReviews,
  previewAssetBlobs,
  previewAssets,
  previewSamples,
  type PreviewSampleKey,
} from '@/lib/answer-sheet/preview'
import { REFERENCE_LAYOUT } from '@/lib/answer-sheet/reference'
import type {
  QuestionGroup,
  QuestionReviewIssue,
  QuestionReviewResult,
  QuestionSourceImage,
} from '@/lib/answer-sheet/review'
import {
  sanitizeBigQuestionOmrBlocks,
  sanitizeSheetQuestionGroups,
} from '@/lib/answer-sheet/sanitize'
import type {
  AnswerSheetBlock,
  AnswerSheetLayoutConfig,
  AnswerSheetSemanticData,
  BlockOverride,
  BlockType,
  DensityPreset,
  HeaderMode,
  PaperSize,
  PaperSpecId,
  SheetAsset,
  SubjectType,
  ValidationIssue,
} from '@/lib/answer-sheet/types'

export interface WorkbenchSnapshot {
  semanticData: AnswerSheetSemanticData
  layoutConfig: AnswerSheetLayoutConfig
  questionGroups: QuestionGroup[]
}

const MAX_HISTORY = 50
let globalAutoSaveTimer: ReturnType<typeof setTimeout> | null = null

export function clearPendingAutoSave() {
  if (globalAutoSaveTimer) {
    clearTimeout(globalAutoSaveTimer)
    globalAutoSaveTimer = null
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function stableHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `rev-${(h >>> 0).toString(16)}`
}

function subQuestionScore(block: AnswerSheetBlock): number {
  const sum = (parts: { score?: number }[] = []) =>
    parts.reduce((total, part) => total + (part.score ?? 0), 0)
  switch (block.type) {
    case 'compact_blank':
      return sum(block.items)
    case 'open_blank_box':
      return sum(block.subQuestions)
    case 'lined_writing':
      return sum(block.subItems)
    case 'mixed_inline':
      return block.rows.reduce(
        (total, row) => total + (row.type === 'inline_blank' ? sum(row.segments) : 0),
        0,
      )
    default:
      return 0
  }
}

export function recalcValidationReport(data: AnswerSheetSemanticData): AnswerSheetSemanticData {
  const blocks = [...data.blocks].sort((a, b) => a.numericOrder - b.numericOrder)
  const calculatedScore =
    Math.round(
      blocks.reduce((sum, block) => sum + (block.score ?? subQuestionScore(block)), 0) * 100,
    ) / 100

  const autoCodes = new Set(['SCORE_MISMATCH', 'ORDER_GAP', 'DUPLICATE_ORDER'])
  const manualIssues = data.validation.issues.filter((issue) => !autoCodes.has(issue.code))
  const autoIssues: ValidationIssue[] = []

  if (data.meta.totalScore > 0 && Math.abs(calculatedScore - data.meta.totalScore) > 0.01) {
    autoIssues.push({
      severity: 'warning',
      code: 'SCORE_MISMATCH',
      message: `当前题目分值总和为 ${calculatedScore} 分，与卷面声明总分 ${data.meta.totalScore} 分不一致。`,
    })
  }

  const seenLabels = new Set<string>()
  for (const block of blocks) {
    const label = `${block.numericOrder}:${block.displayNo}`
    if (seenLabels.has(label)) {
      autoIssues.push({
        severity: 'error',
        code: 'DUPLICATE_ORDER',
        message: `检测到重复题号 ${block.displayNo}。`,
        relatedBlockId: block.id,
      })
    }
    seenLabels.add(label)
  }
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]!
    const curr = blocks[i]!
    if (curr.numericOrder > prev.numericOrder + 1) {
      autoIssues.push({
        severity: 'warning',
        code: 'ORDER_GAP',
        message: `题号从第 ${prev.displayNo} 题跳至第 ${curr.displayNo} 题，疑似遗漏中间题目。`,
        relatedBlockId: curr.id,
      })
    }
  }

  const allIssues = [...manualIssues, ...autoIssues]
  const hasError = allIssues.some((i) => i.severity === 'error')

  return {
    ...data,
    blocks,
    validation: {
      passed: !hasError && allIssues.length === 0,
      calculatedScore,
      issues: allIssues,
    },
  }
}

export function convertBlockToType(
  block: AnswerSheetBlock,
  targetType: BlockType,
): AnswerSheetBlock {
  if (block.type === targetType) return deepClone(block)
  const base = {
    id: block.id,
    displayNo: block.displayNo,
    numericOrder: block.numericOrder,
    sectionTitle: block.sectionTitle,
    score: block.score ?? 4,
  }

  switch (targetType) {
    case 'omr_choice':
      return {
        ...base,
        type: 'omr_choice',
        options: ['A', 'B', 'C', 'D'],
        isMultiple: false,
      }
    case 'compact_blank':
      return {
        ...base,
        type: 'compact_blank',
        preferredColumns: 2,
        items: [{ subNo: '(1)', score: base.score }],
      }
    case 'mixed_inline':
      return {
        ...base,
        type: 'mixed_inline',
        rows: [
          {
            type: 'inline_blank',
            segments: [{ label: '(1)', blanksCount: 1, separator: '。' }],
          },
        ],
      }
    case 'open_blank_box': {
      const lines = block.type === 'lined_writing' ? block.baseLines : 6
      return {
        ...base,
        type: 'open_blank_box',
        baseHeightMm: Math.max(35, Math.min(180, lines * 12)),
      }
    }
    case 'lined_writing': {
      const height =
        block.type === 'open_blank_box' || block.type === 'drawing_grid' ? block.baseHeightMm : 40
      return {
        ...base,
        type: 'lined_writing',
        baseLines: Math.max(1, Math.min(25, Math.round(height / 12))),
      }
    }
    case 'composition_grid':
      return {
        ...base,
        type: 'composition_grid',
        minWords: 800,
        totalGrids: 1000,
        hasTitleRow: true,
        milestones: [600, 700, 800],
      }
    case 'drawing_grid':
      return {
        ...base,
        type: 'drawing_grid',
        gridType: 'coordinate_paper',
        rows: 15,
        cols: 20,
        baseHeightMm: 55,
      }
  }
}

export const useAnswerSheetStore = defineStore('answerSheetWorkbench', () => {
  const sheetList = ref<AnswerSheetListItem[]>([])
  const sheetId = ref<string>(`sheet-${Date.now()}`)
  const draftSource = shallowRef<DraftSource>({ type: 'text', text: '' })
  const semanticData = ref<AnswerSheetSemanticData | null>(null)
  const layoutConfig = ref<AnswerSheetLayoutConfig>(createDefaultLayoutConfig('8K_2COL'))
  const questionGroups = ref<QuestionGroup[]>([])
  const sourceImages = ref<QuestionSourceImage[]>([])
  const reviews = ref<Record<string, DraftQuestionReview>>({})

  const assetBlobs = shallowRef<Record<string, Blob>>({})
  const assetUrls = ref<Record<string, string>>({ ...previewAssets })

  const selectedBlockId = ref<string | null>(null)
  const highlightedBlockId = ref<string | null>(null)
  const activeGroupId = ref<string | null>(null)

  const undoStack = shallowRef<WorkbenchSnapshot[]>([])
  const redoStack = shallowRef<WorkbenchSnapshot[]>([])

  // Onboarding / Parse state
  const showOnboarding = ref(false)
  const isParsing = ref(false)
  const pdfParseIncomplete = ref(false)
  const pdfHintSubject = ref<SubjectType>()
  const pdfParseFailures = shallowRef<string[]>([])
  const parseStage = ref<ParseStageUpdateEvent | null>(null)
  const parseReasoning = shallowRef<ParseReasoningDeltaEvent[]>([])
  const ocrPages = shallowRef<OcrPage[]>([])
  const parsedQuestions = shallowRef<ParsedQuestionEvent[]>([])
  const totalParseQuestions = ref(0)
  const parseError = ref<string>('')
  let parseAbortController: AbortController | null = null

  // Persistence status
  const isSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const saveError = ref<string>('')

  const hasSheet = computed(() => semanticData.value !== null)
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const activePaperSpec = computed<PaperSpecId>(() => layoutConfig.value.activePaperSpec)
  const activePaperProfile = computed<PaperProfile>(() => {
    const base = PAPER_PROFILES[layoutConfig.value.activePaperSpec]
    const custom = layoutConfig.value.customPaperSize
    if (
      custom &&
      Number.isFinite(custom.widthMm) &&
      Number.isFinite(custom.heightMm) &&
      custom.widthMm >= 140 &&
      custom.heightMm >= 140
    ) {
      return {
        ...base,
        widthMm: custom.widthMm,
        heightMm: custom.heightMm,
      }
    }
    return base
  })

  const currentPaperOverrides = computed(() => {
    const spec = layoutConfig.value.activePaperSpec
    return (
      layoutConfig.value.perPaperOverrides[spec] ?? {
        blockOverrides: {},
      }
    )
  })

  const selectedBlock = computed<AnswerSheetBlock | null>(() => {
    if (!semanticData.value || !selectedBlockId.value) return null
    return semanticData.value.blocks.find((b) => b.id === selectedBlockId.value) ?? null
  })

  const selectedBlockOverride = computed<BlockOverride>(() => {
    if (!selectedBlockId.value) return {}
    return currentPaperOverrides.value.blockOverrides[selectedBlockId.value] ?? {}
  })

  const assetsMap = computed<Record<string, SheetAsset>>(() => {
    if (!semanticData.value) return {}
    return Object.fromEntries(semanticData.value.assets.map((a) => [a.assetId, a]))
  })

  const resolvedIssueKeySet = computed(() => new Set(layoutConfig.value.resolvedIssueKeys ?? []))

  function computeGroupRevision(group: QuestionGroup, layoutSignature = ''): string {
    if (!semanticData.value) return 'rev-empty'
    const spec = layoutConfig.value.activePaperSpec
    const paperOv = layoutConfig.value.perPaperOverrides[spec]
    const groupBlocks = group.blockIds
      .map((id) => semanticData.value?.blocks.find((b) => b.id === id))
      .filter((b): b is AnswerSheetBlock => Boolean(b))
    const blockOverrides = Object.fromEntries(
      group.blockIds.map((id) => [id, paperOv?.blockOverrides[id] ?? {}]),
    )
    const payload = JSON.stringify({
      groupId: group.groupId,
      blocks: groupBlocks,
      spec,
      customPaperSize: layoutConfig.value.customPaperSize,
      density: layoutConfig.value.densityPreset,
      globalLineHeightMm: paperOv?.globalLineHeightMm,
      defaultCompositionCols: layoutConfig.value.defaultCompositionCols,
      blockOverrides,
      layoutSignature,
    })
    return stableHash(payload)
  }

  function getGroupReviewState(group: QuestionGroup): {
    status: GroupReviewStatus
    revision: string
    automaticRepairCount: number
    latestResult?: QuestionReviewResult
  } {
    const currentRevision = computeGroupRevision(group)
    const record = reviews.value[group.groupId]
    if (!record) {
      return {
        status: 'pending',
        revision: currentRevision,
        automaticRepairCount: 0,
      }
    }
    if (record.revision !== currentRevision) {
      return {
        status: 'pending',
        revision: currentRevision,
        automaticRepairCount: record.automaticRepairCount,
        latestResult: record.history[record.history.length - 1],
      }
    }
    const latest = record.history[record.history.length - 1]
    const status: GroupReviewStatus =
      record.status ??
      (latest?.verdict === 'passed'
        ? 'passed'
        : latest?.verdict === 'uncertain' || record.automaticRepairCount >= 2
          ? 'manual_review'
          : latest?.verdict === 'needs_revision'
            ? 'needs_revision'
            : 'pending')
    return {
      status,
      revision: record.revision,
      automaticRepairCount: record.automaticRepairCount,
      latestResult: latest,
    }
  }

  const unpassedQuestionGroups = computed(() => {
    return questionGroups.value
      .map((group) => ({
        group,
        review: getGroupReviewState(group),
      }))
      .filter(({ review }) => review.status !== 'passed')
  })

  function revokeObjectUrls() {
    for (const [id, url] of Object.entries(assetUrls.value)) {
      if (url.startsWith('blob:') && previewAssets[id] !== url) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      }
    }
  }

  function rebuildAssetUrls(blobs: Record<string, Blob>) {
    revokeObjectUrls()
    const nextUrls: Record<string, string> = { ...previewAssets }
    for (const [assetId, blob] of Object.entries(blobs)) {
      if (typeof URL.createObjectURL === 'function') {
        try {
          nextUrls[assetId] = URL.createObjectURL(blob)
        } catch {
          // fallback in jsdom if createObjectURL fails
        }
      }
    }
    assetUrls.value = nextUrls
  }

  function invalidateAffectedGroupReviews(changedBlockIds?: Iterable<string>) {
    const idSet = changedBlockIds ? new Set(changedBlockIds) : null
    const nextReviews: Record<string, DraftQuestionReview> = { ...reviews.value }
    for (const group of questionGroups.value) {
      if (idSet && !group.blockIds.some((id) => idSet.has(id))) {
        continue
      }
      const currentRev = computeGroupRevision(group)
      const existing = nextReviews[group.groupId]
      if (!existing || existing.revision !== currentRev) {
        nextReviews[group.groupId] = {
          revision: currentRev,
          status: 'pending',
          automaticRepairCount: existing?.automaticRepairCount ?? 0,
          history: existing?.history ?? [],
        }
      }
    }
    reviews.value = nextReviews
  }

  // Triggered when PaginatedSheetModel updates to check if layout reflow altered other groups' rendered slices
  const groupRenderFingerprints = ref<Record<string, string>>({})
  function syncPaginatedLayoutFingerprints(model: PaginatedSheetModel | undefined) {
    if (!model || !semanticData.value) return
    const blockToPlacements = new Map<string, string[]>()
    for (const [pIdx, page] of model.pages.entries()) {
      for (const [cIdx, col] of page.entries()) {
        for (const placed of col) {
          if (placed.item.type === 'block') {
            const bid = placed.item.block.id
            const arr = blockToPlacements.get(bid) ?? []
            arr.push(
              `${pIdx}:${cIdx}:${placed.item.start ?? 0}-${placed.item.end ?? 0}:${Math.round(placed.heightMm * 10)}:${Math.round(placed.paddingMm * 10)}`,
            )
            blockToPlacements.set(bid, arr)
          } else if (placed.item.type === 'choices') {
            for (const row of placed.item.rows) {
              for (const entry of row.entries) {
                const bid = entry.block.id
                const arr = blockToPlacements.get(bid) ?? []
                arr.push(`${pIdx}:${cIdx}:choice`)
                blockToPlacements.set(bid, arr)
              }
            }
          }
        }
      }
    }

    const prevMap = groupRenderFingerprints.value
    const nextMap: Record<string, string> = {}
    const changedGroups: string[] = []

    for (const group of questionGroups.value) {
      const sig = group.blockIds
        .map((id) => `${id}[${(blockToPlacements.get(id) ?? []).join(',')}]`)
        .join('|')
      nextMap[group.groupId] = sig
      if (prevMap[group.groupId] !== undefined && prevMap[group.groupId] !== sig) {
        changedGroups.push(group.groupId)
      }
    }
    groupRenderFingerprints.value = nextMap

    if (changedGroups.length > 0) {
      const nextReviews = { ...reviews.value }
      for (const gid of changedGroups) {
        const group = questionGroups.value.find((g) => g.groupId === gid)
        if (!group) continue
        const existing = nextReviews[gid]
        if (existing) {
          nextReviews[gid] = {
            ...existing,
            revision: computeGroupRevision(group),
            status: 'pending',
          }
        }
      }
      reviews.value = nextReviews
    }
  }

  function cancelAutoSave() {
    clearPendingAutoSave()
  }
  function scheduleAutoSave() {
    cancelAutoSave()
    if (!semanticData.value && !sheetList.value.some((item) => item.sheetId === sheetId.value)) {
      return
    }
    globalAutoSaveTimer = setTimeout(() => {
      globalAutoSaveTimer = null
      void persistDraftToLocal(false)
    }, 250)
  }

  async function persistDraftToLocal(includeAssets = false): Promise<boolean> {
    cancelAutoSave()
    isSaving.value = true
    saveError.value = ''
    try {
      const draft: AnswerSheetDraft = {
        sheetId: sheetId.value,
        updatedAt: Date.now(),
        source: draftSource.value,
        pdfParseIncomplete: pdfParseIncomplete.value,
        pdfHintSubject: pdfHintSubject.value,
        semanticData: semanticData.value ?? undefined,
        layoutConfig: layoutConfig.value,
        questionGroups: questionGroups.value,
        sourceImages: sourceImages.value,
        reviews: reviews.value,
      }
      const assetsList: DraftAsset[] | undefined = includeAssets
        ? Object.entries(assetBlobs.value).map(([assetId, blob]) => ({
            sheetId: sheetId.value,
            assetId,
            blob,
          }))
        : undefined
      await saveAnswerSheetDraft(draft, assetsList)
      lastSavedAt.value = draft.updatedAt ?? Date.now()
      await refreshSheetList()
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : '保存本地草稿失败'
      return false
    } finally {
      isSaving.value = false
    }
  }

  async function refreshSheetList(): Promise<AnswerSheetListItem[]> {
    try {
      const items = await listAnswerSheetDrafts()
      sheetList.value = items
      return items
    } catch {
      return sheetList.value
    }
  }

  function recordSnapshot() {
    if (!semanticData.value) return
    const snap: WorkbenchSnapshot = {
      semanticData: deepClone(semanticData.value),
      layoutConfig: deepClone(layoutConfig.value),
      questionGroups: deepClone(questionGroups.value),
    }
    undoStack.value = [...undoStack.value.slice(-(MAX_HISTORY - 1)), snap]
    redoStack.value = []
  }

  function applyMutation(
    mutator: () => void,
    options?: { affectedBlockIds?: string[]; recordUndo?: boolean },
  ) {
    if (options?.recordUndo !== false) {
      recordSnapshot()
    }
    mutator()
    if (semanticData.value) {
      semanticData.value = recalcValidationReport(semanticData.value)
    }
    if (options?.affectedBlockIds) {
      invalidateAffectedGroupReviews(options.affectedBlockIds)
    } else {
      invalidateAffectedGroupReviews()
    }
    scheduleAutoSave()
  }

  function undo(): boolean {
    if (!undoStack.value.length || !semanticData.value) return false
    const currentSnap: WorkbenchSnapshot = {
      semanticData: deepClone(semanticData.value),
      layoutConfig: deepClone(layoutConfig.value),
      questionGroups: deepClone(questionGroups.value),
    }
    const previous = undoStack.value[undoStack.value.length - 1]!
    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, currentSnap]

    semanticData.value = deepClone(previous.semanticData)
    layoutConfig.value = deepClone(previous.layoutConfig)
    questionGroups.value = deepClone(previous.questionGroups)
    invalidateAffectedGroupReviews()
    scheduleAutoSave()
    return true
  }

  function redo(): boolean {
    if (!redoStack.value.length || !semanticData.value) return false
    const currentSnap: WorkbenchSnapshot = {
      semanticData: deepClone(semanticData.value),
      layoutConfig: deepClone(layoutConfig.value),
      questionGroups: deepClone(questionGroups.value),
    }
    const next = redoStack.value[redoStack.value.length - 1]!
    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, currentSnap]

    semanticData.value = deepClone(next.semanticData)
    layoutConfig.value = deepClone(next.layoutConfig)
    questionGroups.value = deepClone(next.questionGroups)
    invalidateAffectedGroupReviews()
    scheduleAutoSave()
    return true
  }

  async function loadSamplePreset(key: PreviewSampleKey = 'chinese') {
    const sample = deepClone(previewSamples[key])
    sheetId.value = `sample-${key}`
    draftSource.value = { type: 'text', text: `${sample.meta.title} 原文草稿` }
    pdfParseIncomplete.value = false
    pdfParseFailures.value = []
    ocrPages.value = []
    parsedQuestions.value = []
    semanticData.value = recalcValidationReport(sample)

    if (key === 'weekend') {
      layoutConfig.value = {
        ...createDefaultLayoutConfig('8K_2COL'),
        ...deepClone(REFERENCE_LAYOUT),
        showBoundaryWarning: false,
        defaultCompositionWords: 800,
        defaultCompositionCols: 25,
        resolvedIssueKeys: [],
      }
    } else {
      layoutConfig.value = createDefaultLayoutConfig(sample.meta.recommendedPaperSpec)
    }

    const groups = buildQuestionGroupsFromBlocks(sample.blocks)
    questionGroups.value = groups
    sourceImages.value = sample.assets.map((a) => ({
      assetId: a.assetId,
      mimeType: a.mimeType,
      widthPx: a.widthPx,
      heightPx: a.heightPx,
    }))

    const blobs: Record<string, Blob> = {}
    for (const asset of sample.assets) {
      const factory = previewAssetBlobs[asset.assetId]
      if (factory) blobs[asset.assetId] = factory()
    }
    assetBlobs.value = blobs
    rebuildAssetUrls(blobs)

    reviews.value = buildSampleReviews(groups, sample.blocks, (g) => computeGroupRevision(g))
    undoStack.value = []
    redoStack.value = []
    selectedBlockId.value = null
    groupRenderFingerprints.value = {}
    showOnboarding.value = false
    await persistDraftToLocal(true)
  }

  function upsertOcrPage(page: OcrPage) {
    const next = ocrPages.value.filter((item) => item.page !== page.page)
    next.push(page)
    next.sort((a, b) => a.page - b.page)
    ocrPages.value = next
  }

  function upsertParsedQuestion(event: ParsedQuestionEvent) {
    const next = parsedQuestions.value.filter((item) => item.group.groupId !== event.group.groupId)
    next.push(event)
    next.sort((a, b) => a.questionIndex - b.questionIndex)
    parsedQuestions.value = next
  }

  async function loadDebugCheckpoints(targetSheetId = sheetId.value): Promise<void> {
    try {
      const checkpoints = await loadPdfCheckpoints(targetSheetId)
      if (sheetId.value !== targetSheetId) return
      const pages: OcrPage[] = []
      const questions: ParsedQuestionEvent[] = []
      const extraBlobs: Record<string, Blob> = {}
      for (const unit of checkpoints) {
        if (unit.type === 'page') {
          pages.push(unit.result)
          if (unit.assets instanceof Map) {
            for (const [assetId, blob] of unit.assets.entries()) {
              if (!assetBlobs.value[assetId]) {
                extraBlobs[assetId] = blob
              }
            }
          }
        } else if (unit.type === 'question') {
          questions.push(unit.result)
        }
      }
      pages.sort((a, b) => a.page - b.page)
      questions.sort((a, b) => a.questionIndex - b.questionIndex)
      ocrPages.value = pages
      if (questions.length > 0) {
        parsedQuestions.value = questions
      }
      if (Object.keys(extraBlobs).length > 0) {
        assetBlobs.value = { ...extraBlobs, ...assetBlobs.value }
        rebuildAssetUrls(assetBlobs.value)
      }
    } catch {
      // Ignore debug checkpoint read errors
    }
  }

  async function restoreFromIndexedDB(targetSheetId?: string): Promise<boolean> {
    try {
      await refreshSheetList()
      const loaded = await loadAnswerSheetDraft(targetSheetId)
      if (!loaded) return false
      const { draft, assets } = loaded
      sheetId.value = draft.sheetId
      draftSource.value = draft.source
      pdfParseIncomplete.value = draft.pdfParseIncomplete ?? false
      pdfHintSubject.value = draft.pdfHintSubject
      pdfParseFailures.value = []
      questionGroups.value = draft.questionGroups ?? []
      sourceImages.value = draft.sourceImages ?? []
      reviews.value = draft.reviews ?? {}

      const blobs: Record<string, Blob> = {}
      for (const item of assets) {
        blobs[item.assetId] = item.blob
      }
      assetBlobs.value = blobs
      rebuildAssetUrls(blobs)
      ocrPages.value = []
      parsedQuestions.value = []
      void loadDebugCheckpoints(draft.sheetId)

      if (draft.semanticData) {
        const rawGroups = questionGroups.value.length
          ? questionGroups.value
          : buildQuestionGroupsFromBlocks(draft.semanticData.blocks)
        const sanitized = sanitizeSheetQuestionGroups(rawGroups, draft.semanticData.blocks)
        questionGroups.value = sanitized.questionGroups
        semanticData.value = recalcValidationReport({
          ...draft.semanticData,
          blocks: sanitized.blocks,
        })
        layoutConfig.value = ensurePaperOverrides(
          draft.layoutConfig ??
            createDefaultLayoutConfig(draft.semanticData.meta.recommendedPaperSpec),
          draft.layoutConfig?.activePaperSpec ?? draft.semanticData.meta.recommendedPaperSpec,
        )
        undoStack.value = []
        redoStack.value = []
        selectedBlockId.value = null
        showOnboarding.value = false
        return true
      } else {
        // Unfinished or newly created draft waiting for file parse
        semanticData.value = null
        selectedBlockId.value = null
        showOnboarding.value = false
        return true
      }
    } catch {
      return false
    }
  }

  async function initializeWorkbench() {
    const restored = await restoreFromIndexedDB()
    if (!restored) {
      semanticData.value = null
      selectedBlockId.value = null
    }
  }

  async function createNewAnswerSheet(
    file?: File,
    hintSubject: SubjectType | 'auto' = 'auto',
  ): Promise<string> {
    if (isParsing.value) {
      cancelOnboardingParse()
    }
    const newId = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    sheetId.value = newId
    draftSource.value = file ? { type: 'file', file } : { type: 'text', text: '' }
    pdfParseIncomplete.value = false
    pdfParseFailures.value = []
    semanticData.value = null
    layoutConfig.value = createDefaultLayoutConfig('8K_2COL')
    questionGroups.value = []
    sourceImages.value = []
    reviews.value = {}
    assetBlobs.value = {}
    rebuildAssetUrls({})
    undoStack.value = []
    redoStack.value = []
    selectedBlockId.value = null
    activeGroupId.value = null
    parseError.value = ''
    parseStage.value = null
    parseReasoning.value = []
    ocrPages.value = []
    parsedQuestions.value = []
    totalParseQuestions.value = 0

    await saveAnswerSheetDraft({
      sheetId: newId,
      updatedAt: Date.now(),
      source: draftSource.value,
      questionGroups: [],
      sourceImages: [],
      reviews: {},
    })
    await refreshSheetList()

    if (file) {
      await submitOnboardingParse({ type: 'file', file }, hintSubject, newId)
    }
    return newId
  }

  async function selectAnswerSheet(targetSheetId: string): Promise<boolean> {
    if (isParsing.value) {
      cancelOnboardingParse()
    }
    parseError.value = ''
    parseStage.value = null
    parseReasoning.value = []
    ocrPages.value = []
    parsedQuestions.value = []
    return restoreFromIndexedDB(targetSheetId)
  }

  async function deleteAnswerSheet(targetSheetId: string): Promise<void> {
    if (isParsing.value && sheetId.value === targetSheetId) {
      cancelOnboardingParse()
    }
    await deleteAnswerSheetDraft(targetSheetId)
    const remaining = await refreshSheetList()
    if (sheetId.value === targetSheetId) {
      const next = remaining[0]
      if (next) {
        await restoreFromIndexedDB(next.sheetId)
      } else {
        sheetId.value = `sheet-${Date.now()}`
        draftSource.value = { type: 'text', text: '' }
        pdfParseIncomplete.value = false
        pdfParseFailures.value = []
        semanticData.value = null
        questionGroups.value = []
        sourceImages.value = []
        ocrPages.value = []
        parsedQuestions.value = []
        reviews.value = {}
        assetBlobs.value = {}
        rebuildAssetUrls({})
        selectedBlockId.value = null
        parseStage.value = null
        parseError.value = ''
      }
    }
  }

  function appendParseReasoning(event: ParseReasoningDeltaEvent, unit = '') {
    if (typeof event.text !== 'string' || !event.text) return
    const stage = unit || event.stage
    const sameCall = (entry: ParseReasoningDeltaEvent) =>
      entry.callId === event.callId && entry.stage === stage
    const previous = parseReasoning.value.find(sameCall)
    const next = { ...event, stage, text: `${previous?.text ?? ''}${event.text}`.slice(-6000) }
    parseReasoning.value = [
      ...parseReasoning.value.filter((entry) => !sameCall(entry)),
      next,
    ].slice(-12)
  }

  function applyPdfParseOutput(output: ParseStreamOutput, includeAssets: boolean) {
    const result = output.result
    if (!semanticData.value)
      layoutConfig.value = createDefaultLayoutConfig(result.semanticData.meta.recommendedPaperSpec)
    if (includeAssets) {
      assetBlobs.value = { ...Object.fromEntries(output.assets), ...assetBlobs.value }
      rebuildAssetUrls(assetBlobs.value)
    }
    const previousGroups = new Map(questionGroups.value.map((group) => [group.groupId, group]))
    const previousSemantic = semanticData.value
    const previousBlocks = new Map(previousSemantic?.blocks.map((block) => [block.id, block]) ?? [])
    const completeBefore = (group: QuestionGroup) => {
      const previous = previousGroups.get(group.groupId)
      return previous?.sourceMarkdown === group.sourceMarkdown &&
        previous.blockIds.some((id) => previousBlocks.has(id)) &&
        previousSemantic?.meta.subject === result.semanticData.meta.subject
        ? previous
        : undefined
    }
    const parsedBlocks = new Map(result.semanticData.blocks.map((block) => [block.id, block]))
    const blocks = result.questionGroups.flatMap((group) => {
      const previous = completeBefore(group)
      const map = previous ? previousBlocks : parsedBlocks
      return (previous ?? group).blockIds.flatMap((id) => map.get(id) ?? [])
    })
    const rawGroups = result.questionGroups.map((group) => completeBefore(group) ?? group)
    const sanitized = sanitizeSheetQuestionGroups(rawGroups, blocks)
    questionGroups.value = sanitized.questionGroups
    const sameSubject = previousSemantic?.meta.subject === result.semanticData.meta.subject
    const assets = new Map(result.semanticData.assets.map((asset) => [asset.assetId, asset]))
    if (sameSubject) {
      for (const asset of previousSemantic?.assets ?? []) assets.set(asset.assetId, asset)
    }
    semanticData.value = recalcValidationReport({
      ...result.semanticData,
      meta: sameSubject && previousSemantic ? previousSemantic.meta : result.semanticData.meta,
      assets: [...assets.values()],
      blocks: sanitized.blocks,
    })
    sourceImages.value = result.sourceImages
    reviews.value = Object.fromEntries(
      questionGroups.value.map((group) => [
        group.groupId,
        (completeBefore(group) ? reviews.value[group.groupId] : undefined) ?? {
          revision: computeGroupRevision(group),
          status: 'pending',
          automaticRepairCount: 0,
          history: [],
        },
      ]),
    )
  }

  async function submitOnboardingParse(
    source: DraftSource,
    hintSubject: SubjectType | 'auto' = 'auto',
    targetSheetId?: string,
    resume = false,
  ): Promise<boolean> {
    if (isParsing.value) return false
    selectedBlockId.value = null
    parseError.value = ''
    parsedQuestions.value = []
    parseReasoning.value = []
    totalParseQuestions.value = 0
    isParsing.value = true
    parseStage.value = {
      stage: 'saving_draft',
      progress: 5,
      message: '正在保存本地原始试卷草稿...',
    }

    const activeId =
      targetSheetId ||
      (sheetList.value.some((item) => item.sheetId === sheetId.value)
        ? sheetId.value
        : `sheet-${Date.now()}`)
    sheetId.value = activeId
    draftSource.value = source

    const controller = new AbortController()
    parseAbortController = controller
    const signal = controller.signal
    const pdf = source.type === 'file' && isPdf(source.file)
    pdfParseFailures.value = []
    pdfParseIncomplete.value = pdf
    pdfHintSubject.value = pdf && hintSubject !== 'auto' ? hintSubject : undefined
    try {
      if (!resume) {
        await clearPdfCheckpoints(activeId)
        signal.throwIfAborted()
        await saveAnswerSheetDraft(
          {
            sheetId: activeId,
            updatedAt: Date.now(),
            source,
            pdfParseIncomplete: pdf,
            pdfHintSubject: pdfHintSubject.value,
            questionGroups: [],
            sourceImages: [],
            reviews: {},
          },
          [],
        )
        signal.throwIfAborted()
        await refreshSheetList()
      }
      signal.throwIfAborted()
      if (source.type === 'file' && pdf) {
        if (!resume) {
          semanticData.value = null
          questionGroups.value = []
          sourceImages.value = []
          ocrPages.value = []
          parsedQuestions.value = []
          reviews.value = {}
          undoStack.value = []
          redoStack.value = []
          assetBlobs.value = {}
          rebuildAssetUrls({})
        }
        let assetsApplied = false
        await parsePdfByPage(source.file, {
          sheetId: activeId,
          signal,
          hintSubject,
          onPageOcr(page) {
            if (!signal.aborted && sheetId.value === activeId) upsertOcrPage(page)
          },
          onQuestionParsed(event) {
            if (!signal.aborted && sheetId.value === activeId) upsertParsedQuestion(event)
          },
          onProgress({ phase, ok, total, failed }) {
            if (signal.aborted || sheetId.value !== activeId) return
            pdfParseFailures.value = failed
            parseStage.value =
              phase === 'ocr'
                ? {
                    stage: 'ocr',
                    progress: 5 + (45 * ok) / total,
                    message: `页面 OCR：${ok} / ${total} 页已完成`,
                  }
                : {
                    stage: 'ai_parsing',
                    progress: 50 + (45 * ok) / total,
                    message: `大题解析：${ok} / ${total} 题已完成`,
                  }
          },
          onReasoning(event, unit) {
            if (!signal.aborted && sheetId.value === activeId) appendParseReasoning(event, unit)
          },
          async onPartial(output) {
            signal.throwIfAborted()
            if (sheetId.value !== activeId) return
            applyPdfParseOutput(output, !assetsApplied)
            if (!(await persistDraftToLocal(!assetsApplied)))
              throw new Error(saveError.value || '保存逐题结果失败。')
            assetsApplied = true
          },
        })
        signal.throwIfAborted()
        if (sheetId.value !== activeId) return false
        pdfParseIncomplete.value = false
        if (!(await persistDraftToLocal())) {
          pdfParseIncomplete.value = true
          throw new Error(saveError.value || '保存答题卡失败。')
        }
        parseStage.value = null
        showOnboarding.value = false
        return true
      }

      const effectiveHintSubject: SubjectType | 'auto' =
        hintSubject !== 'auto'
          ? hintSubject
          : (inferSubjectFromText(
              source.type === 'file' ? source.file.name : source.text.slice(0, 400),
            ) ?? 'auto')

      const output = await parseAnswerSheetStream(source, effectiveHintSubject, {
        signal,
        onStageUpdate(event) {
          parseStage.value = event
        },
        onReasoningDelta: appendParseReasoning,
        onStarted(event) {
          totalParseQuestions.value = event.totalQuestions
        },
        onQuestionParsed(event) {
          parsedQuestions.value = [...parsedQuestions.value, event].sort(
            (a, b) => a.questionIndex - b.questionIndex,
          )
          const done = parsedQuestions.value.length
          const total = totalParseQuestions.value
          parseStage.value = {
            stage: 'ai_parsing',
            progress: total > 0 ? Math.min(95, 35 + (60 * done) / total) : 35,
            message: total > 0 ? `已处理 ${done} / ${total} 道大题` : `已处理 ${done} 道大题`,
          }
        },
        onNormalized(norm) {
          questionGroups.value = norm.questionGroups
          sourceImages.value = norm.sourceImages
        },
      })

      signal.throwIfAborted()
      if (sheetId.value !== activeId) return false
      const rawGroups = output.result.questionGroups.length
        ? output.result.questionGroups
        : buildQuestionGroupsFromBlocks(output.result.semanticData.blocks)
      const sanitized = sanitizeSheetQuestionGroups(rawGroups, output.result.semanticData.blocks)
      const nextSemantic = recalcValidationReport({
        ...output.result.semanticData,
        blocks: sanitized.blocks,
      })
      if (hintSubject !== 'auto') {
        nextSemantic.meta.subject = hintSubject
      }
      const nextLayout = createDefaultLayoutConfig(nextSemantic.meta.recommendedPaperSpec)
      const nextGroups = sanitized.questionGroups

      const blobs: Record<string, Blob> = {}
      for (const [assetId, blob] of output.assets.entries()) {
        blobs[assetId] = blob
      }
      assetBlobs.value = blobs
      rebuildAssetUrls(blobs)

      semanticData.value = nextSemantic
      layoutConfig.value = nextLayout
      questionGroups.value = nextGroups
      sourceImages.value = output.result.sourceImages

      const initReviews: Record<string, DraftQuestionReview> = {}
      for (const grp of nextGroups) {
        initReviews[grp.groupId] = {
          revision: computeGroupRevision(grp),
          status: 'pending',
          automaticRepairCount: 0,
          history: [],
        }
      }
      reviews.value = initReviews
      undoStack.value = []
      redoStack.value = []
      selectedBlockId.value = null
      showOnboarding.value = false

      await persistDraftToLocal(true)
      return true
    } catch (err) {
      if (parseAbortController === controller && sheetId.value === activeId) {
        parseError.value = signal.aborted
          ? '已停止解析，可从本地进度继续。'
          : err instanceof Error
            ? err.message
            : '解析请求中断，请从本地草稿重试。'
      }
      return false
    } finally {
      if (parseAbortController === controller) {
        isParsing.value = false
        parseAbortController = null
      }
    }
  }

  async function retryDraftParse(hintSubject: SubjectType | 'auto' = 'auto'): Promise<boolean> {
    const subject =
      hintSubject === 'auto' && pdfParseIncomplete.value
        ? (pdfHintSubject.value ?? semanticData.value?.meta.subject ?? 'auto')
        : hintSubject
    return submitOnboardingParse(draftSource.value, subject, sheetId.value, true)
  }

  function cancelOnboardingParse() {
    parseAbortController?.abort()
    isParsing.value = false
  }

  // --- Metadata & Layout Mutations ---
  function setTitle(title: string) {
    if (!semanticData.value || semanticData.value.meta.title === title) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.title = title
    })
  }

  function setSubtitle(subtitle: string) {
    if (!semanticData.value || (semanticData.value.meta.subtitle ?? '') === subtitle) return
    applyMutation(() => {
      if (semanticData.value) {
        semanticData.value.meta.subtitle = subtitle.trim() ? subtitle : undefined
      }
    })
  }

  function setSubject(subject: SubjectType) {
    if (!semanticData.value || semanticData.value.meta.subject === subject) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.subject = subject
    })
  }

  function setTotalScore(score: number) {
    if (!semanticData.value || !Number.isFinite(score) || score < 0) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.totalScore = score
    })
  }

  function setHeaderMode(mode: HeaderMode) {
    if (!semanticData.value || semanticData.value.meta.headerMode === mode) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.headerMode = mode
    })
  }

  function setIdDigits(digits: number) {
    if (!semanticData.value || !Number.isFinite(digits)) return
    const clamped = Math.max(4, Math.min(12, Math.round(digits)))
    if ((semanticData.value.meta.idDigits ?? 10) === clamped) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.idDigits = clamped
    })
  }

  function setStudentFields(fields: string[]) {
    if (!semanticData.value) return
    const cleaned = fields.map((f) => f.trim()).filter(Boolean)
    if (!cleaned.length) return
    applyMutation(() => {
      if (semanticData.value) semanticData.value.meta.studentFields = cleaned
    })
  }

  function switchPaperSpec(spec: PaperSpecId, customSize?: PaperSize) {
    applyMutation(() => {
      let next = ensurePaperOverrides(layoutConfig.value, spec)
      next = {
        ...next,
        activePaperSpec: spec,
        customPaperSize: customSize ? { ...customSize } : undefined,
      }
      layoutConfig.value = next
    })
  }

  function setCustomPaperSize(customSize?: PaperSize) {
    applyMutation(() => {
      layoutConfig.value = {
        ...layoutConfig.value,
        customPaperSize: customSize ? { ...customSize } : undefined,
      }
    })
  }

  function setDensityPreset(preset: DensityPreset) {
    if (layoutConfig.value.densityPreset === preset) return
    applyMutation(() => {
      layoutConfig.value.densityPreset = preset
    })
  }

  function setGlobalLineHeightMm(heightMm?: number) {
    const spec = layoutConfig.value.activePaperSpec
    applyMutation(() => {
      layoutConfig.value = ensurePaperOverrides(layoutConfig.value, spec)
      layoutConfig.value.perPaperOverrides[spec]!.globalLineHeightMm = heightMm
    })
  }

  function setShowBoundaryWarning(show: boolean) {
    applyMutation(() => {
      layoutConfig.value.showBoundaryWarning = show
    })
  }

  function setDefaultCompositionConfig(words: number, cols: number) {
    applyMutation(() => {
      layoutConfig.value.defaultCompositionWords = words
      layoutConfig.value.defaultCompositionCols = cols
      if (semanticData.value) {
        for (const block of semanticData.value.blocks) {
          if (block.type === 'composition_grid') {
            block.minWords = words
            block.totalGrids = Math.max(words + 100, Math.ceil((words + 150) / cols) * cols)
            block.milestones = [Math.max(100, words - 200), Math.max(100, words - 100), words]
          }
        }
      }
    })
  }

  function toggleIssueResolved(issueKey: string) {
    const current = new Set(layoutConfig.value.resolvedIssueKeys ?? [])
    if (current.has(issueKey)) {
      current.delete(issueKey)
    } else {
      current.add(issueKey)
    }
    layoutConfig.value.resolvedIssueKeys = Array.from(current)
    scheduleAutoSave()
  }

  // --- Block & Override Mutations ---
  function selectBlock(blockId: string | null) {
    selectedBlockId.value = blockId
    if (blockId) {
      const grp = questionGroups.value.find((g) => g.blockIds.includes(blockId))
      if (grp) activeGroupId.value = grp.groupId
    }
  }

  function updateBlockOverride(blockId: string, patch: Partial<BlockOverride>) {
    const spec = layoutConfig.value.activePaperSpec
    applyMutation(
      () => {
        layoutConfig.value = ensurePaperOverrides(layoutConfig.value, spec)
        const existing = layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[blockId] ?? {}
        const merged: BlockOverride = { ...existing, ...patch }
        for (const k of Object.keys(merged) as (keyof BlockOverride)[]) {
          if (merged[k] === undefined) delete merged[k]
        }
        layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[blockId] = merged
      },
      { affectedBlockIds: [blockId] },
    )
  }

  function adjustBlockLines(blockId: string, delta: number) {
    if (!semanticData.value) return
    const block = semanticData.value.blocks.find((b) => b.id === blockId)
    if (!block) return
    const spec = layoutConfig.value.activePaperSpec
    const currentOv = layoutConfig.value.perPaperOverrides[spec]?.blockOverrides[blockId]

    if (block.type === 'lined_writing') {
      const baseTotal = block.englishWritingMeta?.continuationParagraphs?.length
        ? block.englishWritingMeta.continuationParagraphs.reduce((s, p) => s + p.baseLines, 0)
        : block.subItems?.length
          ? block.subItems.reduce((s, p) => s + p.baseLines, 0)
          : block.baseLines
      const currentLines = currentOv?.manualLines ?? baseTotal
      const nextLines = Math.max(1, Math.min(40, currentLines + delta))
      applyMutation(
        () => {
          layoutConfig.value = ensurePaperOverrides(layoutConfig.value, spec)
          layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[blockId] = {
            ...currentOv,
            manualLines: nextLines,
          }
          if (
            !block.subItems?.length &&
            !block.englishWritingMeta?.continuationParagraphs?.length
          ) {
            block.baseLines = nextLines
          }
        },
        { affectedBlockIds: [blockId] },
      )
    } else if (block.type === 'mixed_inline') {
      applyMutation(
        () => {
          const fullLine = [...block.rows].reverse().find((r) => r.type === 'full_line')
          if (fullLine && fullLine.type === 'full_line') {
            fullLine.lines = Math.max(1, fullLine.lines + delta)
          } else if (delta > 0) {
            block.rows.push({
              type: 'full_line',
              label: `(${block.rows.length + 1})`,
              lines: 1,
            })
          }
        },
        { affectedBlockIds: [blockId] },
      )
    } else if (block.type === 'open_blank_box' || block.type === 'drawing_grid') {
      const currentHeight = currentOv?.manualHeightMm ?? block.baseHeightMm
      const nextHeight = Math.max(20, Math.min(240, Math.round(currentHeight + delta * 8)))
      updateBlockOverride(blockId, { manualHeightMm: nextHeight })
    } else if (block.type === 'composition_grid') {
      const cols = layoutConfig.value.defaultCompositionCols ?? 20
      applyMutation(
        () => {
          block.totalGrids = Math.max(100, block.totalGrids + delta * cols)
        },
        { affectedBlockIds: [blockId] },
      )
    }
  }

  function setBlockHeightMm(blockId: string, heightMm: number) {
    if (!semanticData.value) return
    const clamped = Math.max(14, Math.min(250, Math.round(heightMm)))
    const spec = layoutConfig.value.activePaperSpec
    applyMutation(
      () => {
        layoutConfig.value = ensurePaperOverrides(layoutConfig.value, spec)
        const existing = layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[blockId] ?? {}
        layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[blockId] = {
          ...existing,
          manualHeightMm: clamped,
        }
        const block = semanticData.value?.blocks.find((b) => b.id === blockId)
        if (block && (block.type === 'open_blank_box' || block.type === 'drawing_grid')) {
          block.baseHeightMm = clamped
        }
      },
      { affectedBlockIds: [blockId] },
    )
  }

  function toggleForceBreakBefore(blockId: string) {
    const spec = layoutConfig.value.activePaperSpec
    const current =
      layoutConfig.value.perPaperOverrides[spec]?.blockOverrides[blockId]?.forceBreakBefore ?? false
    updateBlockOverride(blockId, { forceBreakBefore: !current })
  }

  function splitOrMergeSubQuestions(blockId: string) {
    if (!semanticData.value) return
    const block = semanticData.value.blocks.find((b) => b.id === blockId)
    if (!block) return

    applyMutation(
      () => {
        if (block.type === 'lined_writing') {
          if (block.subItems && block.subItems.length > 1) {
            const totalLines = block.subItems.reduce((sum, item) => sum + item.baseLines, 0)
            block.baseLines = Math.max(2, totalLines)
            delete block.subItems
          } else {
            const half = Math.max(1, Math.floor(block.baseLines / 2))
            const rest = Math.max(1, block.baseLines - half)
            const halfScore = block.score ? Math.floor(block.score / 2) : undefined
            block.subItems = [
              { label: '(1)', score: halfScore, baseLines: half },
              {
                label: '(2)',
                score: block.score && halfScore !== undefined ? block.score - halfScore : undefined,
                baseLines: rest,
              },
            ]
          }
        } else if (block.type === 'open_blank_box') {
          if (block.subQuestions && block.subQuestions.length > 1) {
            delete block.subQuestions
          } else {
            const halfScore = block.score ? Math.floor(block.score / 2) : undefined
            block.subQuestions = [
              { subNo: '(1)', score: halfScore, heightRatio: 0.5 },
              {
                subNo: '(2)',
                score: block.score && halfScore !== undefined ? block.score - halfScore : undefined,
                heightRatio: 0.5,
              },
            ]
          }
        } else if (block.type === 'compact_blank') {
          if (block.items.length > 1) {
            block.items.pop()
          } else {
            block.items.push({ subNo: `(${block.items.length + 1})` })
          }
        } else if (block.type === 'mixed_inline') {
          if (block.rows.length > 1) {
            block.rows.pop()
          } else {
            block.rows.push({
              type: 'inline_blank',
              segments: [{ label: `(${block.rows.length + 1})`, blanksCount: 1 }],
            })
          }
        }
      },
      { affectedBlockIds: [blockId] },
    )
  }

  function updateBlock(blockId: string, updater: (block: AnswerSheetBlock) => AnswerSheetBlock) {
    if (!semanticData.value) return
    const idx = semanticData.value.blocks.findIndex((b) => b.id === blockId)
    if (idx === -1) return
    applyMutation(
      () => {
        if (!semanticData.value) return
        const current = semanticData.value.blocks[idx]
        if (!current) return
        semanticData.value.blocks[idx] = updater(deepClone(current))
      },
      { affectedBlockIds: [blockId] },
    )
  }

  function changeBlockType(blockId: string, targetType: BlockType) {
    updateBlock(blockId, (block) => convertBlockToType(block, targetType))
  }

  function addBlock(type: BlockType = 'lined_writing', afterBlockId?: string): string | null {
    if (!semanticData.value) return null
    const blocks = semanticData.value.blocks
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.numericOrder), 0)
    const afterBlock = afterBlockId ? blocks.find((b) => b.id === afterBlockId) : undefined
    const targetOrder = afterBlock ? afterBlock.numericOrder + 1 : maxOrder + 1
    const newId = `q-${Date.now().toString(36)}`
    const displayNo = String(targetOrder)

    const placeholder: AnswerSheetBlock = convertBlockToType(
      {
        id: newId,
        type: 'lined_writing',
        displayNo,
        numericOrder: targetOrder,
        score: type === 'omr_choice' ? 3 : type === 'composition_grid' ? 60 : 6,
        baseLines: 4,
      },
      type,
    )

    applyMutation(
      () => {
        if (!semanticData.value) return
        for (const b of semanticData.value.blocks) {
          if (b.numericOrder >= targetOrder) {
            b.numericOrder += 1
            if (/^\d+$/.test(b.displayNo)) {
              b.displayNo = String(b.numericOrder)
            }
          }
        }
        semanticData.value.blocks.push(placeholder)
        if (type !== 'omr_choice') {
          questionGroups.value.push({
            groupId: `group-${newId}`,
            displayNo: `第 ${placeholder.displayNo} 题`,
            sourceMarkdown: `新增题目第 ${placeholder.displayNo} 题`,
            sourceAssetIds: [],
            blockIds: [newId],
          })
        } else {
          const choiceGrp = questionGroups.value.find((g) => g.groupId.startsWith('group-choice'))
          if (choiceGrp) {
            choiceGrp.blockIds.push(newId)
          } else {
            questionGroups.value.unshift({
              groupId: `group-choice-${newId}`,
              displayNo: `选择题 (${placeholder.displayNo})`,
              sourceMarkdown: `客观选择题`,
              sourceAssetIds: [],
              blockIds: [newId],
            })
          }
        }
      },
      { affectedBlockIds: [newId] },
    )

    selectedBlockId.value = newId
    return newId
  }

  function deleteBlock(blockId: string) {
    if (!semanticData.value) return
    if (semanticData.value.blocks.length <= 1) return
    const affectedGroupIds = questionGroups.value
      .filter((g) => g.blockIds.includes(blockId))
      .map((g) => g.groupId)

    applyMutation(() => {
      if (!semanticData.value) return
      semanticData.value.blocks = semanticData.value.blocks.filter((b) => b.id !== blockId)
      questionGroups.value = questionGroups.value
        .map((g) => ({
          ...g,
          blockIds: g.blockIds.filter((id) => id !== blockId),
        }))
        .filter((g) => g.blockIds.length > 0)
      for (const gid of affectedGroupIds) {
        if (!questionGroups.value.some((g) => g.groupId === gid)) {
          delete reviews.value[gid]
        }
      }
    })

    if (selectedBlockId.value === blockId) {
      selectedBlockId.value = null
    }
  }

  function reorderSubjectiveBlocks(sourceBlockId: string, targetBlockId: string) {
    if (!semanticData.value || sourceBlockId === targetBlockId) return
    const subjective = semanticData.value.blocks
      .filter((b) => b.type !== 'omr_choice')
      .sort((a, b) => a.numericOrder - b.numericOrder)
    const fromIdx = subjective.findIndex((b) => b.id === sourceBlockId)
    const toIdx = subjective.findIndex((b) => b.id === targetBlockId)
    if (fromIdx === -1 || toIdx === -1) return

    applyMutation(
      () => {
        if (!semanticData.value) return
        const orders = subjective.map((b) => b.numericOrder)
        const reordered = [...subjective]
        const [moved] = reordered.splice(fromIdx, 1)
        if (!moved) return
        reordered.splice(toIdx, 0, moved)
        reordered.forEach((b, idx) => {
          b.numericOrder = orders[idx] ?? b.numericOrder
        })
      },
      { affectedBlockIds: [sourceBlockId, targetBlockId] },
    )
  }

  async function uploadBlockImage(blockId: string, file: File): Promise<string | null> {
    if (!semanticData.value) return null
    const assetId = `IMG_${Date.now().toString(36).toUpperCase()}`
    const dimensions = await readImageDimensions(file)

    const newAsset: SheetAsset = {
      assetId,
      mimeType: file.type || 'image/png',
      widthPx: dimensions.width,
      heightPx: dimensions.height,
      usageType: 'drawable',
      monochromeRecommended: true,
    }

    const nextBlobs = { ...assetBlobs.value, [assetId]: file }
    assetBlobs.value = nextBlobs
    rebuildAssetUrls(nextBlobs)
    await saveDraftAsset({
      sheetId: sheetId.value,
      assetId,
      blob: file,
    })

    applyMutation(
      () => {
        if (!semanticData.value) return
        semanticData.value.assets.push(newAsset)
        const block = semanticData.value.blocks.find((b) => b.id === blockId)
        if (!block) return
        if (block.type === 'open_blank_box') {
          block.attachedAssetIds = [{ assetId, position: 'top-right' }]
        } else if (block.type === 'drawing_grid') {
          block.gridType = 'image_canvas'
          block.assetId = assetId
        } else if (block.type === 'mixed_inline') {
          const existingImg = block.rows.find((r) => r.type === 'embedded_image')
          if (existingImg && existingImg.type === 'embedded_image') {
            existingImg.assetId = assetId
          } else {
            block.rows.push({ type: 'embedded_image', assetId, widthRatio: 0.75 })
          }
        }
      },
      { affectedBlockIds: [blockId] },
    )

    return assetId
  }

  // --- Per-Question AI Review & Auto-Repair Loop ---
  async function reviewQuestionGroup(
    groupId: string,
    canvasRoot?: HTMLElement,
  ): Promise<QuestionReviewResult | null> {
    if (!semanticData.value) return null
    const group = questionGroups.value.find((g) => g.groupId === groupId)
    if (!group) return null

    const expectedRevision = computeGroupRevision(group)
    const existingRecord = reviews.value[groupId]
    const prevRepairCount =
      existingRecord?.revision === expectedRevision ? existingRecord.automaticRepairCount : 0

    reviews.value = {
      ...reviews.value,
      [groupId]: {
        revision: expectedRevision,
        status: 'reviewing',
        automaticRepairCount: prevRepairCount,
        history: existingRecord?.history ?? [],
      },
    }

    const groupBlocks = group.blockIds
      .map((id) => semanticData.value?.blocks.find((b) => b.id === id))
      .filter((b): b is AnswerSheetBlock => Boolean(b))

    let result: QuestionReviewResult
    try {
      if (canvasRoot) {
        const captured = await captureQuestionReview(canvasRoot, group)
        // Guard against revision change during capture
        if (computeGroupRevision(group) !== expectedRevision) {
          return null
        }
        const imageMap = new Map<string, Blob>(captured.images)
        const reviewSourceImgs = group.sourceAssetIds
          .map((aid, idx) => {
            const meta =
              sourceImages.value.find((s) => s.assetId === aid) ??
              semanticData.value?.assets.find((a) => a.assetId === aid)
            const blob = assetBlobs.value[aid]
            if (!meta || !blob) return null
            const part = `source-${idx}`
            imageMap.set(part, blob)
            return {
              assetId: meta.assetId,
              mimeType: meta.mimeType,
              widthPx: meta.widthPx,
              heightPx: meta.heightPx,
              imagePart: part,
            }
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x))

        result = await reviewQuestionGroupApi(
          {
            group,
            subject: semanticData.value.meta.subject,
            revision: expectedRevision,
            blocks: groupBlocks,
            sourceImages: reviewSourceImgs,
            paperSpec: layoutConfig.value.activePaperSpec,
            paperSize: {
              widthMm: activePaperProfile.value.widthMm,
              heightMm: activePaperProfile.value.heightMm,
            },
            fragmentCount: captured.fragmentCount,
            fragments: captured.fragments,
          },
          imageMap,
        )
      } else {
        throw new Error('Offline fallback')
      }
    } catch {
      // Local deterministic inspection fallback when backend review endpoint is unavailable
      result = runLocalQuestionReview(group, groupBlocks, expectedRevision)
    }

    // Stale response guard: discard if group revision changed while awaiting response!
    if (computeGroupRevision(group) !== expectedRevision || result.revision !== expectedRevision) {
      return null
    }

    const currentRec = reviews.value[groupId]
    const repairCount = currentRec?.automaticRepairCount ?? 0
    const nextStatus: GroupReviewStatus =
      result.verdict === 'passed'
        ? 'passed'
        : result.verdict === 'uncertain' || repairCount >= 2
          ? 'manual_review'
          : 'needs_revision'

    reviews.value = {
      ...reviews.value,
      [groupId]: {
        revision: expectedRevision,
        status: nextStatus,
        automaticRepairCount: repairCount,
        history: [...(currentRec?.history ?? []), result],
      },
    }
    scheduleAutoSave()
    return result
  }

  function runLocalQuestionReview(
    group: QuestionGroup,
    blocks: AnswerSheetBlock[],
    revision: string,
  ): QuestionReviewResult {
    const spec = layoutConfig.value.activePaperSpec
    const paperOv = layoutConfig.value.perPaperOverrides[spec]
    const lineHeight = paperOv?.globalLineHeightMm ?? 8
    const issues: QuestionReviewIssue[] = []

    for (const block of blocks) {
      const ov = paperOv?.blockOverrides[block.id]
      if (block.type === 'lined_writing') {
        const lines = ov?.manualLines ?? block.baseLines
        const minRecommended = block.score ? Math.max(2, Math.ceil(block.score / 2)) : 2
        if (lines < minRecommended) {
          issues.push({
            kind: 'layout',
            blockId: block.id,
            subNo: block.subItems?.[0]?.label,
            evidence: `第 ${block.displayNo} 题（${block.score ?? 0} 分）当前仅配置 ${lines} 行（行高 ${lineHeight}mm），低于该分值建议的 ${minRecommended} 行书写容量。`,
            suggestion: `建议增加 ${minRecommended - lines} 行手写横线（共 ${minRecommended} 行）。`,
          })
        }
      } else if (block.type === 'open_blank_box') {
        const heightMm = ov?.manualHeightMm ?? block.baseHeightMm
        const minHeight = block.score && block.score >= 12 ? 75 : 50
        if (heightMm < minHeight) {
          issues.push({
            kind: 'layout',
            blockId: block.id,
            evidence: `第 ${block.displayNo} 题解答框当前净高 ${heightMm}mm，低于 ${block.score ?? 10} 分解答题建议高度 ${minHeight}mm。`,
            suggestion: `建议将空白框高度调至 ${minHeight}mm 以上。`,
          })
        }
      }
    }

    return {
      groupId: group.groupId,
      revision,
      verdict: issues.length === 0 ? 'passed' : 'needs_revision',
      issues,
    }
  }

  async function applyAutoRepairForGroup(
    groupId: string,
    canvasRoot?: HTMLElement,
  ): Promise<boolean> {
    if (!semanticData.value) return false
    const group = questionGroups.value.find((g) => g.groupId === groupId)
    if (!group) return false
    const record = reviews.value[groupId]
    if (!record) return false

    if (record.automaticRepairCount >= 2) {
      reviews.value = {
        ...reviews.value,
        [groupId]: {
          ...record,
          status: 'manual_review',
        },
      }
      scheduleAutoSave()
      return false
    }

    const latest = record.history[record.history.length - 1]
    const issues = latest?.issues ?? []
    if (!issues.length) return false

    const nextRepairCount = record.automaticRepairCount + 1
    const semanticIssues = issues.filter((i) => i.kind === 'semantic')

    recordSnapshot()

    if (semanticIssues.length > 0) {
      try {
        const groupBlocks = group.blockIds
          .map((id) => semanticData.value?.blocks.find((b) => b.id === id))
          .filter((b): b is AnswerSheetBlock => Boolean(b))
        const imgMap = new Map<string, Blob>()
        const reparseResult = await reparseQuestionGroupApi(
          {
            group,
            subject: semanticData.value.meta.subject,
            revision: record.revision,
            blocks: groupBlocks,
            sourceImages: [],
            issues: semanticIssues,
          },
          imgMap,
        )
        if (reparseResult.blocks.length > 0 && semanticData.value) {
          const sanitized = sanitizeBigQuestionOmrBlocks(group, reparseResult.blocks)
          const oldSet = new Set(group.blockIds)
          const remaining = semanticData.value.blocks.filter((b) => !oldSet.has(b.id))
          semanticData.value.blocks = [...remaining, ...sanitized.blocks].sort(
            (a, b) => a.numericOrder - b.numericOrder,
          )
          group.blockIds = sanitized.group.blockIds
        }
      } catch {
        // Fallback if backend reparse is unavailable
      }
    }

    // Apply layout adjustments for layout issues
    const spec = layoutConfig.value.activePaperSpec
    layoutConfig.value = ensurePaperOverrides(layoutConfig.value, spec)
    for (const issue of issues) {
      const targetId = issue.blockId ?? group.blockIds[0]
      if (!targetId || !semanticData.value) continue
      const block = semanticData.value.blocks.find((b) => b.id === targetId)
      if (!block) continue
      const currentOv = layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[targetId] ?? {}
      if (block.type === 'lined_writing') {
        const currentLines = currentOv.manualLines ?? block.baseLines
        const nextLines = currentLines + 2
        block.baseLines = nextLines
        layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[targetId] = {
          ...currentOv,
          manualLines: nextLines,
        }
      } else if (block.type === 'open_blank_box' || block.type === 'drawing_grid') {
        const currentH = currentOv.manualHeightMm ?? block.baseHeightMm
        const nextH = Math.min(220, currentH + 20)
        block.baseHeightMm = nextH
        layoutConfig.value.perPaperOverrides[spec]!.blockOverrides[targetId] = {
          ...currentOv,
          manualHeightMm: nextH,
        }
      }
    }

    const updatedRevision = computeGroupRevision(group)
    reviews.value = {
      ...reviews.value,
      [groupId]: {
        revision: updatedRevision,
        status: nextRepairCount >= 2 ? 'manual_review' : 'pending',
        automaticRepairCount: nextRepairCount,
        history: record.history,
      },
    }

    if (nextRepairCount < 2) {
      await reviewQuestionGroup(groupId, canvasRoot)
    } else {
      scheduleAutoSave()
    }
    return true
  }

  function markGroupManualVerified(groupId: string) {
    const group = questionGroups.value.find((g) => g.groupId === groupId)
    if (!group) return
    const rev = computeGroupRevision(group)
    const existing = reviews.value[groupId]
    const passedResult: QuestionReviewResult = {
      groupId,
      revision: rev,
      verdict: 'passed',
      issues: [],
    }
    reviews.value = {
      ...reviews.value,
      [groupId]: {
        revision: rev,
        status: 'passed',
        automaticRepairCount: existing?.automaticRepairCount ?? 0,
        history: [...(existing?.history ?? []), passedResult],
      },
    }
    scheduleAutoSave()
  }

  async function resetAllDrafts() {
    cancelAutoSave()
    await clearAnswerSheetDrafts()
    sheetList.value = []
    semanticData.value = null
    questionGroups.value = []
    sourceImages.value = []
    reviews.value = {}
    assetBlobs.value = {}
    rebuildAssetUrls({})
    selectedBlockId.value = null
  }

  return {
    sheetList,
    sheetId,
    draftSource,
    semanticData,
    layoutConfig,
    questionGroups,
    sourceImages,
    reviews,
    assetBlobs,
    assetUrls,
    assetsMap,
    selectedBlockId,
    highlightedBlockId,
    activeGroupId,
    selectedBlock,
    selectedBlockOverride,
    activePaperSpec,
    activePaperProfile,
    currentPaperOverrides,
    resolvedIssueKeySet,
    unpassedQuestionGroups,
    hasSheet,
    canUndo,
    canRedo,
    showOnboarding,
    isParsing,
    pdfParseIncomplete,
    pdfHintSubject,
    pdfParseFailures,
    parseStage,
    parseReasoning,
    ocrPages,
    parsedQuestions,
    parseError,
    loadDebugCheckpoints,
    isSaving,
    lastSavedAt,
    saveError,
    computeGroupRevision,
    getGroupReviewState,
    syncPaginatedLayoutFingerprints,
    initializeWorkbench,
    refreshSheetList,
    createNewAnswerSheet,
    selectAnswerSheet,
    deleteAnswerSheet,
    loadSamplePreset,
    restoreFromIndexedDB,
    persistDraftToLocal,
    submitOnboardingParse,
    retryDraftParse,
    cancelOnboardingParse,
    undo,
    redo,
    setTitle,
    setSubtitle,
    setSubject,
    setTotalScore,
    setHeaderMode,
    setIdDigits,
    setStudentFields,
    switchPaperSpec,
    setCustomPaperSize,
    setDensityPreset,
    setGlobalLineHeightMm,
    setShowBoundaryWarning,
    setDefaultCompositionConfig,
    toggleIssueResolved,
    selectBlock,
    updateBlockOverride,
    adjustBlockLines,
    setBlockHeightMm,
    toggleForceBreakBefore,
    splitOrMergeSubQuestions,
    updateBlock,
    changeBlockType,
    addBlock,
    deleteBlock,
    reorderSubjectiveBlocks,
    uploadBlockImage,
    reviewQuestionGroup,
    applyAutoRepairForGroup,
    markGroupManualVerified,
    resetAllDrafts,
  }
})

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve({ width: 320, height: 180 })
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth || 320
      const height = img.naturalHeight || 180
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 320, height: 180 })
    }
    img.src = url
  })
}
