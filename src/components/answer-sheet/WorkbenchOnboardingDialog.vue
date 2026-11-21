<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { SUBJECT_LABELS, type PreviewSampleKey } from '@/lib/answer-sheet/preview'
import type { SubjectType } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  parsed: []
  loadedSample: [key: PreviewSampleKey]
}>()

const store = useAnswerSheetStore()

const activeTab = ref<'upload' | 'paste'>('upload')
const hintSubject = ref<SubjectType | 'auto'>('auto')
const selectedFile = ref<File | null>(null)
const pastedText = ref('')
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement>()

const sampleOptions: Array<{ key: PreviewSampleKey; label: string; desc: string }> = [
  { key: 'chinese', label: '新高考语文全卷', desc: '含 A-H 断句、双空默写、800 字作文格' },
  { key: 'english', label: '新高考英语全卷', desc: '含 3 选听力、七选五、应用文与读后续写' },
  { key: 'physics', label: '新高考理综模拟', desc: '含数理多选、KaTeX 公式、实验作图与解答框' },
  { key: 'weekend', label: '高三语文周末作业', desc: '8开两栏紧凑实战样卷' },
]

const hasDraftToRetry = computed(() => {
  if (store.draftSource.type === 'file') return true
  if (store.draftSource.type === 'text' && store.draftSource.text.trim().length > 0) return true
  return false
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    selectedFile.value = file
    activeTab.value = 'upload'
  }
}

async function handleSubmit() {
  if (activeTab.value === 'upload') {
    if (!selectedFile.value) return
    const ok = await store.submitOnboardingParse(
      { type: 'file', file: selectedFile.value },
      hintSubject.value,
    )
    if (ok) {
      open.value = false
      emit('parsed')
    }
  } else {
    if (!pastedText.value.trim()) return
    const ok = await store.submitOnboardingParse(
      { type: 'text', text: pastedText.value },
      hintSubject.value,
    )
    if (ok) {
      open.value = false
      emit('parsed')
    }
  }
}

async function handleRetryDraft() {
  const ok = await store.retryDraftParse(hintSubject.value)
  if (ok) {
    open.value = false
    emit('parsed')
  }
}

async function handleSelectSample(key: PreviewSampleKey) {
  await store.loadSamplePreset(key)
  open.value = false
  emit('loadedSample', key)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[min(38rem,calc(100vw-2rem))] space-y-4">
      <div class="space-y-1">
        <DialogTitle>上传或粘贴试卷生成智能答题卡</DialogTitle>
        <DialogDescription>
          先将原始文件或试卷文本保存为浏览器本地草稿，再通过单请求 SSE 流式解析题目语义结构。
        </DialogDescription>
      </div>

      <!-- Subject Pre-select -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2"
      >
        <div class="space-y-0.5">
          <Label for="onboarding-subject" class="text-xs font-medium text-ink"
            >学科预选（可选）</Label
          >
          <p class="text-[11px] text-ink-muted">默认由 AI 快速定科路由自动识别 9 大高考学科</p>
        </div>
        <Select v-model="hintSubject">
          <SelectTrigger id="onboarding-subject" class="h-8 w-36 text-xs">
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

      <!-- Tabs: File Upload vs Paste Text -->
      <Tabs v-model="activeTab" class="space-y-3">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            <FileUp class="mr-1.5 size-3.5" />
            上传试卷文件 (.docx / .pdf / 图片)
          </TabsTrigger>
          <TabsTrigger value="paste">
            <FileText class="mr-1.5 size-3.5" />
            直接粘贴试卷文本
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed px-4 py-8 text-center transition-colors"
            :class="
              isDragging
                ? 'border-accent bg-surface'
                : 'border-line bg-surface hover:border-ink-muted'
            "
            role="button"
            tabindex="0"
            aria-label="拖拽或点击上传试卷文件"
            @click="fileInputRef?.click()"
            @keydown.enter.prevent="fileInputRef?.click()"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".docx,.pdf,image/png,image/jpeg,image/webp"
              class="hidden"
              @change="onFileChange"
            />
            <Upload class="size-7 text-ink-muted" />
            <div v-if="selectedFile" class="space-y-1">
              <p class="text-sm font-medium text-ink">{{ selectedFile.name }}</p>
              <p class="text-xs text-ink-muted">
                {{ Math.max(1, Math.round(selectedFile.size / 1024)) }} KB · 点击可更换文件
              </p>
            </div>
            <div v-else class="space-y-1">
              <p class="text-sm font-medium text-ink">拖拽试卷文件到此处，或点击浏览本机文件</p>
              <p class="text-xs text-ink-muted">
                支持 Word (.docx)、电子或扫描版 PDF (.pdf) 及试卷照片，单文件上限 20MB
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="paste">
          <div class="space-y-1.5">
            <Label for="onboarding-paste-textarea" class="text-xs">试卷原文或 Markdown 文本</Label>
            <Textarea
              id="onboarding-paste-textarea"
              v-model="pastedText"
              :rows="6"
              placeholder="在此粘贴整份试卷或部分大题文本（保留题号、分值与下划线空位）..."
              class="text-xs"
            />
          </div>
        </TabsContent>
      </Tabs>

      <!-- Live SSE Progress Panel -->
      <div
        v-if="store.isParsing || store.parseStage"
        class="space-y-2 rounded-control border border-line bg-surface p-3"
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
          <summary class="cursor-pointer">模型思考</summary>
          <div class="mt-1 max-h-48 space-y-2 overflow-auto">
            <div v-for="entry in store.parseReasoning" :key="entry.callId">
              <p class="font-medium text-ink">
                {{
                  {
                    ocr_page: '识别页面',
                    exam_metadata: '识别试卷信息',
                    question_blocks: '解析题目',
                  }[entry.stage] ?? '解析试卷'
                }}
                · {{ entry.callId }}
              </p>
              <p class="whitespace-pre-wrap break-words">{{ entry.text }}</p>
            </div>
          </div>
        </details>
        <ul
          v-if="store.parsedQuestions.length"
          aria-label="逐题解析结果"
          class="mt-2 max-h-36 space-y-1 overflow-auto text-xs text-ink-muted"
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

      <!-- Parse Error & Local Draft Retry -->
      <Alert v-if="store.parseError" variant="danger">
        <template #icon>
          <AlertCircle class="size-4" />
        </template>
        <AlertTitle>解析请求未完成（原始试卷已保存在本地草稿）</AlertTitle>
        <AlertDescription class="space-y-2">
          <p class="text-xs">{{ store.parseError }}</p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="hasDraftToRetry"
              size="sm"
              variant="secondary"
              :disabled="store.isParsing"
              @click="handleRetryDraft"
            >
              <template #leading><RefreshCw class="size-3.5" /></template>
              从本地草稿重新提交
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <!-- Quick Sample Presets -->
      <div class="space-y-2 border-t border-line pt-3">
        <div class="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Sparkles class="size-3.5 text-accent" />
          <span>或者直接载入内置新高考全真样卷体验工作台：</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="item in sampleOptions"
            :key="item.key"
            type="button"
            class="flex flex-col items-start rounded-control border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-control"
            @click="handleSelectSample(item.key)"
          >
            <span class="text-xs font-semibold text-ink">{{ item.label }}</span>
            <span class="text-[11px] text-ink-muted">{{ item.desc }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <Button
          v-if="store.isParsing"
          variant="secondary"
          size="sm"
          @click="store.cancelOnboardingParse()"
        >
          取消解析
        </Button>
        <Button v-else variant="ghost" size="sm" @click="open = false">关闭</Button>
        <Button
          variant="primary"
          size="sm"
          :loading="store.isParsing"
          :disabled="
            store.isParsing || (activeTab === 'upload' ? !selectedFile : !pastedText.trim())
          "
          @click="handleSubmit"
        >
          保存草稿并开始解析
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
