<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ClipboardCopy, FileUp, Sparkles, Upload } from 'lucide-vue-next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  buildAiPromptTemplate,
  parseExamDocx,
  parseExamJson,
  parseExamPdf,
  parseExamText,
} from '@/lib/exam-paper/parser'
import { computePaperStats } from '@/lib/exam-paper/render'
import type { ExamDocument } from '@/lib/exam-paper/types'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  apply: [doc: ExamDocument, mode: 'replace' | 'append']
}>()

const activeTab = ref<'text' | 'file' | 'json'>('text')
const rawText = ref('')
const rawJson = ref('')

const fileName = ref('')
const fileLoading = ref(false)
const fileError = ref('')
const parsedFileDoc = ref<ExamDocument | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const promptCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const parsedTextResult = computed(() => {
  if (!rawText.value.trim()) return { doc: null, error: '' }
  try {
    const doc = parseExamText(rawText.value)
    return { doc, error: '' }
  } catch (err) {
    return { doc: null, error: err instanceof Error ? err.message : '文本解析失败。' }
  }
})

const parsedJsonResult = computed(() => {
  if (!rawJson.value.trim()) return { doc: null, error: '' }
  try {
    const doc = parseExamJson(rawJson.value)
    return { doc, error: '' }
  } catch (err) {
    return { doc: null, error: err instanceof Error ? err.message : 'JSON 解析失败。' }
  }
})

const activeDoc = computed<ExamDocument | null>(() => {
  if (activeTab.value === 'text') return parsedTextResult.value.doc
  if (activeTab.value === 'file') return parsedFileDoc.value
  return parsedJsonResult.value.doc
})

const activeStats = computed(() => (activeDoc.value ? computePaperStats(activeDoc.value) : null))

const activeError = computed(() => {
  if (activeTab.value === 'text') return parsedTextResult.value.error
  if (activeTab.value === 'file') return fileError.value
  return parsedJsonResult.value.error
})

watch(open, (isOpen) => {
  if (!isOpen) {
    fileError.value = ''
  }
})

async function handleFile(file: File) {
  fileError.value = ''
  parsedFileDoc.value = null
  fileName.value = file.name
  fileLoading.value = true

  try {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer()
      parsedFileDoc.value = await parseExamPdf(buffer)
    } else if (lower.endsWith('.docx')) {
      const buffer = await file.arrayBuffer()
      parsedFileDoc.value = await parseExamDocx(buffer)
    } else if (lower.endsWith('.json')) {
      const text = await file.text()
      parsedFileDoc.value = parseExamJson(text)
    } else {
      const text = await file.text()
      parsedFileDoc.value = parseExamText(text)
    }
  } catch (err) {
    fileError.value = err instanceof Error ? err.message : '读取文件失败，请确认文件格式正确。'
  } finally {
    fileLoading.value = false
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void handleFile(file)
  }
  input.value = ''
}

function onDropFile(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    void handleFile(file)
  }
}

async function copyAiPrompt() {
  try {
    await navigator.clipboard?.writeText(buildAiPromptTemplate())
    promptCopied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      promptCopied.value = false
    }, 1800)
  } catch {
    // Ignore clipboard rejection.
  }
}

function confirmApply(mode: 'replace' | 'append') {
  if (!activeDoc.value) return
  emit('apply', activeDoc.value, mode)
  open.value = false
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[88dvh] w-[min(42rem,calc(100vw-2rem))] flex-col gap-4">
      <div class="space-y-1 pr-6">
        <DialogTitle>导入试卷内容</DialogTitle>
        <DialogDescription>
          支持从 PDF 试卷 (.pdf)、Word (.docx)、符合模板格式的文本或 JSON 结构化数据导入并编辑。
        </DialogDescription>
      </div>

      <Tabs
        :model-value="activeTab"
        class="flex min-h-0 flex-1 flex-col gap-3"
        @update:model-value="
          (v) => {
            if (v === 'text' || v === 'file' || v === 'json') activeTab = v
          }
        "
      >
        <TabsList class="shrink-0 self-start">
          <TabsTrigger value="text">文本解析</TabsTrigger>
          <TabsTrigger value="file">上传文件</TabsTrigger>
          <TabsTrigger value="json">JSON / AI 提示词</TabsTrigger>
        </TabsList>

        <TabsContent
          value="text"
          class="mt-0 flex min-h-0 flex-1 flex-col gap-2 data-[state=inactive]:hidden"
        >
          <Textarea
            v-model="rawText"
            :rows="10"
            class="min-h-56 flex-1 resize-y font-mono text-[13px] leading-6"
            placeholder="直接粘贴试卷文本，例如：&#10;2026年数学阶段测试&#10;一、选择题（每小题3分）&#10;1.题目内容&#10;A.选项A&#10;B.选项B&#10;【难度】容易&#10;【知识点】集合&#10;【答案】A&#10;【解析】解析说明"
            spellcheck="false"
          />
          <p class="text-[12px] text-ink-muted">
            自动识别大题（一、）、题组分隔符（（一）/ 第一节 / A）、连续题号（1. / 18.（本题10分））、子题（（1））及【难度】【知识点】【答案】【解析】【步骤N】标签。
          </p>
        </TabsContent>

        <TabsContent
          value="file"
          class="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.docx,.txt,.md,.json"
            class="hidden"
            @change="onFileInputChange"
          />
          <button
            type="button"
            class="flex min-h-44 flex-col items-center justify-center gap-2.5 rounded-panel border border-dashed border-line bg-surface px-6 py-8 text-center transition-colors hover:border-ink hover:bg-control"
            @click="fileInputRef?.click()"
            @dragover.prevent
            @drop.prevent="onDropFile"
          >
            <div
              class="flex size-11 items-center justify-center rounded-full border border-line bg-raised text-ink"
            >
              <Upload v-if="!fileLoading" class="size-5" />
              <FileUp v-else class="size-5 animate-pulse" />
            </div>
            <p class="text-[14px] font-medium text-ink">
              {{ fileLoading ? '正在解析文件…' : fileName ? `已选择：${fileName}` : '点击或拖拽上传文件' }}
            </p>
            <p class="text-[12px] text-ink-muted">
              支持 .pdf、.docx（含模板原文件）、.txt 或 .json，全程本地解析
            </p>
          </button>
        </TabsContent>

        <TabsContent
          value="json"
          class="mt-0 flex min-h-0 flex-1 flex-col gap-2.5 data-[state=inactive]:hidden"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-[12px] text-ink-muted">
              可先复制 AI 整理提示词让大模型输出标准 JSON，再粘贴到下方导入：
            </span>
            <Button type="button" variant="secondary" size="sm" @click="copyAiPrompt">
              <Check v-if="promptCopied" class="size-3.5 text-accent" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ promptCopied ? '已复制 AI 提示词' : '复制 AI 转换提示词' }}
            </Button>
          </div>
          <Textarea
            v-model="rawJson"
            :rows="9"
            class="min-h-52 flex-1 resize-y font-mono text-[13px] leading-6"
            placeholder='粘贴 JSON，例如 { "title": "试卷名称", "sections": [...] }'
            spellcheck="false"
          />
        </TabsContent>
      </Tabs>

      <Alert v-if="activeError" variant="danger" class="shrink-0 bg-surface">
        <AlertTitle>解析失败</AlertTitle>
        <AlertDescription>{{ activeError }}</AlertDescription>
      </Alert>

      <div
        v-else-if="activeDoc && activeStats"
        class="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2 text-[12px]"
      >
        <span class="truncate font-medium text-ink">
          <Sparkles class="mr-1 inline size-3.5 text-accent" />
          {{ activeDoc.title }}
        </span>
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{{ activeStats.sectionCount }} 个大题</Badge>
          <Badge variant="outline">{{ activeStats.questionCount }} 道题</Badge>
          <Badge v-if="activeStats.groupCount" variant="outline">
            {{ activeStats.groupCount }} 个题组
          </Badge>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">
        <DialogClose as-child>
          <Button type="button" variant="ghost" size="sm">取消</Button>
        </DialogClose>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          :disabled="!activeDoc || activeStats?.sectionCount === 0"
          @click="confirmApply('append')"
        >
          追加大题到当前试卷
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          :disabled="!activeDoc || activeStats?.sectionCount === 0"
          @click="confirmApply('replace')"
        >
          替换当前试卷
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
