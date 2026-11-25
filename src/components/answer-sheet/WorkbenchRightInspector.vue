<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bug,
  CheckCircle2,
  FileUp,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  X,
} from 'lucide-vue-next'
import LatexText from '@/components/answer-sheet/blocks/LatexText.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SHEET_FONTS, type SheetFont } from '@/lib/answer-sheet/fonts'
import { MAX_CHOICES_PER_COLUMN } from '@/lib/answer-sheet/layout/flow'
import { getColumnSizeMm } from '@/lib/answer-sheet/paper'
import { BLOCK_TYPE_LABELS, SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type {
  AnswerSheetBlock,
  AssetPosition,
  BlockType,
  GridType,
  HeaderMode,
  SubjectType,
} from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

defineProps<{
  font: SheetFont
}>()

const emit = defineEmits<{
  'update:font': [val: SheetFont]
  openDebug: [groupId?: string]
}>()

const store = useAnswerSheetStore()
const newFieldInput = ref('')
const imageInputRef = ref<HTMLInputElement>()
const examFileInputRef = ref<HTMLInputElement>()
const hintSubject = ref<SubjectType | 'auto'>('auto')

const currentSourceFileName = computed(() => {
  if (store.draftSource.type === 'file') {
    return store.draftSource.file.name
  }
  return ''
})

const hasDraftToRetry = computed(() => {
  if (store.draftSource.type === 'file') return true
  if (store.draftSource.type === 'text' && store.draftSource.text.trim().length > 0) return true
  return false
})

async function handleExamFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (store.sheetList.some((item) => item.sheetId === store.sheetId)) {
    await store.submitOnboardingParse({ type: 'file', file }, hintSubject.value, store.sheetId)
  } else {
    await store.createNewAnswerSheet(file, hintSubject.value)
  }
  input.value = ''
}

async function handleRetryParse() {
  await store.retryDraftParse(hintSubject.value)
}

const columnWidthMm = computed(() => Math.round(getColumnSizeMm(store.activePaperProfile).widthMm))

const selectedBlockGroup = computed(() => {
  const block = store.selectedBlock
  if (!block) return null
  return store.questionGroups.find((g) => g.blockIds.includes(block.id)) ?? null
})

const optionPresets: Array<{ label: string; options: string[] }> = [
  { label: 'A-C (3选)', options: ['A', 'B', 'C'] },
  { label: 'A-D (4选)', options: ['A', 'B', 'C', 'D'] },
  { label: 'A-G (7选)', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
  { label: 'A-H (8选)', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
]

function addStudentField() {
  const val = newFieldInput.value.trim()
  if (!val || !store.semanticData) return
  store.setStudentFields([...store.semanticData.meta.studentFields, val])
  newFieldInput.value = ''
}

function removeStudentField(idx: number) {
  if (!store.semanticData || store.semanticData.meta.studentFields.length <= 1) return
  const next = store.semanticData.meta.studentFields.filter((_, i) => i !== idx)
  store.setStudentFields(next)
}

function updateDisplayNo(val: string) {
  const block = store.selectedBlock
  if (!block || !val.trim()) return
  store.updateBlock(block.id, (b) => ({ ...b, displayNo: val.trim() }))
}

function updateScore(val: number) {
  const block = store.selectedBlock
  if (!block || !Number.isFinite(val) || val < 0) return
  store.updateBlock(block.id, (b) => ({ ...b, score: val }))
}

function applyChoicePreset(options: string[]) {
  const block = store.selectedBlock
  if (!block || block.type !== 'omr_choice') return
  store.updateBlock(block.id, (b) =>
    b.type === 'omr_choice' ? { ...b, options: [...options] } : b,
  )
}

function addChoiceOption() {
  const block = store.selectedBlock
  if (!block || block.type !== 'omr_choice') return
  const last = block.options[block.options.length - 1] ?? 'D'
  const nextCode = Math.min(90, last.charCodeAt(0) + 1)
  const nextChar = String.fromCharCode(nextCode)
  if (block.options.includes(nextChar)) return
  store.updateBlock(block.id, (b) =>
    b.type === 'omr_choice' ? { ...b, options: [...b.options, nextChar] } : b,
  )
}

function removeChoiceOption() {
  const block = store.selectedBlock
  if (!block || block.type !== 'omr_choice' || block.options.length <= 2) return
  store.updateBlock(block.id, (b) =>
    b.type === 'omr_choice' ? { ...b, options: b.options.slice(0, -1) } : b,
  )
}

function toggleChoiceMultiple(val: boolean) {
  const block = store.selectedBlock
  if (!block || block.type !== 'omr_choice') return
  store.updateBlock(block.id, (b) => (b.type === 'omr_choice' ? { ...b, isMultiple: val } : b))
}

function updateCompactBlankItem(
  idx: number,
  field: 'subNo' | 'prefixLatex' | 'suffixUnit' | 'score',
  value: string | number,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'compact_blank') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'compact_blank') return b
    const item = b.items[idx]
    if (!item) return b
    if (field === 'score') {
      item.score = Number(value) || undefined
    } else if (field === 'subNo') {
      item.subNo = String(value)
    } else {
      item[field] = String(value) || undefined
    }
    return b
  })
}

function addCompactBlankItem() {
  const block = store.selectedBlock
  if (!block || block.type !== 'compact_blank') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'compact_blank') return b
    b.items.push({ subNo: `(${b.items.length + 1})` })
    return b
  })
}

function removeCompactBlankItem(idx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'compact_blank' || block.items.length <= 1) return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'compact_blank') return b
    b.items.splice(idx, 1)
    return b
  })
}

function updateCompactBlankColumns(cols: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'compact_blank') return
  const clamped = Math.max(1, Math.min(4, Math.round(cols) || 2))
  store.updateBlock(block.id, (b) =>
    b.type === 'compact_blank' ? { ...b, preferredColumns: clamped } : b,
  )
}

function addMixedRow(rowType: 'inline_blank' | 'full_line') {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const nextIdx = b.rows.length + 1
    if (rowType === 'inline_blank') {
      b.rows.push({
        type: 'inline_blank',
        segments: [{ label: `(${nextIdx})`, blanksCount: 1 }],
      })
    } else {
      b.rows.push({
        type: 'full_line',
        label: `(${nextIdx})`,
        lines: 2,
      })
    }
    return b
  })
}

function removeMixedRow(rowIdx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline' || block.rows.length <= 1) return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    b.rows.splice(rowIdx, 1)
    return b
  })
}

function moveMixedRow(rowIdx: number, delta: -1 | 1) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  const targetIdx = rowIdx + delta
  if (targetIdx < 0 || targetIdx >= block.rows.length) return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const [moved] = b.rows.splice(rowIdx, 1)
    if (moved) b.rows.splice(targetIdx, 0, moved)
    return b
  })
}

function addMixedSegment(rowIdx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const row = b.rows[rowIdx]
    if (!row || row.type !== 'inline_blank') return b
    row.segments.push({ label: `(${row.segments.length + 1})`, blanksCount: 1 })
    return b
  })
}

function removeMixedSegment(rowIdx: number, segIdx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const row = b.rows[rowIdx]
    if (!row || row.type !== 'inline_blank' || row.segments.length <= 1) return b
    row.segments.splice(segIdx, 1)
    return b
  })
}

function updateMixedFullLine(rowIdx: number, field: 'label' | 'lines', value: string | number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const row = b.rows[rowIdx]
    if (!row || row.type !== 'full_line') return b
    if (field === 'lines') {
      row.lines = Math.max(1, Math.min(20, Math.round(Number(value)) || 1))
    } else {
      row.label = String(value) || undefined
    }
    return b
  })
}

function updateLinedBaseLines(lines: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  const clamped = Math.max(1, Math.min(40, Math.round(lines) || 1))
  store.updateBlockOverride(block.id, { manualLines: clamped })
  store.updateBlock(block.id, (b) =>
    b.type === 'lined_writing' ? { ...b, baseLines: clamped } : b,
  )
}

function addLinedSubItem() {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlockOverride(block.id, { manualLines: undefined })
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing') return b
    const existing = b.subItems ?? []
    b.subItems = [...existing, { label: `(${existing.length + 1})`, baseLines: 2 }]
    return b
  })
}

function removeLinedSubItem(idx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlockOverride(block.id, { manualLines: undefined })
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing' || !b.subItems) return b
    b.subItems.splice(idx, 1)
    if (b.subItems.length === 0) delete b.subItems
    return b
  })
}

function updateLinedSubItem(
  idx: number,
  field: 'label' | 'baseLines' | 'score',
  value: string | number,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlockOverride(block.id, { manualLines: undefined })
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing' || !b.subItems?.[idx]) return b
    const item = b.subItems[idx]!
    if (field === 'baseLines') {
      item.baseLines = Math.max(1, Math.min(20, Math.round(Number(value)) || 1))
    } else if (field === 'score') {
      const n = Number(value)
      item.score = Number.isFinite(n) && n > 0 ? n : undefined
    } else {
      item.label = String(value)
    }
    return b
  })
}

function addOpenSubQuestion() {
  const block = store.selectedBlock
  if (!block || block.type !== 'open_blank_box') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'open_blank_box') return b
    const existing = b.subQuestions ?? []
    b.subQuestions = [...existing, { subNo: `(${existing.length + 1})` }]
    return b
  })
}

function removeOpenSubQuestion(idx: number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'open_blank_box') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'open_blank_box' || !b.subQuestions) return b
    b.subQuestions.splice(idx, 1)
    if (b.subQuestions.length === 0) delete b.subQuestions
    return b
  })
}

function updateOpenSubQuestion(
  idx: number,
  field: 'subNo' | 'score' | 'heightRatio',
  value: string | number,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'open_blank_box') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'open_blank_box' || !b.subQuestions?.[idx]) return b
    const item = b.subQuestions[idx]!
    if (field === 'subNo') {
      item.subNo = String(value)
    } else if (field === 'score') {
      const n = Number(value)
      item.score = Number.isFinite(n) && n > 0 ? n : undefined
    } else {
      const n = Number(value)
      item.heightRatio = Number.isFinite(n) && n > 0 ? Math.min(1, Math.max(0.1, n)) : undefined
    }
    return b
  })
}

function updateCompositionField(
  field: 'totalGrids' | 'minWords' | 'hasTitleRow' | 'milestones',
  value: string | number | boolean,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'composition_grid') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'composition_grid') return b
    if (field === 'hasTitleRow') {
      b.hasTitleRow = Boolean(value)
    } else if (field === 'totalGrids') {
      b.totalGrids = Math.max(100, Math.min(2000, Math.round(Number(value)) || 800))
    } else if (field === 'minWords') {
      b.minWords = Math.max(50, Math.min(2000, Math.round(Number(value)) || 800))
    } else {
      b.milestones = String(value)
        .split(/[,，\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    }
    return b
  })
}

function updateDrawingGridField(field: 'gridType' | 'rows' | 'cols', value: string | number) {
  const block = store.selectedBlock
  if (!block || block.type !== 'drawing_grid') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'drawing_grid') return b
    if (field === 'gridType') {
      b.gridType = value as GridType
    } else if (field === 'rows') {
      b.rows = Math.max(2, Math.min(40, Math.round(Number(value)) || 10))
    } else {
      b.cols = Math.max(2, Math.min(40, Math.round(Number(value)) || 15))
    }
    return b
  })
}

function updateMixedSegment(
  rowIdx: number,
  segIdx: number,
  field: 'label' | 'prefix' | 'suffixUnit' | 'separator' | 'blanksCount',
  value: string | number,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'mixed_inline') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'mixed_inline') return b
    const row = b.rows[rowIdx]
    if (!row || row.type !== 'inline_blank') return b
    const seg = row.segments[segIdx]
    if (!seg) return b
    if (field === 'blanksCount') {
      seg.blanksCount = Math.max(1, Math.min(6, Number(value) || 1))
    } else if (field === 'label') {
      seg.label = String(value)
    } else {
      seg[field] = String(value) || undefined
    }
    return b
  })
}

function updateEnglishSalutation(val: string) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing') return b
    b.englishWritingMeta = {
      ...b.englishWritingMeta,
      salutation: val || undefined,
    }
    return b
  })
}

function updateEnglishSignOff(val: string) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing') return b
    b.englishWritingMeta = {
      ...b.englishWritingMeta,
      signOff: val || undefined,
    }
    return b
  })
}

function enableEnglishContinuation(enabled: boolean) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing') return b
    if (enabled) {
      b.englishWritingMeta = {
        ...b.englishWritingMeta,
        continuationParagraphs: b.englishWritingMeta?.continuationParagraphs?.length
          ? b.englishWritingMeta.continuationParagraphs
          : [
              {
                heading: 'Paragraph 1:',
                leadText: 'When I reached the station, I saw someone waving from the platform.',
                baseLines: 6,
              },
              {
                heading: 'Paragraph 2:',
                leadText: 'The next morning, a small parcel arrived at our door.',
                baseLines: 6,
              },
            ],
      }
    } else if (b.englishWritingMeta) {
      delete b.englishWritingMeta.continuationParagraphs
    }
    return b
  })
}

function updateContinuationParagraph(
  idx: number,
  field: 'heading' | 'leadText' | 'baseLines',
  val: string | number,
) {
  const block = store.selectedBlock
  if (!block || block.type !== 'lined_writing') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'lined_writing') return b
    const paras = b.englishWritingMeta?.continuationParagraphs
    const p = paras?.[idx]
    if (!p) return b
    if (field === 'baseLines') {
      p.baseLines = Math.max(1, Math.min(20, Number(val) || 5))
    } else {
      p[field] = String(val)
    }
    return b
  })
}

async function handleImageFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const block = store.selectedBlock
  if (!file || !block) return
  await store.uploadBlockImage(block.id, file)
  input.value = ''
}

function getBlockAssetPosition(block: AnswerSheetBlock): AssetPosition {
  if (block.type === 'open_blank_box' && block.attachedAssetIds?.[0]) {
    return block.attachedAssetIds[0].position
  }
  return 'top-right'
}

function setBlockAssetPosition(pos: AssetPosition) {
  const block = store.selectedBlock
  if (!block || block.type !== 'open_blank_box') return
  store.updateBlock(block.id, (b) => {
    if (b.type !== 'open_blank_box') return b
    const first = b.attachedAssetIds?.[0]
    if (first) {
      first.position = pos
    } else {
      const fallbackAssetId = store.semanticData?.assets[0]?.assetId ?? 'IMG_01'
      b.attachedAssetIds = [{ assetId: fallbackAssetId, position: pos }]
    }
    return b
  })
}

function getBlockMonochrome(): boolean {
  const ov = store.selectedBlockOverride
  if (ov.monochrome !== undefined) return ov.monochrome
  return true
}

function toggleBlockMonochrome(val: boolean) {
  const block = store.selectedBlock
  if (!block) return
  store.updateBlockOverride(block.id, { monochrome: val })
}

function getBlockImageWidthRatio(block: AnswerSheetBlock): number {
  const ov = store.selectedBlockOverride
  if (ov.imageWidthMm !== undefined && columnWidthMm.value > 0) {
    return Math.min(85, Math.max(15, Math.round((ov.imageWidthMm / columnWidthMm.value) * 100)))
  }
  if (block.type === 'mixed_inline') {
    const imgRow = block.rows.find((r) => r.type === 'embedded_image')
    if (imgRow && imgRow.type === 'embedded_image' && imgRow.widthRatio) {
      return Math.round(imgRow.widthRatio * 100)
    }
  }
  return 45
}

function setBlockImageWidthRatio(percent: number) {
  const block = store.selectedBlock
  if (!block) return
  const clamped = Math.max(15, Math.min(85, Number(percent) || 45))
  const widthMm = Math.round((columnWidthMm.value * clamped) / 100)
  store.updateBlockOverride(block.id, { imageWidthMm: widthMm })
  if (block.type === 'mixed_inline') {
    store.updateBlock(block.id, (b) => {
      if (b.type !== 'mixed_inline') return b
      for (const r of b.rows) {
        if (r.type === 'embedded_image') r.widthRatio = clamped / 100
      }
      return b
    })
  }
}
</script>

<template>
  <aside
    class="flex h-full min-h-0 flex-col overflow-y-auto border-l border-line bg-raised p-3.5"
    aria-label="属性检查器"
    data-sheet-screen-only
  >
    <!-- ====================================================== -->
    <!-- Case 1: No Block Selected -> Global Sheet Inspector    -->
    <!-- ====================================================== -->
    <div v-if="!store.selectedBlock" class="space-y-4">
      <div class="flex items-center gap-2">
        <Sliders class="size-4 text-ink-muted" />
        <h2 class="text-xs font-semibold text-ink">全局答题卡设置</h2>
      </div>

      <!-- Exam Paper File Selection & Inline Parse Progress in Right Global Sidebar -->
      <div class="space-y-3 rounded-control border border-line bg-surface p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-ink">试卷文件与智能解析</p>
          <div class="flex items-center gap-1.5">
            <Button
              v-if="
                store.ocrPages.length || store.questionGroups.length || store.parsedQuestions.length
              "
              variant="ghost"
              size="sm"
              class="h-6 px-1.5 text-[11px]"
              @click="emit('openDebug')"
            >
              <template #leading><Bug class="size-3" /></template>
              识别详情
            </Button>
            <Badge v-if="store.isParsing" variant="accent" class="text-[10px]"> 解析中 </Badge>
            <Badge v-else-if="store.semanticData" variant="neutral" class="text-[10px]">
              已解析
            </Badge>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <Label for="inspector-hint-subject" class="text-xs text-ink-muted">学科预选</Label>
          <Select v-model="hintSubject" :disabled="store.isParsing">
            <SelectTrigger id="inspector-hint-subject" class="h-7 w-32 text-xs">
              <SelectValue placeholder="自动识别学科" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动识别学科</SelectItem>
              <SelectItem v-for="(label, key) in SUBJECT_LABELS" :key="key" :value="key">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <input
          ref="examFileInputRef"
          type="file"
          accept=".docx,.pdf,image/png,image/jpeg,image/webp"
          class="hidden"
          @change="handleExamFileSelected"
        />

        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            class="h-8 flex-1 text-xs"
            :disabled="store.isParsing"
            @click="examFileInputRef?.click()"
          >
            <template #leading><FileUp class="size-3.5" /></template>
            {{ currentSourceFileName ? '重新选择试卷文件' : '选择试卷文件 (.docx / .pdf / 图片)' }}
          </Button>
          <Button
            v-if="store.isParsing"
            variant="ghost"
            size="sm"
            class="h-8 px-2.5 text-xs"
            @click="store.cancelOnboardingParse()"
          >
            取消
          </Button>
        </div>

        <p v-if="currentSourceFileName" class="truncate text-[11px] text-ink-muted">
          当前试卷：<span class="font-medium text-ink">{{ currentSourceFileName }}</span>
        </p>

        <!-- Live SSE Parse Progress Bar & Details inside Right Global Sidebar -->
        <div
          v-if="store.isParsing || store.parseStage"
          class="space-y-2 rounded-[8px] border border-line bg-raised p-2.5"
          aria-label="试卷解析进度"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 font-medium text-ink">
              <Loader2 v-if="store.isParsing" class="size-3.5 animate-spin text-accent" />
              <CheckCircle2 v-else class="size-3.5 text-accent" />
              {{ store.parseStage?.message ?? '正在准备解析...' }}
            </span>
            <Badge variant="outline" class="font-mono text-[11px]">
              {{ Math.round(store.parseStage?.progress ?? 0) }}%
            </Badge>
          </div>
          <Progress :model-value="store.parseStage?.progress ?? 10" />

          <details v-if="store.parseReasoning.length" class="mt-2 text-xs text-ink-muted">
            <summary class="cursor-pointer font-medium text-ink">模型思考过程</summary>
            <div class="mt-1.5 max-h-44 space-y-2 overflow-y-auto">
              <div v-for="entry in store.parseReasoning" :key="`${entry.stage}:${entry.callId}`">
                <p class="font-medium text-ink">
                  {{
                    {
                      ocr_page: '识别页面',
                      exam_metadata: '识别试卷信息',
                      question_blocks: '解析题目',
                    }[entry.stage] ?? entry.stage
                  }}
                  · {{ entry.callId }}
                </p>
                <p class="whitespace-pre-wrap break-words text-[11px]">{{ entry.text }}</p>
              </div>
            </div>
          </details>

          <ul
            v-if="store.parsedQuestions.length"
            aria-label="逐题解析结果"
            class="mt-2 max-h-36 space-y-1 overflow-y-auto text-[11px] text-ink-muted"
          >
            <li v-for="question in store.parsedQuestions" :key="question.group.groupId">
              第 {{ question.group.displayNo || question.questionIndex + 1 }} 题：{{
                question.blocks.length
                  ? `已生成 ${question.blocks.length} 个答题块`
                  : (question.issues.find((issue) => issue.severity === 'error')?.message ??
                    '未生成答题块')
              }}
            </li>
          </ul>
        </div>

        <!-- Parse Error & Local Retry -->
        <Alert
          v-if="store.parseError || (store.pdfParseIncomplete && !store.isParsing)"
          variant="danger"
        >
          <template #icon>
            <AlertCircle class="size-4" />
          </template>
          <AlertTitle class="text-xs">解析未完成（原始试卷已存本地）</AlertTitle>
          <AlertDescription class="space-y-2">
            <p class="text-[11px]">
              {{ store.parseError || '已保存本地进度，可继续未完成的页面或题目。' }}
            </p>
            <ul
              v-if="store.pdfParseFailures.length"
              class="max-h-32 space-y-1 overflow-y-auto text-[11px]"
            >
              <li v-for="failure in store.pdfParseFailures" :key="failure">{{ failure }}</li>
            </ul>
            <Button
              v-if="hasDraftToRetry"
              size="sm"
              variant="secondary"
              class="h-7 text-xs"
              :disabled="store.isParsing"
              @click="handleRetryParse"
            >
              <template #leading><RefreshCw class="size-3" /></template>
              {{ store.pdfParseIncomplete ? '继续解析未完成项' : '重新解析当前试卷' }}
            </Button>
          </AlertDescription>
        </Alert>
      </div>

      <template v-if="store.semanticData">
        <!-- Header Mode: Barcode vs ID Grid & ID Digits Count -->
        <div class="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <div class="space-y-1.5">
            <Label for="inspector-header-mode" class="text-xs">卷头考号模式</Label>
            <Select
              :model-value="store.semanticData.meta.headerMode"
              @update:model-value="(val) => store.setHeaderMode(val as HeaderMode)"
            >
              <SelectTrigger id="inspector-header-mode" class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barcode">条形码粘贴区</SelectItem>
                <SelectItem value="id_grid">准考证号填涂区</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label for="inspector-id-digits" class="text-xs">考号位数</Label>
            <Input
              id="inspector-id-digits"
              :model-value="store.semanticData.meta.idDigits ?? 10"
              type="number"
              min="4"
              max="12"
              class="h-8 text-xs"
              @update:model-value="(val) => store.setIdDigits(Number(val))"
            />
          </div>
        </div>
        <p class="text-[11px] text-ink-muted">
          考号填涂与手写格位数限制为 4 ~ 12 位（当前
          {{ store.semanticData.meta.idDigits ?? 10 }} 位）。
        </p>

        <!-- Subtitle -->
        <div class="space-y-1">
          <Label for="inspector-subtitle" class="text-xs">副标题 / 批次</Label>
          <Input
            id="inspector-subtitle"
            :model-value="store.semanticData.meta.subtitle ?? ''"
            placeholder="如：2026年11月联考"
            class="h-8 text-xs"
            @update:model-value="(val) => store.setSubtitle(String(val))"
          />
        </div>

        <!-- Font Selector -->
        <div class="space-y-1.5">
          <Label for="inspector-font" class="text-xs">印刷字体</Label>
          <Select
            :model-value="font"
            @update:model-value="(val) => emit('update:font', val as SheetFont)"
          >
            <SelectTrigger id="inspector-font" class="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(entry, key) in SHEET_FONTS" :key="key" :value="key">
                {{ entry.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1.5">
          <Label for="inspector-max-choices-per-column" class="text-xs">客观题每列最多题数</Label>
          <Select
            :model-value="String(store.layoutConfig.maxChoicesPerColumn ?? 'auto')"
            @update:model-value="
              (val) => store.setMaxChoicesPerColumn(val === 'auto' ? undefined : Number(val))
            "
          >
            <SelectTrigger id="inspector-max-choices-per-column" class="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem
                v-for="count in MAX_CHOICES_PER_COLUMN"
                :key="count"
                :value="String(count)"
              >
                {{ count }} 题
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <!-- Student Fields Management -->
        <div class="space-y-2">
          <Label class="text-xs">考生信息字段增删</Label>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="(field, idx) in store.semanticData.meta.studentFields"
              :key="`${field}-${idx}`"
              variant="neutral"
              class="flex items-center gap-1 py-0.5 text-xs"
            >
              <span>{{ field }}</span>
              <button
                v-if="store.semanticData.meta.studentFields.length > 1"
                type="button"
                :aria-label="`移除字段 ${field}`"
                class="text-ink-muted hover:text-danger"
                @click="removeStudentField(idx)"
              >
                <X class="size-3" />
              </button>
            </Badge>
          </div>
          <div class="flex gap-1.5">
            <Input
              v-model="newFieldInput"
              placeholder="新增字段（如：学校）"
              class="h-7 flex-1 text-xs"
              @keydown.enter.prevent="addStudentField"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-7 px-2.5 text-xs"
              @click="addStudentField"
            >
              <Plus class="size-3.5" />
            </Button>
          </div>
        </div>
      </template>
    </div>

    <!-- ====================================================== -->
    <!-- Case 2: Specific Block Selected -> Dynamic Block Form  -->
    <!-- ====================================================== -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <Badge variant="accent" class="text-[11px]">
            第 {{ store.selectedBlock.displayNo }} 题
          </Badge>
          <span class="text-xs font-semibold text-ink">
            {{ BLOCK_TYPE_LABELS[store.selectedBlock.type] }}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-1.5 text-[11px]"
          @click="store.selectBlock(null)"
        >
          返回全局
        </Button>
      </div>

      <!-- Original Question Source Preview (Debug) -->
      <div
        v-if="selectedBlockGroup"
        class="space-y-2 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-semibold text-ink">
            原题文本（第 {{ selectedBlockGroup.displayNo }} 题）
          </span>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-1.5 text-[11px]"
            @click="emit('openDebug', selectedBlockGroup.groupId)"
          >
            <template #leading><Bug class="size-3" /></template>
            对比详情
          </Button>
        </div>
        <pre
          class="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-[6px] border border-line bg-raised p-2 font-mono text-[11px] leading-relaxed text-ink-muted"
          >{{ selectedBlockGroup.sourceMarkdown || '（无原题文本）' }}</pre
        >
      </div>

      <!-- Common Block Fields: Question No, Score, Convert Component Type -->
      <div class="space-y-2.5 rounded-control border border-line bg-surface p-2.5">
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label for="block-display-no" class="text-[11px]">题号标号</Label>
            <Input
              id="block-display-no"
              :model-value="store.selectedBlock.displayNo"
              class="h-7 text-xs"
              @update:model-value="(val) => updateDisplayNo(String(val))"
            />
          </div>
          <div class="space-y-1">
            <Label for="block-score" class="text-[11px]">分值 (分)</Label>
            <Input
              id="block-score"
              :model-value="store.selectedBlock.score ?? 0"
              type="number"
              step="0.5"
              min="0"
              max="100"
              class="h-7 text-xs"
              @update:model-value="(val) => updateScore(Number(val))"
            />
          </div>
        </div>

        <div class="space-y-1">
          <Label for="block-convert-type" class="text-[11px]">
            转换组件类型（如横线题一键转纯空白框）
          </Label>
          <Select
            :model-value="store.selectedBlock.type"
            @update:model-value="
              (val) => store.changeBlockType(store.selectedBlock!.id, val as BlockType)
            "
          >
            <SelectTrigger id="block-convert-type" class="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="(label, typeKey) in BLOCK_TYPE_LABELS"
                :key="typeKey"
                :value="typeKey"
              >
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center justify-between pt-1">
          <Label for="block-force-break" class="text-[11px] text-ink">强制从此题换栏</Label>
          <Switch
            id="block-force-break"
            :model-value="store.selectedBlockOverride.forceBreakBefore ?? false"
            @update:model-value="() => store.toggleForceBreakBefore(store.selectedBlock!.id)"
          />
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.1 Objective Question (`omr_choice`)                  -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'omr_choice'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <p class="text-xs font-semibold text-ink">客观题选项与填涂设置</p>

        <div class="space-y-1.5">
          <Label class="text-[11px] text-ink-muted">选项字母快捷预设</Label>
          <div class="grid grid-cols-2 gap-1.5">
            <Button
              v-for="preset in optionPresets"
              :key="preset.label"
              size="sm"
              :variant="
                store.selectedBlock.options.join(',') === preset.options.join(',')
                  ? 'primary'
                  : 'secondary'
              "
              class="h-7 text-xs"
              @click="applyChoicePreset(preset.options)"
            >
              {{ preset.label }}
            </Button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-[11px] text-ink-muted">
              当前选项 ({{ store.selectedBlock.options.join(' / ') }})
            </Label>
            <div class="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                class="h-6 px-2 text-[11px]"
                @click="removeChoiceOption"
              >
                -1项
              </Button>
              <Button
                size="sm"
                variant="secondary"
                class="h-6 px-2 text-[11px]"
                @click="addChoiceOption"
              >
                +1项
              </Button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-line pt-2">
          <Label for="omr-is-multiple" class="text-xs">多选题模式</Label>
          <Switch
            id="omr-is-multiple"
            :model-value="store.selectedBlock.isMultiple"
            @update:model-value="(val) => toggleChoiceMultiple(Boolean(val))"
          />
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.2 Compact Blank (`compact_blank`) - KaTeX & Unit     -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'compact_blank'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-ink">填空项与 LaTeX 公式 / 单位</p>
          <Button
            size="sm"
            variant="secondary"
            class="h-6 px-2 text-[11px]"
            @click="addCompactBlankItem"
          >
            <Plus class="mr-1 size-3" />添加空位
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label class="text-[10px] text-ink-muted">每行列数 (1~4)</Label>
            <Input
              :model-value="store.selectedBlock.preferredColumns"
              type="number"
              min="1"
              max="4"
              class="h-7 text-xs"
              @update:model-value="(val) => updateCompactBlankColumns(Number(val))"
            />
          </div>
          <div class="space-y-1">
            <Label class="text-[10px] text-ink-muted">最小高度 (mm)</Label>
            <Input
              :model-value="store.selectedBlockOverride.manualHeightMm ?? ''"
              type="number"
              min="14"
              max="240"
              placeholder="自动"
              class="h-7 text-xs"
              @update:model-value="
                (val) =>
                  String(val).trim()
                    ? store.setBlockHeightMm(store.selectedBlock!.id, Number(val))
                    : store.updateBlockOverride(store.selectedBlock!.id, {
                        manualHeightMm: undefined,
                      })
              "
            />
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="(item, idx) in store.selectedBlock.items"
            :key="idx"
            class="space-y-1.5 rounded-[8px] border border-line bg-raised p-2"
          >
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5">
                <Input
                  :model-value="item.subNo"
                  placeholder="小题号"
                  class="h-6 w-20 text-xs"
                  @update:model-value="(val) => updateCompactBlankItem(idx, 'subNo', String(val))"
                />
                <Input
                  :model-value="item.score ?? ''"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="分值"
                  class="h-6 w-16 text-xs"
                  @update:model-value="(val) => updateCompactBlankItem(idx, 'score', Number(val))"
                />
              </div>
              <button
                v-if="store.selectedBlock.items.length > 1"
                type="button"
                class="text-ink-muted hover:text-danger"
                @click="removeCompactBlankItem(idx)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <div>
                <Label class="text-[10px] text-ink-muted">空前公式 (LaTeX)</Label>
                <Input
                  :model-value="item.prefixLatex ?? ''"
                  placeholder="如 \sqrt{x}="
                  class="h-7 font-mono text-xs"
                  @update:model-value="
                    (val) => updateCompactBlankItem(idx, 'prefixLatex', String(val))
                  "
                />
              </div>
              <div>
                <Label class="text-[10px] text-ink-muted">空后单位 / 公式</Label>
                <Input
                  :model-value="item.suffixUnit ?? ''"
                  placeholder="如 \mathrm{m/s^2}"
                  class="h-7 font-mono text-xs"
                  @update:model-value="
                    (val) => updateCompactBlankItem(idx, 'suffixUnit', String(val))
                  "
                />
              </div>
            </div>
            <!-- Live KaTeX Preview -->
            <div
              v-if="item.prefixLatex || item.suffixUnit"
              class="flex items-center gap-1.5 rounded-[6px] bg-surface px-2 py-1 text-xs text-ink"
            >
              <span class="text-[10px] text-ink-muted">KaTeX 预览：</span>
              <LatexText v-if="item.prefixLatex" :text="item.prefixLatex" />
              <span class="inline-block w-8 border-b border-ink" />
              <LatexText v-if="item.suffixUnit" :text="item.suffixUnit" />
            </div>
          </div>
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.3 Mixed Inline (`mixed_inline`) - Full Row Editor    -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'mixed_inline'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <p class="text-xs font-semibold text-ink">混合填空与横线行编辑</p>
          <div class="flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-1.5 text-[10px]"
              @click="addMixedRow('inline_blank')"
            >
              <Plus class="mr-0.5 size-2.5" />行内填空
            </Button>
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-1.5 text-[10px]"
              @click="addMixedRow('full_line')"
            >
              <Plus class="mr-0.5 size-2.5" />整行横线
            </Button>
          </div>
        </div>

        <div class="space-y-1">
          <Label class="text-[10px] text-ink-muted">最小高度 (mm，留空自动)</Label>
          <Input
            :model-value="store.selectedBlockOverride.manualHeightMm ?? ''"
            type="number"
            min="14"
            max="240"
            placeholder="自动"
            class="h-7 text-xs"
            @update:model-value="
              (val) =>
                String(val).trim()
                  ? store.setBlockHeightMm(store.selectedBlock!.id, Number(val))
                  : store.updateBlockOverride(store.selectedBlock!.id, {
                      manualHeightMm: undefined,
                    })
            "
          />
        </div>

        <div class="space-y-2">
          <div
            v-for="(row, rIdx) in store.selectedBlock.rows"
            :key="rIdx"
            class="space-y-2 rounded-[8px] border border-line bg-raised p-2"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] font-medium text-ink-muted">
                第 {{ rIdx + 1 }} 行（{{
                  row.type === 'inline_blank'
                    ? '行内填空'
                    : row.type === 'full_line'
                      ? '整行横线'
                      : '内嵌配图'
                }}）
              </span>
              <div class="flex items-center gap-1">
                <button
                  v-if="row.type === 'inline_blank'"
                  type="button"
                  title="本行新增填空段"
                  class="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink hover:bg-control"
                  @click="addMixedSegment(rIdx)"
                >
                  +空
                </button>
                <button
                  type="button"
                  title="上移"
                  :disabled="rIdx === 0"
                  class="text-ink-muted hover:text-ink disabled:opacity-30"
                  @click="moveMixedRow(rIdx, -1)"
                >
                  <ArrowUp class="size-3" />
                </button>
                <button
                  type="button"
                  title="下移"
                  :disabled="rIdx === store.selectedBlock.rows.length - 1"
                  class="text-ink-muted hover:text-ink disabled:opacity-30"
                  @click="moveMixedRow(rIdx, 1)"
                >
                  <ArrowDown class="size-3" />
                </button>
                <button
                  v-if="store.selectedBlock.rows.length > 1"
                  type="button"
                  title="删除该行"
                  class="text-ink-muted hover:text-danger"
                  @click="removeMixedRow(rIdx)"
                >
                  <Trash2 class="size-3" />
                </button>
              </div>
            </div>

            <!-- Inline blank segments -->
            <template v-if="row.type === 'inline_blank'">
              <div
                v-for="(seg, sIdx) in row.segments"
                :key="sIdx"
                class="space-y-1.5 border-t border-line pt-1.5 first:border-0 first:pt-0"
              >
                <div class="grid grid-cols-[minmax(0,1fr)_3.5rem_auto] items-end gap-1.5">
                  <div>
                    <Label class="text-[10px] text-ink-muted">标号</Label>
                    <Input
                      :model-value="seg.label"
                      class="h-6 text-xs"
                      @update:model-value="
                        (v) => updateMixedSegment(rIdx, sIdx, 'label', String(v))
                      "
                    />
                  </div>
                  <div>
                    <Label class="text-[10px] text-ink-muted">空数</Label>
                    <Input
                      :model-value="seg.blanksCount"
                      type="number"
                      min="1"
                      max="6"
                      class="h-6 text-xs"
                      @update:model-value="
                        (v) => updateMixedSegment(rIdx, sIdx, 'blanksCount', Number(v))
                      "
                    />
                  </div>
                  <button
                    v-if="row.segments.length > 1"
                    type="button"
                    title="移除该空"
                    class="mb-1 text-ink-muted hover:text-danger"
                    @click="removeMixedSegment(rIdx, sIdx)"
                  >
                    <X class="size-3.5" />
                  </button>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
                  <div>
                    <Label class="text-[10px] text-ink-muted">空前文本/LaTeX</Label>
                    <Input
                      :model-value="seg.prefix ?? ''"
                      placeholder="如 F="
                      class="h-6 font-mono text-xs"
                      @update:model-value="
                        (v) => updateMixedSegment(rIdx, sIdx, 'prefix', String(v))
                      "
                    />
                  </div>
                  <div>
                    <Label class="text-[10px] text-ink-muted">空后单位/LaTeX</Label>
                    <Input
                      :model-value="seg.suffixUnit ?? ''"
                      placeholder="\Omega"
                      class="h-6 font-mono text-xs"
                      @update:model-value="
                        (v) => updateMixedSegment(rIdx, sIdx, 'suffixUnit', String(v))
                      "
                    />
                  </div>
                  <div>
                    <Label class="text-[10px] text-ink-muted">分隔符</Label>
                    <Input
                      :model-value="seg.separator ?? ''"
                      placeholder="，"
                      class="h-6 text-xs"
                      @update:model-value="
                        (v) => updateMixedSegment(rIdx, sIdx, 'separator', String(v))
                      "
                    />
                  </div>
                </div>
                <div
                  v-if="seg.prefix || seg.suffixUnit"
                  class="flex items-center gap-1 rounded-[5px] bg-surface px-2 py-1 text-xs"
                >
                  <span class="text-[10px] text-ink-muted">KaTeX 预览：</span>
                  <LatexText v-if="seg.prefix" :text="seg.prefix" />
                  <span class="inline-block w-6 border-b border-ink" />
                  <LatexText v-if="seg.suffixUnit" :text="seg.suffixUnit" />
                </div>
              </div>
            </template>

            <!-- Full line row editor -->
            <div v-else-if="row.type === 'full_line'" class="grid grid-cols-2 gap-1.5">
              <div>
                <Label class="text-[10px] text-ink-muted">小问标号</Label>
                <Input
                  :model-value="row.label ?? ''"
                  placeholder="如 (2)"
                  class="h-6 text-xs"
                  @update:model-value="(v) => updateMixedFullLine(rIdx, 'label', String(v))"
                />
              </div>
              <div>
                <Label class="text-[10px] text-ink-muted">横线行数</Label>
                <Input
                  :model-value="row.lines"
                  type="number"
                  min="1"
                  max="20"
                  class="h-6 text-xs"
                  @update:model-value="(v) => updateMixedFullLine(rIdx, 'lines', Number(v))"
                />
              </div>
            </div>

            <!-- Embedded image row info -->
            <div v-else class="flex items-center justify-between text-[11px] text-ink-muted">
              <span class="font-mono">图片 ID：{{ row.assetId }}</span>
              <span>宽度 {{ Math.round((row.widthRatio ?? 0.45) * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.4 Lined Writing (`lined_writing`) - Lines & SubItems -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'lined_writing'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-ink">横线作答与小问编辑</p>
          <div class="flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-2 text-xs"
              @click="store.adjustBlockLines(store.selectedBlock.id, -1)"
            >
              -1行
            </Button>
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-2 text-xs"
              @click="store.adjustBlockLines(store.selectedBlock.id, 1)"
            >
              +1行
            </Button>
          </div>
        </div>

        <div
          v-if="
            !store.selectedBlock.subItems?.length &&
            !store.selectedBlock.englishWritingMeta?.continuationParagraphs?.length
          "
          class="space-y-1"
        >
          <Label for="lined-base-lines" class="text-[11px] text-ink-muted">作答总行数</Label>
          <Input
            id="lined-base-lines"
            :model-value="store.selectedBlockOverride.manualLines ?? store.selectedBlock.baseLines"
            type="number"
            min="1"
            max="40"
            class="h-7 text-xs"
            @update:model-value="(val) => updateLinedBaseLines(Number(val))"
          />
        </div>

        <!-- Sub-items editor -->
        <div class="space-y-2 border-t border-line pt-2">
          <div class="flex items-center justify-between">
            <Label class="text-[11px] font-medium text-ink">小问列表</Label>
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-2 text-[10px]"
              @click="addLinedSubItem"
            >
              <Plus class="mr-0.5 size-2.5" />添加小问
            </Button>
          </div>
          <div v-if="store.selectedBlock.subItems?.length" class="space-y-1.5">
            <div
              v-for="(sub, sIdx) in store.selectedBlock.subItems"
              :key="sIdx"
              class="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_auto] items-center gap-1.5 rounded-[6px] border border-line bg-raised p-1.5"
            >
              <Input
                :model-value="sub.label"
                placeholder="标号"
                class="h-6 text-xs"
                @update:model-value="(v) => updateLinedSubItem(sIdx, 'label', String(v))"
              />
              <Input
                :model-value="sub.baseLines"
                type="number"
                min="1"
                max="20"
                title="行数"
                placeholder="行"
                class="h-6 text-xs"
                @update:model-value="(v) => updateLinedSubItem(sIdx, 'baseLines', Number(v))"
              />
              <Input
                :model-value="sub.score ?? ''"
                type="number"
                step="0.5"
                min="0"
                title="分值"
                placeholder="分"
                class="h-6 text-xs"
                @update:model-value="(v) => updateLinedSubItem(sIdx, 'score', Number(v))"
              />
              <button
                type="button"
                class="text-ink-muted hover:text-danger"
                @click="removeLinedSubItem(sIdx)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <details class="border-t border-line pt-2">
          <summary class="cursor-pointer text-[11px] font-medium text-ink-muted hover:text-ink">
            英语作文专项配置（称呼 / 落款 / 读后续写）
          </summary>
          <div class="mt-2 space-y-2.5">
            <div class="space-y-1">
              <Label for="english-salutation" class="text-[11px] text-ink-muted">
                英语应用文开头称呼 (Salutation)
              </Label>
              <Input
                id="english-salutation"
                :model-value="store.selectedBlock.englishWritingMeta?.salutation ?? ''"
                placeholder="如：Dear Chris,"
                class="h-7 text-xs"
                @update:model-value="(val) => updateEnglishSalutation(String(val))"
              />
            </div>

            <div class="space-y-1">
              <Label for="english-signoff" class="text-[11px] text-ink-muted">
                英语应用文右下角落款 (Sign-off)
              </Label>
              <Textarea
                id="english-signoff"
                :model-value="store.selectedBlock.englishWritingMeta?.signOff ?? ''"
                :rows="2"
                placeholder="如：Yours,&#10;Li Hua"
                class="text-xs"
                @update:model-value="(val) => updateEnglishSignOff(String(val))"
              />
            </div>

            <div class="space-y-2 border-t border-line pt-2">
              <div class="flex items-center justify-between">
                <Label for="english-continuation-toggle" class="text-xs font-medium">
                  读后续写双段首句模式
                </Label>
                <Switch
                  id="english-continuation-toggle"
                  :model-value="
                    Boolean(store.selectedBlock.englishWritingMeta?.continuationParagraphs?.length)
                  "
                  @update:model-value="(val) => enableEnglishContinuation(Boolean(val))"
                />
              </div>

              <div
                v-if="store.selectedBlock.englishWritingMeta?.continuationParagraphs?.length"
                class="space-y-2"
              >
                <div
                  v-for="(para, pIdx) in store.selectedBlock.englishWritingMeta
                    .continuationParagraphs"
                  :key="pIdx"
                  class="space-y-1.5 rounded-[8px] border border-line bg-raised p-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <Input
                      :model-value="para.heading"
                      class="h-6 w-28 text-xs font-semibold"
                      @update:model-value="
                        (val) => updateContinuationParagraph(pIdx, 'heading', String(val))
                      "
                    />
                    <div class="flex items-center gap-1 text-[11px] text-ink-muted">
                      <span>行数</span>
                      <Input
                        :model-value="para.baseLines"
                        type="number"
                        min="2"
                        max="16"
                        class="h-6 w-14 text-xs"
                        @update:model-value="
                          (val) => updateContinuationParagraph(pIdx, 'baseLines', Number(val))
                        "
                      />
                    </div>
                  </div>
                  <Textarea
                    :model-value="para.leadText"
                    :rows="2"
                    placeholder="输入读后续写给定英文首句..."
                    class="text-xs"
                    @update:model-value="
                      (val) => updateContinuationParagraph(pIdx, 'leadText', String(val))
                    "
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.45 Composition Grid (`composition_grid`) Editor      -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'composition_grid'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <p class="text-xs font-semibold text-ink">作文方格内部配置</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label class="text-[10px] text-ink-muted">总方格数</Label>
            <Input
              :model-value="store.selectedBlock.totalGrids"
              type="number"
              min="100"
              max="2000"
              step="20"
              class="h-7 text-xs"
              @update:model-value="(val) => updateCompositionField('totalGrids', Number(val))"
            />
          </div>
          <div class="space-y-1">
            <Label class="text-[10px] text-ink-muted">要求最少字数</Label>
            <Input
              :model-value="store.selectedBlock.minWords"
              type="number"
              min="50"
              max="2000"
              step="50"
              class="h-7 text-xs"
              @update:model-value="(val) => updateCompositionField('minWords', Number(val))"
            />
          </div>
        </div>
        <div class="space-y-1">
          <Label class="text-[10px] text-ink-muted">字数标尺（逗号分隔，如 600, 700, 800）</Label>
          <Input
            :model-value="store.selectedBlock.milestones.join(', ')"
            class="h-7 font-mono text-xs"
            @update:model-value="(val) => updateCompositionField('milestones', String(val))"
          />
        </div>
        <div class="flex items-center justify-between pt-1">
          <Label for="comp-title-row" class="text-xs">显示题目居中行</Label>
          <Switch
            id="comp-title-row"
            :model-value="store.selectedBlock.hasTitleRow"
            @update:model-value="(val) => updateCompositionField('hasTitleRow', Boolean(val))"
          />
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.5 Illustrated / Blank Box / Drawing Grid Inspector   -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="
          store.selectedBlock.type === 'open_blank_box' ||
          store.selectedBlock.type === 'drawing_grid' ||
          store.selectedBlock.type === 'mixed_inline'
        "
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-ink">配图与作图区域设置</p>
          <input
            ref="imageInputRef"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            class="hidden"
            @change="handleImageFileUpload"
          />
          <Button
            size="sm"
            variant="secondary"
            class="h-7 px-2 text-xs"
            @click="imageInputRef?.click()"
          >
            <ImagePlus class="mr-1 size-3.5" />
            选取 / 替换图片
          </Button>
        </div>

        <div
          v-if="
            store.selectedBlock.type === 'open_blank_box' ||
            store.selectedBlock.type === 'drawing_grid'
          "
          class="space-y-1"
        >
          <Label for="block-height-mm" class="text-[11px] text-ink-muted"> 作答框高度 (mm) </Label>
          <Input
            id="block-height-mm"
            :model-value="
              store.selectedBlockOverride.manualHeightMm ?? store.selectedBlock.baseHeightMm
            "
            type="number"
            min="20"
            max="240"
            class="h-7 text-xs"
            @update:model-value="
              (val) => store.setBlockHeightMm(store.selectedBlock!.id, Number(val))
            "
          />
        </div>

        <!-- Drawing Grid internal config -->
        <div
          v-if="store.selectedBlock.type === 'drawing_grid'"
          class="space-y-2 border-t border-line pt-2"
        >
          <div class="space-y-1">
            <Label class="text-[11px] text-ink-muted">作图区类型</Label>
            <Select
              :model-value="store.selectedBlock.gridType"
              @update:model-value="(val) => updateDrawingGridField('gridType', String(val))"
            >
              <SelectTrigger class="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coordinate_paper">坐标方格纸</SelectItem>
                <SelectItem value="image_canvas">配图作图画布</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div
            v-if="store.selectedBlock.gridType === 'coordinate_paper'"
            class="grid grid-cols-2 gap-2"
          >
            <div class="space-y-1">
              <Label class="text-[10px] text-ink-muted">网格行数</Label>
              <Input
                :model-value="store.selectedBlock.rows ?? 15"
                type="number"
                min="2"
                max="40"
                class="h-7 text-xs"
                @update:model-value="(val) => updateDrawingGridField('rows', Number(val))"
              />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] text-ink-muted">网格列数</Label>
              <Input
                :model-value="store.selectedBlock.cols ?? 20"
                type="number"
                min="2"
                max="40"
                class="h-7 text-xs"
                @update:model-value="(val) => updateDrawingGridField('cols', Number(val))"
              />
            </div>
          </div>
        </div>

        <!-- Open Blank Box sub-questions editor -->
        <div
          v-if="store.selectedBlock.type === 'open_blank_box'"
          class="space-y-2 border-t border-line pt-2"
        >
          <div class="flex items-center justify-between">
            <Label class="text-[11px] font-medium text-ink">内部小问列表</Label>
            <Button
              size="sm"
              variant="secondary"
              class="h-6 px-2 text-[10px]"
              @click="addOpenSubQuestion"
            >
              <Plus class="mr-0.5 size-2.5" />添加小问
            </Button>
          </div>
          <div v-if="store.selectedBlock.subQuestions?.length" class="space-y-1.5">
            <div
              v-for="(sub, sIdx) in store.selectedBlock.subQuestions"
              :key="sIdx"
              class="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_auto] items-center gap-1.5 rounded-[6px] border border-line bg-raised p-1.5"
            >
              <Input
                :model-value="sub.subNo"
                placeholder="小问"
                class="h-6 text-xs"
                @update:model-value="(v) => updateOpenSubQuestion(sIdx, 'subNo', String(v))"
              />
              <Input
                :model-value="sub.score ?? ''"
                type="number"
                step="0.5"
                min="0"
                title="分值"
                placeholder="分"
                class="h-6 text-xs"
                @update:model-value="(v) => updateOpenSubQuestion(sIdx, 'score', Number(v))"
              />
              <Input
                :model-value="sub.heightRatio ?? ''"
                type="number"
                step="0.1"
                min="0.1"
                max="1"
                title="高度占比"
                placeholder="占比"
                class="h-6 text-xs"
                @update:model-value="(v) => updateOpenSubQuestion(sIdx, 'heightRatio', Number(v))"
              />
              <button
                type="button"
                class="text-ink-muted hover:text-danger"
                @click="removeOpenSubQuestion(sIdx)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="store.selectedBlock.type === 'open_blank_box'" class="space-y-1">
          <Label for="asset-position-select" class="text-[11px] text-ink-muted"> 配图方位 </Label>
          <Select
            :model-value="getBlockAssetPosition(store.selectedBlock)"
            @update:model-value="(val) => setBlockAssetPosition(val as AssetPosition)"
          >
            <SelectTrigger id="asset-position-select" class="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-right">右上角 (Top Right)</SelectItem>
              <SelectItem value="top-left">左上角 (Top Left)</SelectItem>
              <SelectItem value="bottom">底部居中 (Bottom)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <Label for="asset-width-ratio" class="text-ink-muted">图片宽度占比 (%)</Label>
            <span class="font-mono text-ink">
              {{ getBlockImageWidthRatio(store.selectedBlock) }}%
            </span>
          </div>
          <Input
            id="asset-width-ratio"
            :model-value="getBlockImageWidthRatio(store.selectedBlock)"
            type="number"
            min="15"
            max="85"
            step="5"
            class="h-7 text-xs"
            @update:model-value="(val) => setBlockImageWidthRatio(Number(val))"
          />
        </div>

        <div class="flex items-center justify-between border-t border-line pt-2">
          <div class="space-y-0.5">
            <Label for="asset-monochrome-switch" class="text-xs font-medium text-ink">
              黑白线稿去底色
            </Label>
            <p class="text-[10px] text-ink-muted">高对比滤镜去除原卷扫描灰底</p>
          </div>
          <Switch
            id="asset-monochrome-switch"
            :model-value="getBlockMonochrome()"
            @update:model-value="(val) => toggleBlockMonochrome(Boolean(val))"
          />
        </div>
      </div>

      <!-- Delete Block Button -->
      <Button
        variant="danger"
        size="sm"
        class="w-full text-xs"
        @click="store.deleteBlock(store.selectedBlock.id)"
      >
        <Trash2 class="mr-1.5 size-3.5" />
        删除此题块
      </Button>
    </div>
  </aside>
</template>
