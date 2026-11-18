<script setup lang="ts">
import { katex } from '@mdit/plugin-katex'
import 'katex/dist/katex.min.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import {
  Check,
  ClipboardCopy,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  ScanText,
  Upload,
  X,
} from 'lucide-vue-next'

import { getApiBaseUrl } from '@/api'
import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const OCR_API_URL = `${getApiBaseUrl()}/ocr`
const markdownIt = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true,
}).use(katex, {
  throwOnError: false,
})

type OutputMode = 'text' | 'markdown'
type OutputTab = 'result' | 'source' | 'overlay'

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
  rawResults?: unknown[]
}

interface LayoutOverlayPage {
  imageUrl: string
  blocks: LayoutBlock[]
}

interface LayoutBlock {
  label: string
  content: string
}

const file = ref<File | null>(null)
const localPreviewUrl = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const outputMode = ref<OutputMode>('text')
const activeOutputTab = ref<OutputTab>('result')
const result = ref('')
const pages = ref<OcrPage[]>([])
const rawResults = ref<unknown[]>([])
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const copySuccess = ref(false)
const selectedPageIndex = ref('0')
let recognitionToken = 0
let copyTimer: ReturnType<typeof setTimeout> | undefined

watch(outputMode, (mode) => {
  if (mode === 'text' && activeOutputTab.value === 'source') {
    activeOutputTab.value = 'result'
  }
  if (file.value && !loading.value) {
    void recognize()
  }
})

function releaseLocalPreview() {
  if (!localPreviewUrl.value) return
  URL.revokeObjectURL(localPreviewUrl.value)
  localPreviewUrl.value = ''
}

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste)
  releaseLocalPreview()
  clearTimeout(copyTimer)
})

onMounted(() => {
  window.addEventListener('paste', handlePaste)
})

const fileSize = computed(() => {
  if (!file.value) return ''
  const mb = file.value.size / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.ceil(file.value.size / 1024)} KB`
})

const canRun = computed(() => Boolean(file.value) && !loading.value)
const ocrImages = computed(() => pages.value.map((page) => page.ocrImage).filter(Boolean))
const layoutOverlayPages = computed(() => extractLayoutOverlayPages(rawResults.value))
const selectedOverlayPage = computed(
  () => layoutOverlayPages.value[Number(selectedPageIndex.value)] ?? null,
)
const firstResultImage = computed(
  () => layoutOverlayPages.value[0]?.imageUrl ?? ocrImages.value[0] ?? '',
)
const fallbackPreviewUrl = computed(() => firstResultImage.value || localPreviewUrl.value)

const markdownOutput = computed(() =>
  pages.value
    .map((page) => resolveMarkdownImages(page).trim() || page.text?.trim() || '')
    .filter(Boolean)
    .join('\n\n---\n\n'),
)

const textOutput = computed(() =>
  pages.value
    .map((page) => page.text?.trim() || plainTextFromMarkdown(page.markdown))
    .filter(Boolean)
    .join('\n\n'),
)

const copyableOutput = computed(() =>
  outputMode.value === 'markdown' ? markdownOutput.value : textOutput.value,
)

const renderedMarkdown = computed(() => markdownIt.render(markdownOutput.value))

watch(layoutOverlayPages, () => {
  selectedPageIndex.value = '0'
})

async function selectFile(nextFile: File | null) {
  if (!nextFile) return

  releaseLocalPreview()
  file.value = nextFile
  if (nextFile.type.startsWith('image/')) {
    localPreviewUrl.value = URL.createObjectURL(nextFile)
  }
  error.value = ''
  result.value = ''
  pages.value = []
  rawResults.value = []
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
  const pastedFile = (imageItem ?? fileItem)?.getAsFile() ?? null
  if (!pastedFile) return

  event.preventDefault()
  void selectFile(pastedFile)
}

function clearFile() {
  recognitionToken++
  releaseLocalPreview()
  file.value = null
  result.value = ''
  pages.value = []
  rawResults.value = []
  error.value = ''
  loading.value = false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function extractLayoutOverlayPages(results: unknown[]): LayoutOverlayPage[] {
  const overlayPages: LayoutOverlayPage[] = []

  for (const item of results) {
    if (!isRecord(item)) continue
    overlayPages.push(...extractDocumentLayoutOverlayPages(item))
    overlayPages.push(...extractPlainOcrOverlayPages(item))
  }

  return overlayPages
}

function extractDocumentLayoutOverlayPages(item: Record<string, unknown>): LayoutOverlayPage[] {
  if (!Array.isArray(item.layoutParsingResults)) return []

  const overlayPages: LayoutOverlayPage[] = []

  for (const layoutResult of item.layoutParsingResults) {
    if (!isRecord(layoutResult)) continue

    const prunedResult = isRecord(layoutResult.prunedResult) ? layoutResult.prunedResult : null
    const outputImages = isRecord(layoutResult.outputImages) ? layoutResult.outputImages : null
    const imageUrl =
      asString(outputImages?.layout_det_res) ||
      Object.values(outputImages ?? {})
        .map(asString)
        .find(Boolean) ||
      asString(layoutResult.inputImage)
    const parsingList = Array.isArray(prunedResult?.parsing_res_list)
      ? prunedResult.parsing_res_list
      : []

    if (!imageUrl || !parsingList.length) continue

    const blocks = parsingList.filter(isRecord).map((block) => ({
      label: asString(block.block_label),
      content: asString(block.block_content),
    }))

    if (blocks.length) {
      overlayPages.push({ imageUrl, blocks })
    }
  }

  return overlayPages
}

function extractPlainOcrOverlayPages(item: Record<string, unknown>): LayoutOverlayPage[] {
  if (!Array.isArray(item.ocrResults)) return []

  const overlayPages: LayoutOverlayPage[] = []

  for (const ocrResult of item.ocrResults) {
    if (!isRecord(ocrResult)) continue

    const prunedResult = isRecord(ocrResult.prunedResult) ? ocrResult.prunedResult : null
    const imageUrl = asString(ocrResult.ocrImage) || asString(ocrResult.inputImage)
    const texts = Array.isArray(prunedResult?.rec_texts) ? prunedResult.rec_texts : []
    if (!imageUrl || !texts.length) continue

    const blocks = texts.map((text) => ({ label: 'text', content: asString(text) }))

    if (blocks.length) {
      overlayPages.push({ imageUrl, blocks })
    }
  }

  return overlayPages
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

function resolveMarkdownImages(page: OcrPage): string {
  let markdown = page.markdown
  for (const [path, url] of Object.entries(page.markdownImages ?? {})) {
    markdown = markdown.replaceAll(`src="${path}"`, `src="${url}"`)
    markdown = markdown.replaceAll(`src='${path}'`, `src='${url}'`)
    markdown = markdown.replaceAll(`](${path})`, `](${url})`)
  }
  return markdown
}

function renderOutput() {
  result.value = outputMode.value === 'markdown' ? markdownOutput.value : textOutput.value
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
      throw new Error(
        'error' in data && data.error ? data.error : `OCR 请求失败: ${response.status}`,
      )
    }

    if (currentToken !== recognitionToken) return

    pages.value = (data as OcrResponse).pages ?? []
    rawResults.value = (data as OcrResponse).rawResults ?? []
    renderOutput()

    if (!result.value && ocrImages.value.length) {
      activeOutputTab.value = 'overlay'
      error.value = '当前模型仅返回了检测图片，没有可复制的文本内容。'
    } else if (result.value) {
      activeOutputTab.value = 'result'
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
  if (!copyableOutput.value) return

  await navigator.clipboard.writeText(copyableOutput.value)
  copySuccess.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copySuccess.value = false
  }, 1800)
}
</script>

<template>
  <div class="flex flex-col pb-6" :aria-busy="loading">
    <ToolPageHeader
      title="OCR 图文识别"
      description="支持直接 Ctrl+V 粘贴截图、拖拽上传图片或 PDF，提取纯文本或结构化 Markdown。"
      :icon="ScanText"
    >
      <template #actions>
        <Tabs v-model="outputMode">
          <TabsList>
            <TabsTrigger value="text" class="gap-1.5 px-3 text-xs sm:text-sm">
              <ImageIcon class="size-3.5" />
              纯文本模式
            </TabsTrigger>
            <TabsTrigger value="markdown" class="gap-1.5 px-3 text-xs sm:text-sm">
              <FileText class="size-3.5" />
              Markdown 版面
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ToolPageHeader>

    <div
      class="grid gap-5 lg:h-[calc(100dvh-11.5rem)] lg:min-h-[30rem] lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)]"
    >
      <!-- Left Input Card -->
      <Card class="flex min-w-0 flex-col gap-4 py-4 lg:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-base">输入文件</CardTitle>
            <Badge variant="outline" class="font-normal">
              {{ outputMode === 'markdown' ? 'PaddleOCR-VL' : 'PP-OCRv6' }}
            </Badge>
          </div>
        </CardHeader>

        <CardContent class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4">
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept="image/*,.pdf"
            @change="handleFileInput"
          />

          <div
            role="button"
            tabindex="0"
            class="group relative flex min-h-52 flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-5 text-center transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :class="
              dragging
                ? 'border-primary bg-accent/60'
                : 'border-border hover:border-foreground/30 hover:bg-muted/35'
            "
            @click="fileInput?.click()"
            @keydown.enter.prevent="fileInput?.click()"
            @keydown.space.prevent="fileInput?.click()"
            @dragenter.prevent="dragging = true"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="handleDrop"
          >
            <template v-if="localPreviewUrl">
              <img
                :src="localPreviewUrl"
                alt="待识别图片预览"
                class="max-h-52 max-w-full rounded-md object-contain"
                :class="loading && 'opacity-45'"
              />
              <p class="mt-2.5 text-xs text-muted-foreground">点击或粘贴新图片即可替换</p>
            </template>

            <template v-else>
              <div
                class="mb-3 flex size-11 items-center justify-center rounded-full border bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <Upload class="size-5" />
              </div>
              <p class="text-sm font-medium text-foreground">粘贴截图、拖放或点击选择文件</p>
              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                支持常见图片格式与 PDF 文档
              </p>
            </template>

            <div
              v-if="loading"
              class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/75 backdrop-blur-[2px]"
            >
              <LoaderCircle class="size-6 animate-spin text-primary" />
              <span class="text-xs font-medium text-foreground">正在识别文档内容…</span>
            </div>
          </div>

          <div
            v-if="file"
            class="flex items-center justify-between gap-2 rounded-lg border bg-muted/25 px-3 py-2.5"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ file.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ file.type || '未知格式' }} · {{ fileSize }}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="移除文件"
              @click="clearFile"
            >
              <X class="size-4" />
            </Button>
          </div>

          <Button type="button" class="w-full" :disabled="!canRun" @click="recognize">
            <LoaderCircle v-if="loading" class="size-4 animate-spin" />
            <RefreshCw v-else class="size-4" />
            {{ loading ? '识别中…' : result ? '重新识别' : '开始识别' }}
          </Button>

          <Alert v-if="error" :variant="result ? 'default' : 'destructive'">
            <AlertTitle>{{ result ? '提示' : '识别失败' }}</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <!-- Right Output Card -->
      <Card class="flex min-h-[26rem] min-w-0 flex-col gap-3 py-4 lg:min-h-0">
        <CardHeader class="px-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <Tabs v-model="activeOutputTab">
              <TabsList>
                <TabsTrigger value="result" class="px-3 text-xs">
                  {{ outputMode === 'markdown' ? '渲染预览' : '识别文本' }}
                </TabsTrigger>
                <TabsTrigger v-if="outputMode === 'markdown'" value="source" class="px-3 text-xs">
                  MD 源码
                </TabsTrigger>
                <TabsTrigger value="overlay" class="px-3 text-xs"> 版面区域 </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-8 text-xs"
              :disabled="!copyableOutput"
              :class="
                copySuccess &&
                'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              "
              @click="copyOutput"
            >
              <Check v-if="copySuccess" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{
                copySuccess ? '已复制' : outputMode === 'markdown' ? '复制 Markdown' : '复制文本'
              }}
            </Button>
          </div>
        </CardHeader>

        <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
          <!-- Tab 1: Primary Result (Text or Rendered Markdown) -->
          <template v-if="activeOutputTab === 'result'">
            <div
              v-if="outputMode === 'markdown'"
              class="markdown-preview min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/15 px-5 py-4"
            >
              <div v-if="markdownOutput" v-html="renderedMarkdown" />
              <div
                v-else
                class="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground"
              >
                {{ loading ? '正在解析 Markdown 版面…' : '上传图片或文档后，在此查看排版预览' }}
              </div>
            </div>

            <Textarea
              v-else
              :model-value="textOutput"
              class="h-full min-h-60 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 lg:min-h-0"
              readonly
              spellcheck="false"
              :placeholder="
                loading ? '正在提取文字…' : '上传或粘贴图片后，识别出的纯文本将显示在这里…'
              "
            />
          </template>

          <!-- Tab 2: Markdown Raw Source -->
          <Textarea
            v-else-if="activeOutputTab === 'source'"
            :model-value="markdownOutput"
            class="h-full min-h-60 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 lg:min-h-0"
            readonly
            spellcheck="false"
            placeholder="Markdown 源码将显示在这里…"
          />

          <!-- Tab 3: Layout / Image Overlay -->
          <template v-else>
            <div
              v-if="layoutOverlayPages.length"
              class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
            >
              <div class="flex items-center justify-between gap-3 border-b bg-muted/25 px-3 py-2">
                <span class="text-xs text-muted-foreground">
                  检测到 {{ selectedOverlayPage?.blocks.length ?? 0 }} 个文本块
                </span>
                <div class="flex items-center gap-2">
                  <Select v-if="layoutOverlayPages.length > 1" v-model="selectedPageIndex">
                    <SelectTrigger class="h-7 w-28 text-xs" aria-label="选择识别页">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="(_, pageIndex) in layoutOverlayPages"
                        :key="pageIndex"
                        :value="String(pageIndex)"
                      >
                        第 {{ pageIndex + 1 }} 页
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" class="font-normal">
                    共 {{ layoutOverlayPages.length }} 页
                  </Badge>
                </div>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto bg-muted/15 p-3 md:overflow-hidden">
                <div
                  v-if="selectedOverlayPage"
                  :key="`${selectedOverlayPage.imageUrl}-${selectedPageIndex}`"
                  class="grid min-h-0 gap-3 md:h-full md:grid-cols-[minmax(0,3fr)_minmax(14rem,2fr)]"
                >
                  <div
                    class="flex min-h-56 items-center justify-center overflow-hidden rounded-md border bg-background p-2 md:min-h-0"
                  >
                    <img
                      :src="selectedOverlayPage.imageUrl"
                      class="block max-h-[50dvh] max-w-full object-contain lg:max-h-full"
                      alt="版面检测可视化"
                    />
                  </div>
                  <div
                    class="min-h-40 overflow-y-auto rounded-md border bg-background p-3 md:min-h-0"
                  >
                    <div class="flex flex-wrap content-start gap-1.5">
                      <Badge
                        v-for="(block, blockIndex) in selectedOverlayPage.blocks"
                        :key="`${blockIndex}-${block.label}-content`"
                        variant="secondary"
                        class="h-auto max-w-full whitespace-normal text-left font-normal"
                      >
                        {{ block.content || block.label || 'block' }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else-if="fallbackPreviewUrl"
              class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-3"
            >
              <img
                :src="fallbackPreviewUrl"
                class="max-h-full max-w-full rounded-md object-contain"
                alt="预览图片"
              />
            </div>

            <div
              v-else
              class="flex min-h-56 flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            >
              识别完成后在此查看检测框与版面分块
            </div>
          </template>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.markdown-preview {
  line-height: 1.75;
}

.markdown-preview :deep(h1) {
  margin: 0.75rem 0 1rem;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
}

.markdown-preview :deep(h2) {
  margin: 0.75rem 0;
  font-size: 1.25rem;
  font-weight: 650;
}

.markdown-preview :deep(p) {
  margin: 0.75rem 0;
}

.markdown-preview :deep(img) {
  display: inline-block;
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid var(--border);
  padding: 0.5rem;
  text-align: left;
}

.markdown-preview :deep(code) {
  border-radius: 0.25rem;
  background: var(--muted);
  padding: 0.125rem 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
}

.markdown-preview :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: 0.25rem;
}
</style>
