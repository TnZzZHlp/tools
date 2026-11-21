<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertCircle,
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
import { getColumnSizeMm } from '@/lib/answer-sheet/paper'
import { BLOCK_TYPE_LABELS, SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type {
  AnswerSheetBlock,
  AssetPosition,
  BlockType,
  HeaderMode,
  SubjectType,
} from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

defineProps<{
  font: SheetFont
}>()

const emit = defineEmits<{
  'update:font': [val: SheetFont]
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
          <Badge v-if="store.isParsing" variant="accent" class="text-[10px]"> 解析中 </Badge>
          <Badge v-else-if="store.semanticData" variant="neutral" class="text-[10px]">
            已解析
          </Badge>
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
        <!-- Header Mode: Barcode vs ID Grid -->
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
              <SelectItem value="id_grid">准考证号填涂区 (10位)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Subtitle & Total Score -->
        <div class="grid grid-cols-2 gap-2">
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
          <div class="space-y-1">
            <Label for="inspector-total-score" class="text-xs">卷面声明总分</Label>
            <Input
              id="inspector-total-score"
              :model-value="store.semanticData.meta.totalScore"
              type="number"
              min="1"
              max="300"
              class="h-8 text-xs"
              @update:model-value="(val) => store.setTotalScore(Number(val))"
            />
          </div>
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

        <Separator />

        <!-- Composition Grid Global Defaults -->
        <div class="space-y-2">
          <Label class="text-xs font-semibold text-ink">作文格默认字数与每行格数</Label>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <Label for="inspector-comp-words" class="text-[11px] text-ink-muted">
                要求字数 (如 800)
              </Label>
              <Input
                id="inspector-comp-words"
                :model-value="store.layoutConfig.defaultCompositionWords ?? 800"
                type="number"
                step="50"
                min="200"
                max="1500"
                class="h-8 text-xs"
                @update:model-value="
                  (val) =>
                    store.setDefaultCompositionConfig(
                      Number(val) || 800,
                      store.layoutConfig.defaultCompositionCols ?? 20,
                    )
                "
              />
            </div>
            <div class="space-y-1">
              <Label for="inspector-comp-cols" class="text-[11px] text-ink-muted">
                每行格数 (宽栏)
              </Label>
              <Input
                id="inspector-comp-cols"
                :model-value="store.layoutConfig.defaultCompositionCols ?? 25"
                type="number"
                min="12"
                max="28"
                class="h-8 text-xs"
                @update:model-value="
                  (val) =>
                    store.setDefaultCompositionConfig(
                      store.layoutConfig.defaultCompositionWords ?? 800,
                      Number(val) || 25,
                    )
                "
              />
            </div>
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

        <div class="space-y-2">
          <div
            v-for="(item, idx) in store.selectedBlock.items"
            :key="idx"
            class="space-y-1.5 rounded-[8px] border border-line bg-raised p-2"
          >
            <div class="flex items-center justify-between gap-1.5">
              <Input
                :model-value="item.subNo"
                placeholder="小题号"
                class="h-6 w-20 text-xs"
                @update:model-value="(val) => updateCompactBlankItem(idx, 'subNo', String(val))"
              />
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
                  class="h-7 text-xs font-mono"
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
                  class="h-7 text-xs font-mono"
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
      <!-- 2.3 Mixed Inline (`mixed_inline`) - Units & Segments   -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'mixed_inline'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <p class="text-xs font-semibold text-ink">混合填空行与单位 / LaTeX 公式</p>

        <div class="space-y-2">
          <template v-for="(row, rIdx) in store.selectedBlock.rows" :key="rIdx">
            <div
              v-if="row.type === 'inline_blank'"
              class="space-y-2 rounded-[8px] border border-line bg-raised p-2"
            >
              <p class="text-[11px] font-medium text-ink-muted">第 {{ rIdx + 1 }} 行（行内填空）</p>
              <div
                v-for="(seg, sIdx) in row.segments"
                :key="sIdx"
                class="space-y-1.5 border-t border-line pt-1.5 first:border-0 first:pt-0"
              >
                <div class="grid grid-cols-3 gap-1.5">
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
            </div>
          </template>
        </div>
      </div>

      <!-- ------------------------------------------------------ -->
      <!-- 2.4 Lined Writing (`lined_writing`) - Lines & English  -->
      <!-- ------------------------------------------------------ -->
      <div
        v-if="store.selectedBlock.type === 'lined_writing'"
        class="space-y-3 rounded-control border border-line bg-surface p-2.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-ink">横线写作与英语专项配置</p>
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

        <div class="space-y-1.5">
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

        <div class="space-y-1.5">
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
              v-for="(para, pIdx) in store.selectedBlock.englishWritingMeta.continuationParagraphs"
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
