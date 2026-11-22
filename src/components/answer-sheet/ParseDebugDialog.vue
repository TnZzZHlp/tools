<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Check,
  Copy,
  Crosshair,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Search,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isAnswerOrAdPage, isPdf } from '@/lib/answer-sheet/pdfPipeline'
import { BLOCK_TYPE_LABELS, SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type { QuestionGroup } from '@/lib/answer-sheet/review'
import type { AnswerSheetBlock, ValidationIssue } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    initialTab?: 'pages' | 'questions'
    initialGroupId?: string | null
  }>(),
  {
    initialTab: 'pages',
    initialGroupId: null,
  },
)

const emit = defineEmits<{
  locateBlock: [blockId: string]
}>()

const store = useAnswerSheetStore()

const activeTab = ref<'pages' | 'questions'>('pages')
const selectedPageNo = ref<number | null>(null)
const selectedGroupId = ref<string | null>(null)
const questionQuery = ref('')
const onlyIssueQuestions = ref(false)
const copiedKey = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

// Original PDF page preview rendering state
const pageCanvasRef = ref<HTMLCanvasElement | null>(null)
const pdfPreviewLoading = ref(false)
const pdfPreviewError = ref('')
let loadedPdfFile: File | null = null
let loadedPdfTask: { destroyed: boolean; destroy: () => Promise<void> } | null = null
let loadedPdfDoc: PDFDocumentProxy | null = null
let loadingDocPromise: Promise<PDFDocumentProxy> | null = null
let activeRenderTask: { cancel: () => void } | null = null
let renderSeq = 0

// Original image file preview URL (for non-PDF image uploads)
const imageFilePreviewUrl = ref<string | null>(null)

function clearImageFilePreview() {
  if (imageFilePreviewUrl.value) {
    try {
      URL.revokeObjectURL(imageFilePreviewUrl.value)
    } catch {
      // ignore
    }
    imageFilePreviewUrl.value = null
  }
}

async function destroyPdfDoc() {
  renderSeq += 1
  activeRenderTask?.cancel()
  activeRenderTask = null
  loadedPdfFile = null
  loadedPdfDoc = null
  loadingDocPromise = null
  pdfPreviewLoading.value = false
  if (loadedPdfTask && !loadedPdfTask.destroyed) {
    try {
      await loadedPdfTask.destroy()
    } catch {
      // ignore
    }
  }
  loadedPdfTask = null
}

const isPdfSource = computed(
  () => store.draftSource.type === 'file' && isPdf(store.draftSource.file),
)
const isImageSource = computed(
  () =>
    store.draftSource.type === 'file' &&
    store.draftSource.file.type.startsWith('image/') &&
    !isPdf(store.draftSource.file),
)

watch(
  () => store.draftSource,
  (src) => {
    clearImageFilePreview()
    void destroyPdfDoc()
    if (src.type === 'file' && src.file.type.startsWith('image/')) {
      if (typeof URL.createObjectURL === 'function') {
        imageFilePreviewUrl.value = URL.createObjectURL(src.file)
      }
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearImageFilePreview()
  void destroyPdfDoc()
  if (copiedTimer) clearTimeout(copiedTimer)
})

// Page list with line ranges & skipped flag (mirroring assembleOcrPages)
const debugPages = computed(() => {
  let assembledLineCursor = 0
  return store.ocrPages.map((page) => {
    const skipped = page.page > 1 && isAnswerOrAdPage(page.markdown)
    const rawLines = page.markdown.trimEnd().split('\n')
    const startLine = skipped ? null : assembledLineCursor + 1
    if (!skipped) {
      assembledLineCursor += rawLines.length
    }
    const endLine = skipped ? null : assembledLineCursor
    return {
      ...page,
      skipped,
      lines: rawLines,
      charCount: page.markdown.length,
      startLine,
      endLine,
    }
  })
})

const selectedPage = computed(() => {
  if (!debugPages.value.length) return null
  return (
    debugPages.value.find((p) => p.page === selectedPageNo.value) ?? debugPages.value[0] ?? null
  )
})

// Question debug records combining QuestionGroup + semanticData blocks + parsedQuestions + issues
interface DebugQuestionEntry {
  group: QuestionGroup
  blocks: AnswerSheetBlock[]
  issues: ValidationIssue[]
  hasError: boolean
  hasWarning: boolean
}

const blocksById = computed(() => {
  const map = new Map<string, AnswerSheetBlock>()
  for (const block of store.semanticData?.blocks ?? []) {
    map.set(block.id, block)
  }
  return map
})

const parsedByGroupId = computed(() => {
  const map = new Map<string, (typeof store.parsedQuestions)[number]>()
  for (const entry of store.parsedQuestions) {
    map.set(entry.group.groupId, entry)
  }
  return map
})

const debugQuestions = computed<DebugQuestionEntry[]>(() => {
  const allValidationIssues = store.semanticData?.validation.issues ?? []
  const baseGroups: QuestionGroup[] = store.questionGroups.length
    ? store.questionGroups
    : store.parsedQuestions.map((q) => q.group)

  return baseGroups.map((group) => {
    const parsedEntry = parsedByGroupId.value.get(group.groupId)
    const fromSemantic = group.blockIds
      .map((id) => blocksById.value.get(id))
      .filter((b): b is AnswerSheetBlock => Boolean(b))
    const blocks = fromSemantic.length ? fromSemantic : (parsedEntry?.blocks ?? [])
    const blockIdSet = new Set(blocks.map((b) => b.id))
    const relatedValidation = allValidationIssues.filter(
      (issue) =>
        (issue.relatedBlockId && blockIdSet.has(issue.relatedBlockId)) ||
        (group.displayNo && issue.message.includes(`第 ${group.displayNo} 题`)),
    )
    const mergedIssues: ValidationIssue[] = [...relatedValidation]
    for (const issue of parsedEntry?.issues ?? []) {
      if (!mergedIssues.some((m) => m.code === issue.code && m.message === issue.message)) {
        mergedIssues.push(issue)
      }
    }
    const hasError = blocks.length === 0 || mergedIssues.some((issue) => issue.severity === 'error')
    const hasWarning = mergedIssues.some((issue) => issue.severity === 'warning')
    return {
      group,
      blocks,
      issues: mergedIssues,
      hasError,
      hasWarning,
    }
  })
})

const filteredQuestions = computed(() => {
  const q = questionQuery.value.trim().toLowerCase()
  return debugQuestions.value.filter((entry) => {
    if (onlyIssueQuestions.value && !entry.hasError && !entry.hasWarning) return false
    if (!q) return true
    if (entry.group.displayNo.toLowerCase().includes(q)) return true
    if (entry.group.groupId.toLowerCase().includes(q)) return true
    if (entry.group.sourceMarkdown.toLowerCase().includes(q)) return true
    if (
      entry.blocks.some(
        (b) =>
          b.displayNo.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) ||
          BLOCK_TYPE_LABELS[b.type].toLowerCase().includes(q),
      )
    ) {
      return true
    }
    return false
  })
})

const selectedQuestion = computed<DebugQuestionEntry | null>(() => {
  if (!filteredQuestions.value.length) return null
  return (
    filteredQuestions.value.find((q) => q.group.groupId === selectedGroupId.value) ??
    filteredQuestions.value[0] ??
    null
  )
})

const selectedQuestionJson = computed(() => {
  if (!selectedQuestion.value) return ''
  return JSON.stringify(selectedQuestion.value.blocks, null, 2)
})

function summarizeBlock(block: AnswerSheetBlock): string {
  switch (block.type) {
    case 'omr_choice':
      return `${block.options.join('/')} · ${block.isMultiple ? '多选' : '单选'}`
    case 'compact_blank':
      return `${block.items.length} 空 · ${block.preferredColumns} 列`
    case 'mixed_inline':
      return `${block.rows.length} 行混合作答`
    case 'open_blank_box':
      return `高度 ${block.baseHeightMm}mm${block.subQuestions?.length ? ` · ${block.subQuestions.length} 小问` : ''}`
    case 'lined_writing':
      return `${block.baseLines} 行${block.subItems?.length ? ` · ${block.subItems.length} 小问` : ''}`
    case 'composition_grid':
      return `${block.totalGrids} 格（≥${block.minWords}字）`
    case 'drawing_grid':
      return `${block.gridType} · ${block.baseHeightMm}mm`
  }
}

async function copyText(key: string, text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedKey.value = null
    }, 1500)
  } catch {
    // ignore clipboard failures
  }
}

function copyAllDebugJson() {
  const payload = {
    sheetId: store.sheetId,
    meta: store.semanticData?.meta ?? null,
    ocrPages: debugPages.value.map((p) => ({
      page: p.page,
      skipped: p.skipped,
      startLine: p.startLine,
      endLine: p.endLine,
      sourceImages: p.sourceImages,
      markdown: p.markdown,
    })),
    questions: debugQuestions.value.map((q) => ({
      groupId: q.group.groupId,
      displayNo: q.group.displayNo,
      sourceMarkdown: q.group.sourceMarkdown,
      sourceAssetIds: q.group.sourceAssetIds,
      blocks: q.blocks,
      issues: q.issues,
    })),
    validation: store.semanticData?.validation ?? null,
  }
  void copyText('all', JSON.stringify(payload, null, 2))
}

function handleLocate(blockId: string) {
  store.selectBlock(blockId)
  emit('locateBlock', blockId)
  open.value = false
}

async function ensurePdfDocument(file: File): Promise<PDFDocumentProxy> {
  if (loadedPdfFile === file && loadedPdfDoc) {
    return loadedPdfDoc
  }
  if (loadedPdfFile === file && loadingDocPromise) {
    return loadingDocPromise
  }
  if (loadedPdfTask && !loadedPdfTask.destroyed) {
    void loadedPdfTask.destroy().catch(() => undefined)
  }
  loadedPdfFile = file
  loadedPdfDoc = null
  loadedPdfTask = null

  const promise = (async () => {
    const { loadPdfPreview } = await import('@/lib/pdf/preview')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const task = loadPdfPreview(bytes)
    loadedPdfTask = task
    const doc = await task.promise
    if (loadedPdfFile !== file) {
      if (!task.destroyed) await task.destroy().catch(() => undefined)
      throw new Error('PDF 文件已切换')
    }
    loadedPdfDoc = doc
    return doc
  })()

  loadingDocPromise = promise
  try {
    return await promise
  } finally {
    if (loadingDocPromise === promise) {
      loadingDocPromise = null
    }
  }
}

async function renderSelectedPdfPage() {
  const seq = ++renderSeq
  activeRenderTask?.cancel()
  activeRenderTask = null
  pdfPreviewError.value = ''

  const canvas = pageCanvasRef.value
  const pageNo = selectedPage.value?.page
  if (
    !open.value ||
    activeTab.value !== 'pages' ||
    !isPdfSource.value ||
    !pageNo ||
    !canvas ||
    store.draftSource.type !== 'file'
  ) {
    pdfPreviewLoading.value = false
    return
  }

  const file = store.draftSource.file
  pdfPreviewLoading.value = true

  try {
    const doc = await ensurePdfDocument(file)
    if (seq !== renderSeq) return

    if (pageNo > doc.numPages) {
      pdfPreviewError.value = `原 PDF 共 ${doc.numPages} 页，无法渲染第 ${pageNo} 页。`
      return
    }

    const pdfPage = await doc.getPage(pageNo)
    if (seq !== renderSeq) {
      pdfPage.cleanup()
      return
    }

    try {
      const baseViewport = pdfPage.getViewport({ scale: 1 })
      const targetWidth = 760
      const viewport = pdfPage.getViewport({ scale: targetWidth / Math.max(1, baseViewport.width) })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const renderTask = pdfPage.render({ canvas, viewport })
      activeRenderTask = renderTask
      await renderTask.promise
    } finally {
      activeRenderTask = null
      pdfPage.cleanup()
    }
  } catch (err) {
    if (seq !== renderSeq) return
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
    if (name === 'RenderingCancelledException') return
    pdfPreviewError.value = err instanceof Error ? err.message : 'PDF 页面渲染失败'
  } finally {
    if (seq === renderSeq) {
      pdfPreviewLoading.value = false
    }
  }
}

watch(
  open,
  async (isOpen) => {
    if (!isOpen) {
      renderSeq += 1
      activeRenderTask?.cancel()
      activeRenderTask = null
      pdfPreviewLoading.value = false
      return
    }
    await store.loadDebugCheckpoints(store.sheetId)
    if (props.initialGroupId) {
      activeTab.value = 'questions'
      selectedGroupId.value = props.initialGroupId
    } else if (props.initialTab === 'pages' && debugPages.value.length > 0) {
      activeTab.value = 'pages'
    } else if (props.initialTab === 'questions' || debugPages.value.length === 0) {
      activeTab.value = 'questions'
    } else {
      activeTab.value = props.initialTab
    }
    if (debugPages.value.length > 0 && selectedPageNo.value === null) {
      selectedPageNo.value = debugPages.value[0]!.page
    }
    if (debugQuestions.value.length > 0 && !selectedGroupId.value) {
      selectedGroupId.value = debugQuestions.value[0]!.group.groupId
    }
  },
  { immediate: false },
)

watch(
  [open, activeTab, () => selectedPage.value?.page, pageCanvasRef],
  () => {
    void renderSelectedPdfPage()
  },
  { flush: 'post' },
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex h-[88dvh] w-[min(80rem,calc(100vw-2rem))] max-w-none flex-col overflow-hidden p-0"
    >
      <!-- Dialog Header -->
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3.5 pr-12"
      >
        <div class="min-w-0 space-y-0.5">
          <div class="flex items-center gap-2">
            <Bug class="size-4 shrink-0 text-accent" />
            <DialogTitle class="truncate text-sm font-semibold text-ink">
              解析与识别调试面板
            </DialogTitle>
            <Badge v-if="store.semanticData?.meta.subject" variant="outline" class="text-[11px]">
              {{ SUBJECT_LABELS[store.semanticData.meta.subject] }}
            </Badge>
            <Badge variant="neutral" class="font-mono text-[11px]">
              {{ debugPages.length }} 页 · {{ debugQuestions.length }} 题 ·
              {{ store.semanticData?.blocks.length ?? 0 }} 块
            </Badge>
          </div>
          <DialogDescription class="truncate text-xs text-ink-muted">
            {{ store.semanticData?.meta.title || '查看逐页 OCR 原文与逐题原题/识别结果对比' }}
          </DialogDescription>
        </div>

        <Button size="sm" variant="secondary" class="h-7 px-2.5 text-xs" @click="copyAllDebugJson">
          <template #leading>
            <Check v-if="copiedKey === 'all'" class="size-3.5 text-accent" />
            <Copy v-else class="size-3.5" />
          </template>
          {{ copiedKey === 'all' ? '已复制调试 JSON' : '复制完整调试 JSON' }}
        </Button>
      </div>

      <!-- Main Tabs -->
      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
        <div
          class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-5 py-2"
        >
          <TabsList class="h-8">
            <TabsTrigger value="pages" class="gap-1.5 text-xs">
              <FileText class="size-3.5" />
              逐页识别
              <Badge variant="neutral" class="px-1.5 py-0 font-mono text-[10px]">
                {{ debugPages.length }}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="questions" class="gap-1.5 text-xs">
              <Layers class="size-3.5" />
              逐题对比
              <Badge variant="neutral" class="px-1.5 py-0 font-mono text-[10px]">
                {{ debugQuestions.length }}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <p class="hidden text-[11px] text-ink-muted sm:block">
            支持对照原 PDF 页面、OCR 行号原文、拆题原题及生成的 JSON 题块结构
          </p>
        </div>

        <!-- ======================================================= -->
        <!-- Tab 1: Per-Page OCR Results & Original PDF Page Preview -->
        <!-- ======================================================= -->
        <TabsContent value="pages" class="mt-0 flex min-h-0 flex-1 overflow-hidden">
          <div
            v-if="debugPages.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted"
          >
            <FileText class="size-8 text-ink-faint" />
            <p class="font-medium text-ink">暂无分页 OCR 识别记录</p>
            <p class="max-w-md text-xs text-ink-muted">
              仅按页解析的 PDF 试卷会保存逐页 OCR 结果；DOCX / 图片 /
              纯文本试卷可直接切换到「逐题对比」查看原题与识别结果。
            </p>
            <Button
              size="sm"
              variant="secondary"
              class="mt-2 text-xs"
              @click="activeTab = 'questions'"
            >
              切换到逐题对比
            </Button>
          </div>

          <div v-else class="grid min-h-0 flex-1 grid-cols-[12.5rem_minmax(0,1fr)]">
            <!-- Left Page List -->
            <aside class="flex min-h-0 flex-col border-r border-line bg-surface">
              <div class="border-b border-line px-3 py-2 text-[11px] font-semibold text-ink-muted">
                共 {{ debugPages.length }} 页
              </div>
              <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="PDF 识别页列表">
                <li v-for="p in debugPages" :key="p.page">
                  <button
                    type="button"
                    class="flex w-full flex-col gap-1 rounded-control border px-2.5 py-2 text-left text-xs transition-colors"
                    :class="
                      selectedPage?.page === p.page
                        ? 'border-ink bg-control text-ink'
                        : 'border-line bg-raised text-ink-muted hover:border-ink-muted hover:text-ink'
                    "
                    @click="selectedPageNo = p.page"
                  >
                    <div class="flex items-center justify-between gap-1">
                      <span class="font-semibold text-ink">第 {{ p.page }} 页</span>
                      <Badge v-if="p.skipped" variant="accent-alt" class="px-1 py-0 text-[10px]">
                        已过滤
                      </Badge>
                      <Badge v-else variant="outline" class="px-1 py-0 font-mono text-[10px]">
                        L{{ p.startLine }}–{{ p.endLine }}
                      </Badge>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-ink-muted">
                      <span>{{ p.lines.length }} 行</span>
                      <span>·</span>
                      <span>{{ p.charCount }} 字</span>
                      <span v-if="p.sourceImages.length">· {{ p.sourceImages.length }} 图</span>
                    </div>
                  </button>
                </li>
              </ul>
            </aside>

            <!-- Right Split: Original Page Canvas + OCR Markdown -->
            <div
              v-if="selectedPage"
              class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-line overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-y-0"
            >
              <!-- Original PDF Page Preview + Cropped Images -->
              <section class="flex min-h-0 flex-col bg-surface/60">
                <div
                  class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-3.5 py-2 text-xs"
                >
                  <span class="font-semibold text-ink">第 {{ selectedPage.page }} 页原图</span>
                  <Badge v-if="selectedPage.skipped" variant="accent-alt" class="text-[10px]">
                    已按参考答案/推广页过滤（未参与拆题）
                  </Badge>
                </div>

                <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
                  <div
                    v-if="isPdfSource"
                    class="relative flex min-h-48 items-center justify-center rounded-control border border-line bg-raised p-2"
                  >
                    <div
                      v-if="pdfPreviewLoading"
                      class="absolute inset-0 flex items-center justify-center bg-surface/70 text-xs text-ink-muted"
                    >
                      <Loader2 class="mr-1.5 size-4 animate-spin" />
                      正在渲染原 PDF 页面...
                    </div>
                    <p v-if="pdfPreviewError" class="p-4 text-xs text-danger">
                      {{ pdfPreviewError }}
                    </p>
                    <canvas
                      ref="pageCanvasRef"
                      class="h-auto max-w-full rounded-[6px] border border-line"
                    />
                  </div>
                  <div
                    v-else-if="isImageSource && imageFilePreviewUrl"
                    class="rounded-control border border-line bg-raised p-2"
                  >
                    <img
                      :src="imageFilePreviewUrl"
                      alt="原始试卷图片"
                      class="h-auto max-w-full rounded-[6px]"
                    />
                  </div>
                  <div
                    v-else
                    class="rounded-control border border-dashed border-line bg-raised p-6 text-center text-xs text-ink-muted"
                  >
                    当前草稿未关联本地 PDF 原文件，无法渲染原始页图。
                  </div>

                  <!-- Cropped source images from this page -->
                  <div v-if="selectedPage.sourceImages.length" class="space-y-2">
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <ImageIcon class="size-3.5 text-ink-muted" />
                      <span>本页提取配图 ({{ selectedPage.sourceImages.length }})</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div
                        v-for="img in selectedPage.sourceImages"
                        :key="img.assetId"
                        class="space-y-1 rounded-control border border-line bg-raised p-2"
                      >
                        <div class="flex items-center justify-between text-[11px]">
                          <span class="font-mono font-semibold text-ink">{{ img.assetId }}</span>
                          <span class="font-mono text-[10px] text-ink-muted">
                            {{ img.widthPx }}×{{ img.heightPx }}
                          </span>
                        </div>
                        <img
                          v-if="store.assetUrls[img.assetId]"
                          :src="store.assetUrls[img.assetId]"
                          :alt="img.assetId"
                          class="max-h-36 w-full rounded-[4px] border border-line bg-surface object-contain"
                        />
                        <p v-else class="text-[11px] text-ink-muted">图片资源未加载</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- OCR Markdown with Line Numbers -->
              <section class="flex min-h-0 flex-col bg-surface">
                <div
                  class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-3.5 py-2 text-xs"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-ink">OCR 识别文本 (Markdown)</span>
                    <span v-if="!selectedPage.skipped" class="font-mono text-[11px] text-ink-muted">
                      拼接行号 L{{ selectedPage.startLine }}–{{ selectedPage.endLine }}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-6 px-2 text-[11px]"
                    @click="copyText(`page-${selectedPage.page}`, selectedPage.markdown)"
                  >
                    <template #leading>
                      <Check
                        v-if="copiedKey === `page-${selectedPage.page}`"
                        class="size-3 text-accent"
                      />
                      <Copy v-else class="size-3" />
                    </template>
                    {{ copiedKey === `page-${selectedPage.page}` ? '已复制' : '复制本页' }}
                  </Button>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
                  <div
                    v-for="(line, idx) in selectedPage.lines"
                    :key="idx"
                    class="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 rounded-[4px] px-1 hover:bg-control/50"
                  >
                    <span class="select-none text-right text-[11px] text-ink-faint tabular-nums">
                      {{ selectedPage.startLine !== null ? selectedPage.startLine + idx : idx + 1 }}
                    </span>
                    <span class="whitespace-pre-wrap break-words text-ink">{{ line || ' ' }}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </TabsContent>

        <!-- ======================================================= -->
        <!-- Tab 2: Per-Question Original Markdown vs Parsed Blocks  -->
        <!-- ======================================================= -->
        <TabsContent value="questions" class="mt-0 flex min-h-0 flex-1 overflow-hidden">
          <div
            v-if="debugQuestions.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted"
          >
            <Layers class="size-8 text-ink-faint" />
            <p class="font-medium text-ink">暂无题目识别记录</p>
            <p class="text-xs text-ink-muted">请先选择并解析一份试卷。</p>
          </div>

          <div v-else class="grid min-h-0 flex-1 grid-cols-[15.5rem_minmax(0,1fr)]">
            <!-- Left Question List -->
            <aside class="flex min-h-0 flex-col border-r border-line bg-surface">
              <div class="space-y-2 border-b border-line p-2.5">
                <div class="relative">
                  <Search
                    class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-muted"
                  />
                  <Input
                    v-model="questionQuery"
                    placeholder="搜题号 / 原文 / 题型..."
                    class="h-7 pl-8 text-xs"
                  />
                </div>
                <label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted">
                  <input
                    v-model="onlyIssueQuestions"
                    type="checkbox"
                    class="size-3.5 accent-[var(--p0seid0n-download)]"
                  />
                  <span>仅看异常 / 告警题目</span>
                </label>
              </div>

              <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="逐题识别列表">
                <li v-for="entry in filteredQuestions" :key="entry.group.groupId">
                  <button
                    type="button"
                    class="flex w-full flex-col gap-1 rounded-control border px-2.5 py-2 text-left text-xs transition-colors"
                    :class="
                      selectedQuestion?.group.groupId === entry.group.groupId
                        ? 'border-ink bg-control text-ink'
                        : 'border-line bg-raised text-ink-muted hover:border-ink-muted hover:text-ink'
                    "
                    @click="selectedGroupId = entry.group.groupId"
                  >
                    <div class="flex items-center justify-between gap-1">
                      <span class="truncate font-semibold text-ink">
                        第 {{ entry.group.displayNo || '?' }} 题
                      </span>
                      <Badge
                        v-if="entry.hasError"
                        variant="accent-alt"
                        class="px-1 py-0 text-[10px]"
                      >
                        异常
                      </Badge>
                      <Badge
                        v-else-if="entry.hasWarning"
                        variant="outline"
                        class="px-1 py-0 text-[10px]"
                      >
                        告警
                      </Badge>
                      <Badge v-else variant="neutral" class="px-1 py-0 font-mono text-[10px]">
                        {{ entry.blocks.length }} 块
                      </Badge>
                    </div>
                    <div class="flex flex-wrap items-center gap-1 text-[10px] text-ink-muted">
                      <span
                        v-for="b in entry.blocks.slice(0, 2)"
                        :key="b.id"
                        class="truncate rounded-[4px] bg-surface px-1 py-0.5"
                      >
                        {{ BLOCK_TYPE_LABELS[b.type] }}
                      </span>
                      <span v-if="entry.blocks.length === 0" class="text-danger">未生成答题块</span>
                      <span v-else-if="entry.blocks.length > 2"
                        >+{{ entry.blocks.length - 2 }}</span
                      >
                    </div>
                  </button>
                </li>
              </ul>
            </aside>

            <!-- Right Split: Original Question Markdown + Parsed Blocks & JSON -->
            <div
              v-if="selectedQuestion"
              class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-line overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-y-0"
            >
              <!-- Left: Original Question Source Markdown & Assets -->
              <section class="flex min-h-0 flex-col bg-surface/60">
                <div
                  class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-3.5 py-2 text-xs"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-ink">
                      原题内容 · 第 {{ selectedQuestion.group.displayNo || '?' }} 题
                    </span>
                    <span class="font-mono text-[10px] text-ink-muted">
                      {{ selectedQuestion.group.groupId }}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-6 px-2 text-[11px]"
                    @click="
                      copyText(
                        `src-${selectedQuestion.group.groupId}`,
                        selectedQuestion.group.sourceMarkdown,
                      )
                    "
                  >
                    <template #leading>
                      <Check
                        v-if="copiedKey === `src-${selectedQuestion.group.groupId}`"
                        class="size-3 text-accent"
                      />
                      <Copy v-else class="size-3" />
                    </template>
                    {{
                      copiedKey === `src-${selectedQuestion.group.groupId}` ? '已复制' : '复制原题'
                    }}
                  </Button>
                </div>

                <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
                  <pre
                    class="whitespace-pre-wrap break-words rounded-control border border-line bg-raised p-3 font-mono text-xs leading-relaxed text-ink"
                    >{{ selectedQuestion.group.sourceMarkdown || '（无原题文本）' }}</pre
                  >

                  <div v-if="selectedQuestion.group.sourceAssetIds.length" class="space-y-2">
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <ImageIcon class="size-3.5 text-ink-muted" />
                      <span>原题配图 ({{ selectedQuestion.group.sourceAssetIds.length }})</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div
                        v-for="assetId in selectedQuestion.group.sourceAssetIds"
                        :key="assetId"
                        class="space-y-1 rounded-control border border-line bg-raised p-2"
                      >
                        <p class="font-mono text-[11px] font-semibold text-ink">{{ assetId }}</p>
                        <img
                          v-if="store.assetUrls[assetId]"
                          :src="store.assetUrls[assetId]"
                          :alt="assetId"
                          class="max-h-40 w-full rounded-[4px] border border-line bg-surface object-contain"
                        />
                        <p v-else class="text-[11px] text-ink-muted">图片资源未加载</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Right: Recognition Result (Blocks Summary + Issues + Raw JSON) -->
              <section class="flex min-h-0 flex-col bg-surface">
                <div
                  class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-3.5 py-2 text-xs"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-ink">
                      识别结果 ({{ selectedQuestion.blocks.length }} 个答题块)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-6 px-2 text-[11px]"
                    @click="
                      copyText(`json-${selectedQuestion.group.groupId}`, selectedQuestionJson)
                    "
                  >
                    <template #leading>
                      <Check
                        v-if="copiedKey === `json-${selectedQuestion.group.groupId}`"
                        class="size-3 text-accent"
                      />
                      <Copy v-else class="size-3" />
                    </template>
                    {{
                      copiedKey === `json-${selectedQuestion.group.groupId}`
                        ? '已复制'
                        : '复制 JSON'
                    }}
                  </Button>
                </div>

                <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
                  <!-- Issues -->
                  <div v-if="selectedQuestion.issues.length" class="space-y-1.5">
                    <div
                      v-for="(issue, idx) in selectedQuestion.issues"
                      :key="idx"
                      class="flex items-start gap-2 rounded-control border px-2.5 py-2 text-xs"
                      :class="
                        issue.severity === 'error'
                          ? 'border-danger/50 bg-danger/10 text-danger'
                          : 'border-accent-alt/50 bg-accent-alt/10 text-ink'
                      "
                    >
                      <AlertCircle
                        v-if="issue.severity === 'error'"
                        class="mt-0.5 size-3.5 shrink-0 text-danger"
                      />
                      <AlertTriangle v-else class="mt-0.5 size-3.5 shrink-0 text-accent-alt" />
                      <div class="min-w-0 flex-1">
                        <span class="font-mono text-[10px] opacity-75">[{{ issue.code }}]</span>
                        <p class="leading-snug">{{ issue.message }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Structured Block Summary Cards -->
                  <div v-if="selectedQuestion.blocks.length" class="space-y-2">
                    <div
                      v-for="block in selectedQuestion.blocks"
                      :key="block.id"
                      class="flex items-center justify-between gap-2 rounded-control border border-line bg-raised px-3 py-2 text-xs"
                    >
                      <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <Badge variant="accent" class="px-1.5 py-0 text-[10px]">
                            第 {{ block.displayNo || '（无题号）' }} 题
                          </Badge>
                          <Badge variant="neutral" class="px-1.5 py-0 text-[10px]">
                            {{ BLOCK_TYPE_LABELS[block.type] }}
                          </Badge>
                          <span
                            v-if="block.score !== undefined"
                            class="font-mono text-[11px] text-ink-muted"
                          >
                            {{ block.score }} 分
                          </span>
                          <span class="font-mono text-[10px] text-ink-faint">
                            #{{ block.numericOrder }} · {{ block.id }}
                          </span>
                        </div>
                        <p class="text-[11px] text-ink-muted">{{ summarizeBlock(block) }}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        class="h-7 shrink-0 px-2 text-[11px]"
                        @click="handleLocate(block.id)"
                      >
                        <template #leading><Crosshair class="size-3" /></template>
                        定位
                      </Button>
                    </div>
                  </div>

                  <div
                    v-else
                    class="rounded-control border border-dashed border-danger/40 bg-danger/5 p-4 text-center text-xs text-danger"
                  >
                    该题暂未生成任何答题块，请检查左侧原题文本或上方错误信息。
                  </div>

                  <!-- Raw JSON Inspector -->
                  <div class="space-y-1.5">
                    <p class="text-[11px] font-semibold text-ink-muted">结构化 JSON 输出</p>
                    <pre
                      class="overflow-x-auto whitespace-pre-wrap break-words rounded-control border border-line bg-raised p-3 font-mono text-[11px] leading-relaxed text-ink"
                      >{{ selectedQuestionJson }}</pre
                    >
                  </div>
                </div>
              </section>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
