<script setup lang="ts">
import { computed, ref } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Check,
  ClipboardCopy,
  FileText,
  Image,
  LoaderCircle,
  Upload,
  X,
} from 'lucide-vue-next'

const OCR_API_URL = 'https://api.tnzzz.top/ocr'

type OutputMode = 'text' | 'markdown'

interface OcrPage {
  page: number
  text?: string
  markdown: string
  markdownImages: Record<string, string>
  outputImages: Record<string, string>
  ocrImage?: string
}

interface OcrResponse {
  jobId: string
  pages: OcrPage[]
}

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const outputMode = ref<OutputMode>('markdown')
const result = ref('')
const pages = ref<OcrPage[]>([])
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const copySuccess = ref(false)
let recognitionToken = 0

const fileSize = computed(() => {
  if (!file.value) return ''
  const mb = file.value.size / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.ceil(file.value.size / 1024)} KB`
})

const canRun = computed(() => Boolean(file.value) && !loading.value)
const ocrImages = computed(() => pages.value.map((page) => page.ocrImage).filter(Boolean))

async function selectFile(nextFile: File | null) {
  if (!nextFile) return

  file.value = nextFile
  error.value = ''
  result.value = ''
  pages.value = []
  await recognize()
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  void selectFile(input.files?.[0] ?? null)
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  void selectFile(event.dataTransfer?.files?.[0] ?? null)
}

function handlePaste(event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items ?? [])
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'))
  const fileItem = items.find((item) => item.kind === 'file')
  void selectFile((imageItem ?? fileItem)?.getAsFile() ?? null)
}

function clearFile() {
  recognitionToken++
  file.value = null
  result.value = ''
  pages.value = []
  error.value = ''
  loading.value = false
}

function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[#>*\-\s]+/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderOutput(nextPages: OcrPage[]) {
  if (outputMode.value === 'markdown') {
    result.value = nextPages
      .map((page) => page.markdown.trim() || page.text?.trim() || '')
      .filter(Boolean)
      .join('\n\n---\n\n')
    return
  }

  result.value = nextPages
    .map((page) => page.text?.trim() || plainTextFromMarkdown(page.markdown))
    .filter(Boolean)
    .join('\n\n')
}

async function recognize() {
  if (!file.value) return

  const currentToken = ++recognitionToken
  loading.value = true
  error.value = ''
  result.value = ''
  pages.value = []

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    formData.append('model', outputMode.value === 'markdown' ? 'PaddleOCR-VL-1.6' : 'PP-OCRv6')
    formData.append(
      'optionalPayload',
      JSON.stringify(
        outputMode.value === 'markdown'
          ? {
              useDocOrientationClassify: false,
              useDocUnwarping: false,
              useChartRecognition: false,
            }
          : {
              useDocOrientationClassify: false,
              useDocUnwarping: false,
              useTextlineOrientation: false,
            },
      ),
    )

    const response = await fetch(OCR_API_URL, {
      method: 'POST',
      body: formData,
    })
    const data = (await response.json()) as OcrResponse | { error?: string }

    if (!response.ok) {
      throw new Error('error' in data && data.error ? data.error : `OCR 请求失败: ${response.status}`)
    }

    if (currentToken !== recognitionToken) return

    pages.value = (data as OcrResponse).pages ?? []
    renderOutput(pages.value)

    if (!result.value && ocrImages.value.length) {
      error.value = '当前模型只返回了 OCR 结果图片，没有可复制的文本内容。'
    }
  } catch (err) {
    if (currentToken !== recognitionToken) return
    error.value = err instanceof Error ? err.message : 'OCR 识别失败'
  } finally {
    if (currentToken === recognitionToken) {
      loading.value = false
    }
  }
}

async function copyOutput() {
  if (!result.value) return

  await navigator.clipboard.writeText(result.value)
  copySuccess.value = true
  setTimeout(() => {
    copySuccess.value = false
  }, 2000)
}
</script>

<template>
  <section class="grid h-full w-full min-h-0 gap-4 overflow-hidden lg:grid-cols-2 lg:gap-6">
    <section class="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <header class="shrink-0 space-y-1.5 sm:space-y-2">
        <Badge variant="secondary">OCR 输入</Badge>
        <div>
          <h2 class="text-lg font-semibold tracking-tight sm:text-xl">图片 / 文件识别</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            粘贴图片、拖入文件，或从本地选择文件后自动提交识别。
          </p>
        </div>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 overflow-auto pt-4 sm:pt-6">
        <div class="space-y-4">
          <div class="inline-flex rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              :variant="outputMode === 'markdown' ? 'default' : 'ghost'"
              @click="outputMode = 'markdown'"
            >
              <FileText class="h-4 w-4" />
              MD
            </Button>
            <Button
              type="button"
              size="sm"
              :variant="outputMode === 'text' ? 'default' : 'ghost'"
              @click="outputMode = 'text'"
            >
              <Image class="h-4 w-4" />
              纯文本
            </Button>
          </div>

          <div
            class="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="dragging ? 'border-primary bg-muted/70' : 'hover:bg-muted/40'"
            tabindex="0"
            @click="fileInput?.click()"
            @keydown.enter="fileInput?.click()"
            @keydown.space.prevent="fileInput?.click()"
            @paste.prevent="handlePaste"
            @dragenter.prevent="dragging = true"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="handleDrop"
          >
            <input
              ref="fileInput"
              class="hidden"
              type="file"
              accept="image/*,.pdf"
              @change="handleFileInput"
            />

            <Upload class="mb-4 h-10 w-10 text-muted-foreground" />
            <p class="font-medium">粘贴、拖放或选择文件</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              支持图片和 PDF。粘贴前先点击这个区域，让它获得焦点。
            </p>
          </div>

          <div v-if="file" class="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ file.name }}</p>
              <p class="text-xs text-muted-foreground">{{ file.type || '未知类型' }} · {{ fileSize }}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="移除文件" @click="clearFile">
              <X class="h-4 w-4" />
            </Button>
          </div>

          <Button type="button" class="w-full" :disabled="!canRun" @click="recognize">
            <LoaderCircle v-if="loading" class="h-4 w-4 animate-spin" />
            <FileText v-else class="h-4 w-4" />
            {{ loading ? '识别中' : '开始识别' }}
          </Button>

          <Alert v-if="error" :variant="result ? 'default' : 'destructive'">
            <AlertTitle>{{ result ? '提示' : '识别失败' }}</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
        </div>
      </div>
    </section>

    <section
      class="flex min-h-0 min-w-0 flex-col overflow-hidden border-t pt-4 lg:h-full lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0"
    >
      <header class="shrink-0">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1.5 sm:space-y-2">
            <Badge variant="outline">输出结果</Badge>
            <h2 class="text-lg font-semibold tracking-tight sm:text-xl">
              {{ outputMode === 'markdown' ? 'Markdown' : '纯文本' }}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            :disabled="!result"
            :aria-label="copySuccess ? '已复制' : '复制结果'"
            :class="copySuccess && 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'"
            @click="copyOutput"
          >
            <Check v-if="copySuccess" class="h-4 w-4" />
            <ClipboardCopy v-else class="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-3 pt-4">
        <Textarea
          :model-value="result"
          class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
          readonly
          spellcheck="false"
          placeholder="识别结果会显示在这里"
        />

        <div v-if="ocrImages.length" class="max-h-40 shrink-0 overflow-auto rounded-lg border p-3">
          <p class="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">OCR Images</p>
          <div class="space-y-1">
            <a
              v-for="(imageUrl, index) in ocrImages"
              :key="imageUrl"
              class="block truncate text-sm underline-offset-4 hover:underline"
              :href="imageUrl"
              target="_blank"
              rel="noreferrer"
            >
              第 {{ index + 1 }} 页结果图
            </a>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.visible-scrollbar {
  scrollbar-width: thin;
}

.visible-scrollbar::-webkit-scrollbar {
  display: block;
  width: 8px;
  height: 8px;
}
</style>
