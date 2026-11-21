import type { PdfCheckpoint } from './pdfPipelineTypes'
import type { QuestionGroup, QuestionReviewResult, QuestionSourceImage } from './review'
import type {
  AnswerSheetLayoutConfig,
  AnswerSheetSemanticData,
  PaperSpecId,
  SubjectType,
} from './types'

export type DraftSource = { type: 'file'; file: File } | { type: 'text'; text: string }

export interface AnswerSheetListItem {
  sheetId: string
  title: string
  subject?: SubjectType
  updatedAt: number
  sourceName: string
  hasSemanticData: boolean
  blockCount: number
  totalScore: number
  activePaperSpec: PaperSpecId
}

export type GroupReviewStatus =
  | 'pending'
  | 'reviewing'
  | 'passed'
  | 'needs_revision'
  | 'manual_review'

export interface DraftQuestionReview {
  revision: string
  status?: GroupReviewStatus
  automaticRepairCount: number
  history: QuestionReviewResult[]
}

export interface AnswerSheetDraft {
  sheetId: string
  updatedAt?: number
  source: DraftSource
  pdfParseIncomplete?: boolean
  pdfHintSubject?: SubjectType
  semanticData?: AnswerSheetSemanticData
  layoutConfig?: AnswerSheetLayoutConfig
  questionGroups: QuestionGroup[]
  sourceImages: QuestionSourceImage[]
  reviews: Record<string, DraftQuestionReview>
}

export interface DraftAsset {
  sheetId: string
  assetId: string
  blob: Blob
}

const DB_NAME = 'tools_answer_sheet_db'
const DB_VERSION = 2
const STORE_DRAFTS = 'drafts'
const STORE_SEMANTICS = 'semantics'
const STORE_LAYOUTS = 'layouts'
const STORE_ASSETS = 'assets'
const STORE_PDF_UNITS = 'pdf_units'

interface StoredPdfUnit {
  sheetId: string
  unitKey: string
  unit: PdfCheckpoint
}

const memoryPdfUnits = new Map<string, Map<string, PdfCheckpoint>>()

interface StoredDraftMeta {
  sheetId: string
  updatedAt: number
  source: DraftSource
  pdfParseIncomplete?: boolean
  pdfHintSubject?: SubjectType
  questionGroups: QuestionGroup[]
  sourceImages: QuestionSourceImage[]
  reviews: Record<string, DraftQuestionReview>
}

interface StoredSemanticRecord {
  sheetId: string
  semanticData: AnswerSheetSemanticData
}

interface StoredLayoutRecord {
  sheetId: string
  layoutConfig: AnswerSheetLayoutConfig
}

const memoryDrafts = new Map<string, StoredDraftMeta>()
const memorySemantics = new Map<string, AnswerSheetSemanticData>()
const memoryLayouts = new Map<string, AnswerSheetLayoutConfig>()
const memoryAssets = new Map<string, DraftAsset>()

function cloneValue<T>(val: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(val)
    } catch {
      // Fallback for non-clonable objects
    }
  }
  return JSON.parse(JSON.stringify(val)) as T
}

export function createEmptyPerPaperOverrides(): AnswerSheetLayoutConfig['perPaperOverrides'] {
  return {
    A3_2COL: { blockOverrides: {} },
    A3_3COL: { blockOverrides: {} },
    '8K_2COL': { blockOverrides: {} },
    '8K_B4_2COL': { blockOverrides: {} },
    A4_1COL: { blockOverrides: {} },
  }
}

export function createDefaultLayoutConfig(
  recommendedSpec: PaperSpecId = '8K_2COL',
): AnswerSheetLayoutConfig {
  return {
    activePaperSpec: recommendedSpec,
    densityPreset: 'normal',
    showBoundaryWarning: false,
    defaultCompositionWords: 800,
    defaultCompositionCols: 25,
    resolvedIssueKeys: [],
    perPaperOverrides: createEmptyPerPaperOverrides(),
  }
}

export function ensurePaperOverrides(
  config: AnswerSheetLayoutConfig,
  spec: PaperSpecId,
): AnswerSheetLayoutConfig {
  const existing = config.perPaperOverrides[spec]
  if (existing && existing.blockOverrides) return config
  return {
    ...config,
    perPaperOverrides: {
      ...createEmptyPerPaperOverrides(),
      ...config.perPaperOverrides,
      [spec]: {
        globalLineHeightMm: existing?.globalLineHeightMm,
        blockOverrides: existing?.blockOverrides ?? {},
      },
    },
  }
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'sheetId' })
      }
      if (!db.objectStoreNames.contains(STORE_SEMANTICS)) {
        db.createObjectStore(STORE_SEMANTICS, { keyPath: 'sheetId' })
      }
      if (!db.objectStoreNames.contains(STORE_LAYOUTS)) {
        db.createObjectStore(STORE_LAYOUTS, { keyPath: 'sheetId' })
      }
      if (!db.objectStoreNames.contains(STORE_PDF_UNITS)) {
        const store = db.createObjectStore(STORE_PDF_UNITS, { keyPath: ['sheetId', 'unitKey'] })
        store.createIndex('by_sheet', 'sheetId')
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const assetStore = db.createObjectStore(STORE_ASSETS, { keyPath: ['sheetId', 'assetId'] })
        assetStore.createIndex('by_sheet', 'sheetId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开本地数据库失败'))
  })
}

export async function saveAnswerSheetDraft(
  draft: AnswerSheetDraft,
  assets?: DraftAsset[],
): Promise<void> {
  const now = draft.updatedAt ?? Date.now()
  const metaRecord: StoredDraftMeta = {
    sheetId: draft.sheetId,
    updatedAt: now,
    source: draft.source,
    pdfParseIncomplete: draft.pdfParseIncomplete,
    pdfHintSubject: draft.pdfHintSubject,
    questionGroups: cloneValue(draft.questionGroups),
    sourceImages: cloneValue(draft.sourceImages),
    reviews: cloneValue(draft.reviews),
  }

  memoryDrafts.set(draft.sheetId, metaRecord)
  if (draft.semanticData) {
    memorySemantics.set(draft.sheetId, cloneValue(draft.semanticData))
  } else {
    memorySemantics.delete(draft.sheetId)
  }
  if (draft.layoutConfig) {
    memoryLayouts.set(draft.sheetId, cloneValue(draft.layoutConfig))
  } else {
    memoryLayouts.delete(draft.sheetId)
  }
  if (assets) {
    for (const key of Array.from(memoryAssets.keys())) {
      if (key.startsWith(`${draft.sheetId}::`)) memoryAssets.delete(key)
    }
    for (const asset of assets) {
      memoryAssets.set(`${asset.sheetId}::${asset.assetId}`, asset)
    }
  }

  if (!hasIndexedDB()) return

  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const storeNames = [STORE_DRAFTS, STORE_SEMANTICS, STORE_LAYOUTS]
      if (assets) storeNames.push(STORE_ASSETS)
      const tx = db.transaction(storeNames, 'readwrite')

      tx.objectStore(STORE_DRAFTS).put(metaRecord)

      const semanticStore = tx.objectStore(STORE_SEMANTICS)
      if (draft.semanticData) {
        const semRecord: StoredSemanticRecord = {
          sheetId: draft.sheetId,
          semanticData: cloneValue(draft.semanticData),
        }
        semanticStore.put(semRecord)
      } else {
        semanticStore.delete(draft.sheetId)
      }

      const layoutStore = tx.objectStore(STORE_LAYOUTS)
      if (draft.layoutConfig) {
        const layRecord: StoredLayoutRecord = {
          sheetId: draft.sheetId,
          layoutConfig: cloneValue(draft.layoutConfig),
        }
        layoutStore.put(layRecord)
      } else {
        layoutStore.delete(draft.sheetId)
      }

      if (assets) {
        const assetStore = tx.objectStore(STORE_ASSETS)
        const retained = new Set(assets.map((asset) => asset.assetId))
        const existing = assetStore.index('by_sheet').openKeyCursor(draft.sheetId)
        existing.onsuccess = () => {
          const cursor = existing.result
          if (!cursor) return
          const [, assetId] = cursor.primaryKey as [string, string]
          if (!retained.has(assetId)) assetStore.delete(cursor.primaryKey)
          cursor.continue()
        }
        for (const asset of assets) {
          assetStore.put({
            sheetId: asset.sheetId,
            assetId: asset.assetId,
            blob: asset.blob,
          })
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('保存本地草稿事务失败'))
      tx.onabort = () => reject(tx.error ?? new Error('本地草稿事务已中止'))
    })
  } finally {
    db.close()
  }
}

export async function saveDraftAsset(asset: DraftAsset): Promise<void> {
  memoryAssets.set(`${asset.sheetId}::${asset.assetId}`, asset)
  if (!hasIndexedDB()) return
  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_ASSETS], 'readwrite')
      tx.objectStore(STORE_ASSETS).put({
        sheetId: asset.sheetId,
        assetId: asset.assetId,
        blob: asset.blob,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('保存配图资产失败'))
    })
  } finally {
    db.close()
  }
}

export async function loadAnswerSheetDraft(sheetId?: string): Promise<{
  draft: AnswerSheetDraft
  assets: DraftAsset[]
} | null> {
  if (!hasIndexedDB()) {
    let targetId = sheetId
    if (!targetId) {
      let latest = -1
      for (const [id, meta] of memoryDrafts.entries()) {
        if (meta.updatedAt > latest) {
          latest = meta.updatedAt
          targetId = id
        }
      }
    }
    if (!targetId) return null
    const meta = memoryDrafts.get(targetId)
    if (!meta) return null
    const semanticData = memorySemantics.get(targetId)
    const layoutConfig = memoryLayouts.get(targetId)
    const assets: DraftAsset[] = []
    for (const [key, val] of memoryAssets.entries()) {
      if (key.startsWith(`${targetId}::`)) assets.push(val)
    }
    return {
      draft: {
        sheetId: meta.sheetId,
        updatedAt: meta.updatedAt,
        source: meta.source,
        pdfParseIncomplete: meta.pdfParseIncomplete,
        pdfHintSubject: meta.pdfHintSubject,
        semanticData: semanticData ? cloneValue(semanticData) : undefined,
        layoutConfig: layoutConfig ? cloneValue(layoutConfig) : undefined,
        questionGroups: cloneValue(meta.questionGroups),
        sourceImages: cloneValue(meta.sourceImages),
        reviews: cloneValue(meta.reviews),
      },
      assets,
    }
  }

  const db = await openDraftDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_DRAFTS, STORE_SEMANTICS, STORE_LAYOUTS, STORE_ASSETS],
        'readonly',
      )
      const draftStore = tx.objectStore(STORE_DRAFTS)

      const resolveWithMeta = (meta: StoredDraftMeta | undefined) => {
        if (!meta) {
          resolve(null)
          return
        }
        const semReq = tx.objectStore(STORE_SEMANTICS).get(meta.sheetId)
        const layReq = tx.objectStore(STORE_LAYOUTS).get(meta.sheetId)
        const assetIdx = tx.objectStore(STORE_ASSETS).index('by_sheet')
        const assetsReq = assetIdx.getAll(IDBKeyRange.only(meta.sheetId))

        assetsReq.onsuccess = () => {
          const semRecord = semReq.result as StoredSemanticRecord | undefined
          const layRecord = layReq.result as StoredLayoutRecord | undefined
          const assetsList = (assetsReq.result as DraftAsset[] | undefined) ?? []
          resolve({
            draft: {
              sheetId: meta.sheetId,
              updatedAt: meta.updatedAt,
              source: meta.source,
              pdfParseIncomplete: meta.pdfParseIncomplete,
              pdfHintSubject: meta.pdfHintSubject,
              semanticData: semRecord?.semanticData,
              layoutConfig: layRecord?.layoutConfig,
              questionGroups: meta.questionGroups ?? [],
              sourceImages: meta.sourceImages ?? [],
              reviews: meta.reviews ?? {},
            },
            assets: assetsList,
          })
        }
      }

      if (sheetId) {
        const req = draftStore.get(sheetId)
        req.onsuccess = () => resolveWithMeta(req.result as StoredDraftMeta | undefined)
      } else {
        const allReq = draftStore.getAll()
        allReq.onsuccess = () => {
          const all = (allReq.result as StoredDraftMeta[] | undefined) ?? []
          all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          resolveWithMeta(all[0])
        }
      }

      tx.onerror = () => reject(tx.error ?? new Error('读取本地草稿失败'))
    })
  } finally {
    db.close()
  }
}

export async function listAnswerSheetDrafts(): Promise<AnswerSheetListItem[]> {
  const buildListItem = (
    meta: StoredDraftMeta,
    sem?: AnswerSheetSemanticData,
    lay?: AnswerSheetLayoutConfig,
  ): AnswerSheetListItem => {
    const sourceName =
      meta.source.type === 'file'
        ? meta.source.file.name || '上传试卷文件'
        : meta.source.text.trim()
          ? meta.source.text.trim().slice(0, 24)
          : '未选择试卷文件'
    const fallbackTitle =
      meta.source.type === 'file' && meta.source.file.name
        ? meta.source.file.name.replace(/\.[^.]+$/, '')
        : '新建答题卡'
    return {
      sheetId: meta.sheetId,
      title: sem?.meta.title || fallbackTitle,
      subject: sem?.meta.subject,
      updatedAt: meta.updatedAt ?? 0,
      sourceName,
      hasSemanticData: Boolean(sem),
      blockCount: sem?.blocks.length ?? 0,
      totalScore: sem?.meta.totalScore ?? 0,
      activePaperSpec: lay?.activePaperSpec ?? sem?.meta.recommendedPaperSpec ?? '8K_2COL',
    }
  }

  if (!hasIndexedDB()) {
    const items: AnswerSheetListItem[] = []
    for (const [id, meta] of memoryDrafts.entries()) {
      items.push(buildListItem(meta, memorySemantics.get(id), memoryLayouts.get(id)))
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const db = await openDraftDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DRAFTS, STORE_SEMANTICS, STORE_LAYOUTS], 'readonly')
      const draftsReq = tx.objectStore(STORE_DRAFTS).getAll()
      const semsReq = tx.objectStore(STORE_SEMANTICS).getAll()
      const laysReq = tx.objectStore(STORE_LAYOUTS).getAll()

      tx.oncomplete = () => {
        const metas = (draftsReq.result as StoredDraftMeta[] | undefined) ?? []
        const sems = (semsReq.result as StoredSemanticRecord[] | undefined) ?? []
        const lays = (laysReq.result as StoredLayoutRecord[] | undefined) ?? []
        const semMap = new Map(sems.map((s) => [s.sheetId, s.semanticData]))
        const layMap = new Map(lays.map((l) => [l.sheetId, l.layoutConfig]))

        const items = metas
          .map((m) => buildListItem(m, semMap.get(m.sheetId), layMap.get(m.sheetId)))
          .sort((a, b) => b.updatedAt - a.updatedAt)
        resolve(items)
      }
      tx.onerror = () => reject(tx.error ?? new Error('读取答题卡列表失败'))
    })
  } finally {
    db.close()
  }
}

export async function loadPdfCheckpoints(sheetId: string): Promise<PdfCheckpoint[]> {
  if (!hasIndexedDB()) return [...(memoryPdfUnits.get(sheetId)?.values() ?? [])]
  const db = await openDraftDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PDF_UNITS, 'readonly')
      const request = tx.objectStore(STORE_PDF_UNITS).index('by_sheet').getAll(sheetId)
      request.onsuccess = () => resolve((request.result as StoredPdfUnit[]).map(({ unit }) => unit))
      request.onerror = () => reject(request.error ?? new Error('读取 PDF 解析进度失败'))
    })
  } finally {
    db.close()
  }
}

function removePdfUnits(store: IDBObjectStore, sheetId: string) {
  const request = store.index('by_sheet').getAllKeys(sheetId)
  request.onsuccess = () => {
    for (const key of request.result) store.delete(key)
  }
}

async function writePdfUnits(sheetId: string, unit?: PdfCheckpoint): Promise<void> {
  const unitKey = unit
    ? unit.type === 'page'
      ? `page:${unit.result.page}`
      : `question:${unit.subject}:${unit.result.group.groupId}`
    : ''
  if (!hasIndexedDB()) {
    if (!unit) {
      memoryPdfUnits.delete(sheetId)
      return
    }
    const units = memoryPdfUnits.get(sheetId) ?? new Map<string, PdfCheckpoint>()
    units.set(unitKey, unit)
    memoryPdfUnits.set(sheetId, units)
    return
  }
  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PDF_UNITS, 'readwrite')
      const store = tx.objectStore(STORE_PDF_UNITS)
      if (unit) store.put({ sheetId, unitKey, unit } satisfies StoredPdfUnit)
      else removePdfUnits(store, sheetId)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('保存 PDF 解析进度失败'))
    })
  } finally {
    db.close()
  }
}

export const savePdfCheckpoint = (sheetId: string, unit: PdfCheckpoint) =>
  writePdfUnits(sheetId, unit)
export const clearPdfCheckpoints = (sheetId: string) => writePdfUnits(sheetId)

export async function deleteAnswerSheetDraft(sheetId: string): Promise<void> {
  memoryPdfUnits.delete(sheetId)
  memoryDrafts.delete(sheetId)
  memorySemantics.delete(sheetId)
  memoryLayouts.delete(sheetId)
  for (const key of Array.from(memoryAssets.keys())) {
    if (key.startsWith(`${sheetId}::`)) memoryAssets.delete(key)
  }

  if (!hasIndexedDB()) return

  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORE_DRAFTS, STORE_SEMANTICS, STORE_LAYOUTS, STORE_ASSETS, STORE_PDF_UNITS],
        'readwrite',
      )
      removePdfUnits(tx.objectStore(STORE_PDF_UNITS), sheetId)
      tx.objectStore(STORE_DRAFTS).delete(sheetId)
      tx.objectStore(STORE_SEMANTICS).delete(sheetId)
      tx.objectStore(STORE_LAYOUTS).delete(sheetId)

      const assetStore = tx.objectStore(STORE_ASSETS)
      const assetIdx = assetStore.index('by_sheet')
      const keysReq = assetIdx.getAllKeys(IDBKeyRange.only(sheetId))
      keysReq.onsuccess = () => {
        const keys = keysReq.result ?? []
        for (const k of keys) {
          assetStore.delete(k)
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('删除本地答题卡失败'))
    })
  } finally {
    db.close()
  }
}

export async function clearAnswerSheetDrafts(): Promise<void> {
  memoryPdfUnits.clear()
  memoryDrafts.clear()
  memorySemantics.clear()
  memoryLayouts.clear()
  memoryAssets.clear()
  if (!hasIndexedDB()) return
  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORE_DRAFTS, STORE_SEMANTICS, STORE_LAYOUTS, STORE_ASSETS, STORE_PDF_UNITS],
        'readwrite',
      )
      tx.objectStore(STORE_DRAFTS).clear()
      tx.objectStore(STORE_SEMANTICS).clear()
      tx.objectStore(STORE_LAYOUTS).clear()
      tx.objectStore(STORE_ASSETS).clear()
      tx.objectStore(STORE_PDF_UNITS).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('清空本地草稿失败'))
    })
  } finally {
    db.close()
  }
}
