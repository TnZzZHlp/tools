<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, ClipboardCopy, FileText, Image, LoaderCircle, Upload, X } from 'lucide-vue-next'

const OCR_API_URL = 'https://api.tnzzz.top/ocr'
const markdownIt = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true,
})

type OutputMode = 'text' | 'markdown'
type OutputTab = 'normal' | 'markdown' | 'text'

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
  width: number
  height: number
  blocks: LayoutBlock[]
}

interface LayoutBlock {
  label: string
  content: string
  polygon: Array<[number, number]>
}

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const outputMode = ref<OutputMode>('markdown')
const activeOutputTab = ref<OutputTab>('normal')
const result = ref('')
const pages = ref<OcrPage[]>([])
const rawResults = ref<unknown[]>([])
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const copySuccess = ref(false)
const previewUrl = ref('')
const overlayCanvases = new Map<number, HTMLCanvasElement>()
let recognitionToken = 0

watch(file, (nextFile) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }

  if (nextFile?.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(nextFile)
  }
})

watch(outputMode, (mode) => {
  if (activeOutputTab.value !== 'normal') {
    activeOutputTab.value = mode
  }
})

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  window.removeEventListener('paste', handlePaste)
  window.removeEventListener('resize', drawAllOverlayCanvases)
})

onMounted(() => {
  window.addEventListener('paste', handlePaste)
  window.addEventListener('resize', drawAllOverlayCanvases)
})

const fileSize = computed(() => {
  if (!file.value) return ''
  const mb = file.value.size / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.ceil(file.value.size / 1024)} KB`
})

const canRun = computed(() => Boolean(file.value) && !loading.value)
const ocrImages = computed(() => pages.value.map((page) => page.ocrImage).filter(Boolean))
const layoutOverlayPages = computed(() => extractLayoutOverlayPages(rawResults.value))
const firstResultImage = computed(
  () => layoutOverlayPages.value[0]?.imageUrl ?? ocrImages.value[0] ?? '',
)
const fallbackPreviewUrl = computed(() => previewUrl.value || firstResultImage.value)
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
const activeTextOutput = computed(() => {
  if (activeOutputTab.value === 'markdown') return markdownOutput.value
  if (activeOutputTab.value === 'text') return textOutput.value
  return ''
})
const renderedMarkdown = computed(() => markdownIt.render(markdownOutput.value))

watch(layoutOverlayPages, () => {
  void nextTick(() => drawAllOverlayCanvases())
})

async function selectFile(nextFile: File | null) {
  if (!nextFile) return

  file.value = nextFile
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

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parsePolygon(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return []

  return value
    .map((point) => {
      if (!Array.isArray(point)) return null
      const x = asNumber(point[0])
      const y = asNumber(point[1])
      return x === null || y === null ? null : ([x, y] as [number, number])
    })
    .filter((point): point is [number, number] => point !== null)
}

function boxToPolygon(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return []
  const x1 = asNumber(value[0])
  const y1 = asNumber(value[1])
  const x2 = asNumber(value[2])
  const y2 = asNumber(value[3])
  if (x1 === null || y1 === null || x2 === null || y2 === null) return []
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]
}

function setOverlayCanvas(element: HTMLCanvasElement | null, index: number) {
  if (element) {
    overlayCanvases.set(index, element)
    drawOverlayCanvas(index)
  } else {
    overlayCanvases.delete(index)
  }
}

function drawAllOverlayCanvases() {
  for (const index of overlayCanvases.keys()) {
    drawOverlayCanvas(index)
  }
}

function drawOverlayCanvas(index: number) {
  const canvas = overlayCanvases.get(index)
  const overlayPage = layoutOverlayPages.value[index]
  if (!canvas || !overlayPage) return

  const image = canvas.previousElementSibling
  if (!(image instanceof HTMLImageElement) || !image.complete) return

  const rect = image.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  canvas.width = Math.round(rect.width)
  canvas.height = Math.round(rect.height)

  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineWidth = 2
  context.strokeStyle = 'rgba(37, 99, 235, 0.95)'
  context.fillStyle = 'rgba(37, 99, 235, 0.18)'

  const scaleX = canvas.width / overlayPage.width
  const scaleY = canvas.height / overlayPage.height

  for (const block of overlayPage.blocks) {
    if (block.polygon.length < 3) continue

    context.beginPath()
    block.polygon.forEach(([x, y], pointIndex) => {
      const scaledX = x * scaleX
      const scaledY = y * scaleY
      if (pointIndex === 0) {
        context.moveTo(scaledX, scaledY)
      } else {
        context.lineTo(scaledX, scaledY)
      }
    })
    context.closePath()
    context.fill()
    context.stroke()
  }
}

function extractLayoutOverlayPages(results: unknown[]): LayoutOverlayPage[] {
  const overlayPages: LayoutOverlayPage[] = []

  for (const result of results) {
    if (!isRecord(result)) continue

    overlayPages.push(...extractDocumentLayoutOverlayPages(result))
    overlayPages.push(...extractPlainOcrOverlayPages(result))
  }

  return overlayPages
}

function extractDocumentLayoutOverlayPages(result: Record<string, unknown>): LayoutOverlayPage[] {
  if (!Array.isArray(result.layoutParsingResults)) return []

  const overlayPages: LayoutOverlayPage[] = []

  for (const layoutResult of result.layoutParsingResults) {
    if (!isRecord(layoutResult)) continue

    const prunedResult = isRecord(layoutResult.prunedResult) ? layoutResult.prunedResult : null
    const dataInfo = isRecord(result.dataInfo) ? result.dataInfo : null
    const imageUrl = asString(layoutResult.inputImage)
    const width = asNumber(prunedResult?.width) ?? asNumber(dataInfo?.width)
    const height = asNumber(prunedResult?.height) ?? asNumber(dataInfo?.height)
    const parsingList = Array.isArray(prunedResult?.parsing_res_list)
      ? prunedResult.parsing_res_list
      : []

    if (!imageUrl || !width || !height || !parsingList.length) continue

    const blocks = parsingList
      .filter(isRecord)
      .map((block) => {
        const polygon = parsePolygon(block.block_polygon_points)
        return {
          label: asString(block.block_label),
          content: asString(block.block_content),
          polygon: polygon.length >= 3 ? polygon : boxToPolygon(block.block_bbox),
        }
      })
      .filter((block) => block.polygon.length >= 3)

    if (blocks.length) {
      overlayPages.push({ imageUrl, width, height, blocks })
    }
  }

  return overlayPages
}

function extractPlainOcrOverlayPages(result: Record<string, unknown>): LayoutOverlayPage[] {
  if (!Array.isArray(result.ocrResults)) return []

  const dataInfo = isRecord(result.dataInfo) ? result.dataInfo : null
  const width = asNumber(dataInfo?.width)
  const height = asNumber(dataInfo?.height)
  if (!width || !height) return []

  const overlayPages: LayoutOverlayPage[] = []

  for (const ocrResult of result.ocrResults) {
    if (!isRecord(ocrResult)) continue

    const prunedResult = isRecord(ocrResult.prunedResult) ? ocrResult.prunedResult : null
    const imageUrl = asString(ocrResult.inputImage)
    const texts = Array.isArray(prunedResult?.rec_texts) ? prunedResult.rec_texts : []
    const polygons = Array.isArray(prunedResult?.rec_polys)
      ? prunedResult.rec_polys
      : Array.isArray(prunedResult?.dt_polys)
        ? prunedResult.dt_polys
        : []
    const boxes = Array.isArray(prunedResult?.rec_boxes)
      ? prunedResult.rec_boxes
      : Array.isArray(prunedResult?.dt_boxes)
        ? prunedResult.dt_boxes
        : []

    if (!imageUrl || (!polygons.length && !boxes.length)) continue

    const blockCount = Math.max(polygons.length, boxes.length)
    const blocks: LayoutBlock[] = []

    for (let index = 0; index < blockCount; index++) {
      const polygon = parsePolygon(polygons[index])
      const fallbackPolygon = boxToPolygon(boxes[index])
      const blockPolygon = polygon.length >= 3 ? polygon : fallbackPolygon

      if (blockPolygon.length >= 3) {
        blocks.push({
          label: 'text',
          content: asString(texts[index]),
          polygon: blockPolygon,
        })
      }
    }

    if (blocks.length) {
      overlayPages.push({ imageUrl, width, height, blocks })
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
  if (!activeTextOutput.value) return

  await navigator.clipboard.writeText(activeTextOutput.value)
  copySuccess.value = true
  setTimeout(() => {
    copySuccess.value = false
  }, 2000)
}
</script>

<template>
  <section
    class="relative grid h-full w-full min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] lg:gap-6"
    :aria-busy="loading"
  >
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
          <div class="inline-flex gap-1.5 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              class="min-w-24"
              :variant="outputMode === 'markdown' ? 'default' : 'ghost'"
              @click="outputMode = 'markdown'"
            >
              <FileText class="h-4 w-4" />
              MD
            </Button>
            <Button
              type="button"
              size="sm"
              class="min-w-24"
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
            <p class="mt-2 text-sm leading-6 text-muted-foreground">支持图片和 PDF</p>
          </div>

          <div v-if="file" class="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ file.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ file.type || '未知类型' }} · {{ fileSize }}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="移除文件"
              @click="clearFile"
            >
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
        <div class="flex items-center justify-between gap-3">
          <div class="inline-flex gap-1.5 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              class="min-w-20"
              :variant="activeOutputTab === 'normal' ? 'default' : 'ghost'"
              @click="activeOutputTab = 'normal'"
            >
              预览
            </Button>
            <Button
              v-if="outputMode === 'markdown'"
              type="button"
              size="sm"
              class="min-w-24"
              :variant="activeOutputTab === 'markdown' ? 'default' : 'ghost'"
              @click="activeOutputTab = 'markdown'"
            >
              Markdown
            </Button>
            <Button
              v-if="outputMode === 'text'"
              type="button"
              size="sm"
              class="min-w-20"
              :variant="activeOutputTab === 'text' ? 'default' : 'ghost'"
              @click="activeOutputTab = 'text'"
            >
              纯文本
            </Button>
          </div>
          <Button
            v-if="activeOutputTab !== 'normal'"
            type="button"
            variant="outline"
            size="icon"
            :disabled="!activeTextOutput"
            :aria-label="copySuccess ? '已复制' : '复制结果'"
            :class="
              copySuccess &&
              'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'
            "
            @click="copyOutput"
          >
            <Check v-if="copySuccess" class="h-4 w-4" />
            <ClipboardCopy v-else class="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-3 pt-4">
        <template v-if="activeOutputTab === 'normal'">
          <div
            v-if="fallbackPreviewUrl && !layoutOverlayPages.length"
            class="overflow-hidden rounded-lg border"
          >
            <div class="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div class="min-w-0">
                <p class="text-sm font-medium">图片预览</p>
                <p class="text-xs text-muted-foreground">
                  {{ firstResultImage ? '后端返回的图片' : '识别完成后会显示后端返回的区域图' }}
                </p>
              </div>
              <Badge variant="outline">{{ firstResultImage ? 'Result' : 'Local' }}</Badge>
            </div>
            <div class="visible-scrollbar max-h-[42vh] overflow-auto bg-muted/30 p-3">
              <div
                class="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-background"
              >
                <img
                  :src="fallbackPreviewUrl"
                  class="block max-h-[38vh] max-w-full object-contain"
                  alt=""
                />
                <canvas
                  class="pointer-events-none absolute inset-0 z-10 h-full w-full"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div
            v-if="layoutOverlayPages.length"
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
          >
            <div class="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div class="min-w-0">
                <p class="text-sm font-medium">识别区域</p>
                <p class="text-xs text-muted-foreground">
                  {{ layoutOverlayPages.reduce((sum, page) => sum + page.blocks.length, 0) }} 个区域
                </p>
              </div>
              <Badge variant="outline">{{ layoutOverlayPages.length }} 页</Badge>
            </div>
            <div class="visible-scrollbar min-h-0 flex-1 space-y-4 overflow-auto bg-muted/30 p-3">
              <div
                v-for="(overlayPage, pageIndex) in layoutOverlayPages"
                :key="`${overlayPage.imageUrl}-${pageIndex}`"
                class="space-y-2"
              >
                <div
                  class="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-background"
                >
                  <img
                    :src="overlayPage.imageUrl"
                    class="block max-h-[40vh] max-w-full object-contain"
                    alt=""
                    @load="drawOverlayCanvas(pageIndex)"
                  />
                  <canvas
                    :ref="
                      (element) => setOverlayCanvas(element as HTMLCanvasElement | null, pageIndex)
                    "
                    class="pointer-events-none absolute inset-0 z-10 h-full w-full"
                    aria-hidden="true"
                  />
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="(block, blockIndex) in overlayPage.blocks"
                    :key="`${blockIndex}-${block.label}-content`"
                    variant="secondary"
                    class="h-auto max-w-full whitespace-normal text-left"
                  >
                    {{ block.content || block.label || 'block' }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!fallbackPreviewUrl && !layoutOverlayPages.length"
            class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
          >
            普通视图会显示图片和识别区域
          </div>
        </template>

        <div
          v-else-if="activeOutputTab === 'markdown'"
          class="visible-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-auto"
        >
          <div
            class="markdown-preview min-h-48 rounded-md border px-4 py-3"
            v-html="
              renderedMarkdown ||
              '<p class=&quot;text-muted-foreground&quot;>Markdown 结果会显示在这里</p>'
            "
          />
          <Textarea
            :model-value="markdownOutput"
            class="visible-scrollbar min-h-40 resize-none overflow-auto font-mono text-sm leading-6"
            readonly
            spellcheck="false"
            placeholder="Markdown 源码会显示在这里"
          />
        </div>

        <Textarea
          v-else
          :model-value="activeTextOutput"
          class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
          readonly
          spellcheck="false"
          placeholder="纯文本结果会显示在这里"
        />
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

.markdown-preview {
  line-height: 1.7;
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
</style>
