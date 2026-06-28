<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Barcode,
  Check,
  ClipboardCopy,
  FileImage,
  LoaderCircle,
  ScanLine,
  Upload,
  X,
} from 'lucide-vue-next'

interface BarcodeResult {
  text: string
  format: string
  formatLabel: string
}

const FORMAT_LABELS: Record<string, string> = {
  AZTEC: 'Aztec Code',
  CODABAR: 'Codabar',
  CODE_39: 'Code 39',
  CODE_93: 'Code 93',
  CODE_128: 'Code 128',
  DATA_MATRIX: 'Data Matrix',
  EAN_8: 'EAN-8',
  EAN_13: 'EAN-13',
  ITF: 'ITF（交叉二五码）',
  MAXICODE: 'MaxiCode',
  MICRO_QR_CODE: 'Micro QR Code',
  PDF_417: 'PDF417',
  QR_CODE: 'QR Code',
  RSS_14: 'GS1 DataBar',
  RSS_EXPANDED: 'GS1 DataBar Expanded',
  UPC_A: 'UPC-A',
  UPC_E: 'UPC-E',
  UPC_EAN_EXTENSION: 'UPC/EAN 扩展码',
}

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const result = ref<BarcodeResult | null>(null)
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const copySuccess = ref(false)
let recognitionToken = 0
let copyTimer: ReturnType<typeof setTimeout> | undefined

const fileSize = computed(() => {
  if (!file.value) return ''
  const mb = file.value.size / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.ceil(file.value.size / 1024)} KB`
})

onMounted(() => {
  window.addEventListener('paste', handlePaste)
})

onBeforeUnmount(() => {
  recognitionToken++
  window.removeEventListener('paste', handlePaste)
  releasePreviewUrl()
  clearTimeout(copyTimer)
})

function releasePreviewUrl() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function selectFile(nextFile: File | null) {
  if (!nextFile) return

  if (!nextFile.type.startsWith('image/')) {
    error.value = '请选择图片文件。'
    return
  }

  recognitionToken++
  releasePreviewUrl()
  file.value = nextFile
  previewUrl.value = URL.createObjectURL(nextFile)
  result.value = null
  error.value = ''
  copySuccess.value = false
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
  const imageItem = Array.from(event.clipboardData?.items ?? []).find(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
  const pastedFile = imageItem?.getAsFile() ?? null
  if (!pastedFile) return

  event.preventDefault()
  void selectFile(pastedFile)
}

function clearFile() {
  recognitionToken++
  releasePreviewUrl()
  file.value = null
  result.value = null
  error.value = ''
  loading.value = false
  copySuccess.value = false
}

async function recognize() {
  if (!previewUrl.value) return

  const currentToken = ++recognitionToken
  loading.value = true
  result.value = null
  error.value = ''

  try {
    const [{ BarcodeFormat, BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints)
    const decoded = await reader.decodeFromImageUrl(previewUrl.value)

    if (currentToken !== recognitionToken) return

    const format = BarcodeFormat[decoded.getBarcodeFormat()]
    result.value = {
      text: decoded.getText(),
      format,
      formatLabel: FORMAT_LABELS[format] ?? format,
    }
  } catch {
    if (currentToken !== recognitionToken) return
    error.value = '未识别到条码。请使用清晰、完整且对焦准确的条码图片后重试。'
  } finally {
    if (currentToken === recognitionToken) {
      loading.value = false
    }
  }
}

async function copyContent() {
  if (!result.value) return

  try {
    await navigator.clipboard.writeText(result.value.text)
    copySuccess.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch {
    error.value = '复制失败，请手动选择识别内容。'
  }
}
</script>

<template>
  <section
    class="grid h-full min-h-0 gap-4 overflow-auto lg:grid-cols-[minmax(18rem,2fr)_minmax(0,3fr)] lg:gap-6 lg:overflow-hidden"
    :aria-busy="loading"
  >
    <section class="flex min-h-0 flex-col">
      <header class="shrink-0 space-y-2">
        <Badge variant="secondary">条码识别</Badge>
        <div>
          <h2 class="text-xl font-semibold tracking-tight">读取条码图片</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            图片仅在浏览器本地处理，不会上传到服务器。
          </p>
        </div>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 space-y-4 overflow-auto pt-6">
        <div
          class="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="dragging ? 'border-primary bg-muted/70' : 'hover:bg-muted/40'"
          role="button"
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
            accept="image/*"
            @change="handleFileInput"
          />
          <Upload class="mb-4 h-10 w-10 text-muted-foreground" />
          <p class="font-medium">粘贴、拖放或选择图片</p>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">支持二维码及常见一维、二维条码</p>
        </div>

        <div v-if="file" class="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{{ file.name }}</p>
            <p class="text-xs text-muted-foreground">{{ file.type }} · {{ fileSize }}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="移除图片"
            @click="clearFile"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <Button type="button" class="w-full" :disabled="!file || loading" @click="recognize">
          <LoaderCircle v-if="loading" class="h-4 w-4 animate-spin" />
          <ScanLine v-else class="h-4 w-4" />
          {{ loading ? '识别中' : '重新识别' }}
        </Button>

        <Alert v-if="error" variant="destructive">
          <AlertTitle>识别失败</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </div>
    </section>

    <section
      class="flex min-h-[30rem] flex-col border-t pt-4 lg:min-h-0 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0"
    >
      <header class="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">识别结果</h2>
          <p class="mt-1 text-sm text-muted-foreground">显示条码内容和编码格式</p>
        </div>
        <Button
          v-if="result"
          type="button"
          variant="outline"
          size="sm"
          :class="
            copySuccess &&
            'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'
          "
          @click="copyContent"
        >
          <Check v-if="copySuccess" class="h-4 w-4" />
          <ClipboardCopy v-else class="h-4 w-4" />
          {{ copySuccess ? '已复制' : '复制内容' }}
        </Button>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 overflow-auto pt-4">
        <div v-if="previewUrl" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)]">
          <Card class="gap-4 py-4">
            <CardHeader class="px-4">
              <CardTitle class="flex items-center gap-2 text-base">
                <FileImage class="h-4 w-4" />
                图片预览
              </CardTitle>
            </CardHeader>
            <CardContent class="px-4">
              <div
                class="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted/40 p-3"
              >
                <img
                  :src="previewUrl"
                  class="max-h-[55dvh] max-w-full rounded-md object-contain"
                  alt="待识别的条码图片"
                />
              </div>
            </CardContent>
          </Card>

          <Card v-if="result" class="gap-4 py-4">
            <CardHeader class="px-4">
              <div class="flex items-center justify-between gap-3">
                <CardTitle class="flex items-center gap-2 text-base">
                  <Barcode class="h-4 w-4" />
                  条码信息
                </CardTitle>
                <Badge>{{ result.formatLabel }}</Badge>
              </div>
            </CardHeader>
            <CardContent class="space-y-4 px-4">
              <div>
                <p class="mb-2 text-xs font-medium text-muted-foreground">内容</p>
                <Textarea
                  :model-value="result.text"
                  class="visible-scrollbar min-h-32 resize-none overflow-auto font-mono"
                  readonly
                  spellcheck="false"
                />
              </div>
              <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <span class="text-muted-foreground">编码格式</span>
                <span class="font-medium">{{ result.formatLabel }}</span>
                <span class="text-muted-foreground">原始格式名</span>
                <code class="break-all">{{ result.format }}</code>
                <span class="text-muted-foreground">字符数</span>
                <span>{{ Array.from(result.text).length }}</span>
              </div>
            </CardContent>
          </Card>

          <div
            v-else
            class="flex min-h-64 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            <span v-if="loading">正在分析图片中的条码…</span>
            <span v-else>识别结果会显示在这里</span>
          </div>
        </div>

        <div
          v-else
          class="flex h-full min-h-80 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground"
        >
          <ScanLine class="mb-4 h-10 w-10" />
          <p class="font-medium text-foreground">等待条码图片</p>
          <p class="mt-2 text-sm">选择、拖放或粘贴图片后自动识别</p>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.visible-scrollbar {
  scrollbar-width: thin;
}
</style>
