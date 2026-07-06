<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { IScannerControls } from '@zxing/browser'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Barcode,
  Camera,
  CameraOff,
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
  points: Point[]
}

interface Point {
  x: number
  y: number
}

interface ScanRegion {
  x: number
  y: number
  width: number
  height: number
}

type InputMode = 'image' | 'camera'

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
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const previewUrl = ref('')
const results = ref<BarcodeResult[]>([])
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const copySuccess = ref(false)
const inputMode = ref<InputMode>('image')
const cameraStarting = ref(false)
const cameraActive = ref(false)
const cameraDetected = ref(false)
let recognitionToken = 0
let cameraSession = 0
let scannerControls: IScannerControls | undefined
let copyTimer: ReturnType<typeof setTimeout> | undefined
let detectionTimer: ReturnType<typeof setTimeout> | undefined

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
  stopCamera()
  window.removeEventListener('paste', handlePaste)
  releasePreviewUrl()
  clearTimeout(copyTimer)
  clearTimeout(detectionTimer)
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

  if (inputMode.value === 'camera') {
    stopCamera()
    inputMode.value = 'image'
  }
  recognitionToken++
  releasePreviewUrl()
  file.value = nextFile
  previewUrl.value = URL.createObjectURL(nextFile)
  results.value = []
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
  if (inputMode.value !== 'image') return

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
  results.value = []
  error.value = ''
  loading.value = false
  copySuccess.value = false
}

function switchInputMode(nextMode: InputMode) {
  if (inputMode.value === nextMode) return

  recognitionToken++
  loading.value = false
  results.value = []
  error.value = ''
  copySuccess.value = false
  inputMode.value = nextMode

  if (nextMode === 'camera') {
    void startCamera()
    return
  }

  stopCamera()
  if (previewUrl.value) {
    void recognize()
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '当前浏览器不支持摄像头访问，请使用较新版本的浏览器并通过 HTTPS 访问。'
    return
  }

  stopCamera()
  const currentSession = ++cameraSession
  cameraStarting.value = true
  results.value = []
  error.value = ''

  try {
    await nextTick()
    const video = cameraVideo.value
    if (!video) throw new Error('Camera preview is unavailable')

    const [{ BarcodeFormat, BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    if (currentSession !== cameraSession) return

    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 500,
    })
    const controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video,
      (decoded) => {
        if (!decoded || currentSession !== cameraSession) return

        const format = BarcodeFormat[decoded.getBarcodeFormat()]
        const nextResult: BarcodeResult = {
          text: decoded.getText(),
          format,
          formatLabel: FORMAT_LABELS[format] ?? format,
          points: [],
        }
        const alreadyFound = results.value.some(
          (item) => item.text === nextResult.text && item.format === nextResult.format,
        )
        if (!alreadyFound) {
          results.value.push(nextResult)
        }

        cameraDetected.value = true
        clearTimeout(detectionTimer)
        detectionTimer = setTimeout(() => {
          cameraDetected.value = false
        }, 800)
      },
    )

    if (currentSession !== cameraSession) {
      controls.stop()
      return
    }
    scannerControls = controls
    cameraActive.value = true
  } catch (reason) {
    if (currentSession !== cameraSession) return
    error.value = getCameraErrorMessage(reason)
    stopCamera()
  } finally {
    if (currentSession === cameraSession) {
      cameraStarting.value = false
    }
  }
}

function stopCamera() {
  cameraSession++
  scannerControls?.stop()
  scannerControls = undefined

  const video = cameraVideo.value
  const stream = video?.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  if (video) video.srcObject = null

  cameraStarting.value = false
  cameraActive.value = false
  cameraDetected.value = false
  clearTimeout(detectionTimer)
}

function getCameraErrorMessage(reason: unknown) {
  if (reason instanceof DOMException) {
    if (reason.name === 'NotAllowedError' || reason.name === 'SecurityError') {
      return '摄像头权限被拒绝。请在浏览器设置中允许此网站使用摄像头后重试。'
    }
    if (reason.name === 'NotFoundError' || reason.name === 'OverconstrainedError') {
      return '未找到可用的摄像头。请检查设备连接后重试。'
    }
    if (reason.name === 'NotReadableError' || reason.name === 'AbortError') {
      return '摄像头暂时无法使用，可能正被其他应用占用。'
    }
  }
  return '无法启动摄像头。请确认当前页面通过 HTTPS 访问，并检查浏览器权限设置。'
}

async function recognize() {
  if (!previewUrl.value) return

  const currentToken = ++recognitionToken
  loading.value = true
  results.value = []
  error.value = ''

  try {
    const [{ BarcodeFormat, BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    const image = await loadImage(previewUrl.value)
    if (currentToken !== recognitionToken) return

    drawPreview(image, [])

    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints)
    const found: BarcodeResult[] = []

    for (const region of createScanRegions(image.naturalWidth, image.naturalHeight)) {
      const scanCanvas = document.createElement('canvas')
      scanCanvas.width = region.width
      scanCanvas.height = region.height
      const context = scanCanvas.getContext('2d', { willReadFrequently: true })
      if (!context) continue

      context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height,
      )

      // ZXing 每次只返回一个结果。识别后遮盖该区域并继续扫描，
      // 再结合重叠分块，避免同一张图片中其余条码被忽略。
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const decoded = reader.decodeFromCanvas(scanCanvas)
          const points = decoded.getResultPoints().map((point) => ({
            x: point.getX() + region.x,
            y: point.getY() + region.y,
          }))
          const format = BarcodeFormat[decoded.getBarcodeFormat()]
          const nextResult = {
            text: decoded.getText(),
            format,
            formatLabel: FORMAT_LABELS[format] ?? format,
            points,
          }

          if (!isDuplicateResult(found, nextResult)) {
            found.push(nextResult)
          }
          maskResult(context, decoded.getResultPoints(), region.width, region.height)
        } catch {
          break
        }
      }
    }

    if (currentToken !== recognitionToken) return

    if (!found.length) {
      throw new Error('No barcode found')
    }
    results.value = found
    drawPreview(image, found)
  } catch {
    if (currentToken !== recognitionToken) return
    error.value = '未识别到条码。请使用清晰、完整且对焦准确的条码图片后重试。'
  } finally {
    if (currentToken === recognitionToken) {
      loading.value = false
    }
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

function createScanRegions(width: number, height: number): ScanRegion[] {
  const regions: ScanRegion[] = [{ x: 0, y: 0, width, height }]
  const overlap = 0.12

  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 2; column++) {
      const x = Math.round(column * width * (0.5 - overlap))
      const y = Math.round(row * height * (0.5 - overlap))
      regions.push({
        x,
        y,
        width: Math.min(width - x, Math.round(width * (0.5 + overlap))),
        height: Math.min(height - y, Math.round(height * (0.5 + overlap))),
      })
    }
  }

  return regions
}

function getResultCenter(result: BarcodeResult): Point {
  if (!result.points.length) return { x: 0, y: 0 }
  return {
    x: result.points.reduce((sum, point) => sum + point.x, 0) / result.points.length,
    y: result.points.reduce((sum, point) => sum + point.y, 0) / result.points.length,
  }
}

function isDuplicateResult(existing: BarcodeResult[], candidate: BarcodeResult) {
  const center = getResultCenter(candidate)
  return existing.some((item) => {
    if (item.text !== candidate.text || item.format !== candidate.format) return false
    const itemCenter = getResultCenter(item)
    const itemSize = getPointBounds(item.points)
    const candidateSize = getPointBounds(candidate.points)

    if (item.points.length <= 2 || candidate.points.length <= 2) {
      const barcodeWidth = Math.max(itemSize.width, candidateSize.width)
      return (
        Math.abs(center.x - itemCenter.x) < Math.max(24, barcodeWidth * 0.25) &&
        Math.abs(center.y - itemCenter.y) < Math.max(24, barcodeWidth * 0.3)
      )
    }

    const tolerance = Math.max(
      24,
      Math.min(itemSize.width, itemSize.height, candidateSize.width, candidateSize.height) * 0.5,
    )
    return Math.hypot(center.x - itemCenter.x, center.y - itemCenter.y) < tolerance
  })
}

function getPointBounds(points: Point[]) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function maskResult(
  context: CanvasRenderingContext2D,
  points: { getX(): number; getY(): number }[],
  canvasWidth: number,
  canvasHeight: number,
) {
  if (!points.length) {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvasWidth, canvasHeight)
    return
  }

  const bounds = getPointBounds(points.map((point) => ({ x: point.getX(), y: point.getY() })))
  const paddingX = Math.max(16, bounds.width * 0.18)
  const paddingY = Math.max(
    24,
    bounds.height * 0.25,
    bounds.width * (points.length <= 2 ? 0.18 : 0.05),
  )
  context.fillStyle = '#fff'
  context.fillRect(
    Math.max(0, bounds.x - paddingX),
    Math.max(0, bounds.y - paddingY),
    Math.min(canvasWidth, bounds.width + paddingX * 2),
    Math.min(canvasHeight, bounds.height + paddingY * 2),
  )
}

function drawPreview(image: HTMLImageElement, barcodes: BarcodeResult[]) {
  const canvas = previewCanvas.value
  if (!canvas) return
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return

  context.drawImage(image, 0, 0)
  const lineWidth = Math.max(3, Math.min(canvas.width, canvas.height) / 250)
  context.lineWidth = lineWidth
  context.font = `600 ${Math.max(18, lineWidth * 5)}px sans-serif`
  context.textBaseline = 'middle'

  barcodes.forEach((barcode, index) => {
    if (!barcode.points.length) return
    const bounds = getPointBounds(barcode.points)
    const paddingX = Math.max(8, bounds.width * 0.06)
    const paddingY = Math.max(
      12,
      bounds.height * 0.08,
      bounds.width * (barcode.points.length <= 2 ? 0.12 : 0.03),
    )
    const x = Math.max(lineWidth, bounds.x - paddingX)
    const y = Math.max(lineWidth, bounds.y - paddingY)
    const width = Math.min(canvas.width - x - lineWidth, bounds.width + paddingX * 2)
    const height = Math.min(canvas.height - y - lineWidth, bounds.height + paddingY * 2)

    context.strokeStyle = '#16a34a'
    context.fillStyle = 'rgba(22, 163, 74, 0.12)'
    context.fillRect(x, y, width, height)
    context.strokeRect(x, y, width, height)

    const label = `${index + 1}`
    const labelSize = Math.max(24, lineWidth * 7)
    context.fillStyle = '#16a34a'
    context.fillRect(x, y, labelSize, labelSize)
    context.fillStyle = '#fff'
    context.fillText(label, x + labelSize * 0.3, y + labelSize * 0.52)
  })
}

async function copyContent() {
  if (!results.value.length) return

  try {
    await navigator.clipboard.writeText(results.value.map((item) => item.text).join('\n'))
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
    :aria-busy="loading || cameraStarting"
  >
    <section class="flex min-h-0 flex-col">
      <header class="shrink-0 space-y-2">
        <Badge variant="secondary">条码识别</Badge>
        <div>
          <h2 class="text-xl font-semibold tracking-tight">
            {{ inputMode === 'image' ? '读取条码图片' : '摄像头实时识别' }}
          </h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            图片和摄像头画面仅在浏览器本地处理，不会上传到服务器。
          </p>
        </div>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 space-y-4 overflow-auto pt-6">
        <div class="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <Button
            type="button"
            :variant="inputMode === 'image' ? 'secondary' : 'ghost'"
            size="sm"
            @click="switchInputMode('image')"
          >
            <FileImage class="h-4 w-4" />
            图片识别
          </Button>
          <Button
            type="button"
            :variant="inputMode === 'camera' ? 'secondary' : 'ghost'"
            size="sm"
            @click="switchInputMode('camera')"
          >
            <Camera class="h-4 w-4" />
            摄像头
          </Button>
        </div>

        <template v-if="inputMode === 'image'">
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
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              支持二维码及常见一维、二维条码
            </p>
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
        </template>

        <template v-else>
          <div
            class="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center"
          >
            <Camera class="mb-4 h-10 w-10 text-muted-foreground" />
            <p class="font-medium">
              {{
                cameraStarting
                  ? '正在请求摄像头权限'
                  : cameraActive
                    ? '摄像头正在实时识别'
                    : '摄像头已停止'
              }}
            </p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              将条码置于取景框中央，并保持画面稳定、光线充足
            </p>
          </div>

          <Button
            v-if="cameraActive"
            type="button"
            variant="outline"
            class="w-full"
            @click="stopCamera"
          >
            <CameraOff class="h-4 w-4" />
            停止摄像头
          </Button>
          <Button
            v-else
            type="button"
            class="w-full"
            :disabled="cameraStarting"
            @click="startCamera"
          >
            <LoaderCircle v-if="cameraStarting" class="h-4 w-4 animate-spin" />
            <Camera v-else class="h-4 w-4" />
            {{ cameraStarting ? '正在启动' : '启动摄像头' }}
          </Button>
        </template>

        <Alert v-if="error" variant="destructive">
          <AlertTitle>{{ inputMode === 'camera' ? '无法使用摄像头' : '识别失败' }}</AlertTitle>
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
          <p class="mt-1 text-sm text-muted-foreground">
            <template v-if="results.length">共识别到 {{ results.length }} 个条码</template>
            <template v-else>显示条码位置、内容和编码格式</template>
          </p>
        </div>
        <Button
          v-if="results.length"
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
        <div
          v-if="inputMode === 'camera' || previewUrl"
          class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)]"
        >
          <Card v-if="inputMode === 'camera'" class="gap-4 py-4">
            <CardHeader class="px-4">
              <CardTitle class="flex items-center gap-2 text-base">
                <Camera class="h-4 w-4" />
                摄像头预览
              </CardTitle>
            </CardHeader>
            <CardContent class="px-4">
              <div
                class="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-black"
              >
                <video
                  ref="cameraVideo"
                  class="max-h-[55dvh] w-full object-contain"
                  autoplay
                  muted
                  playsinline
                  aria-label="条码实时识别摄像头画面"
                />
                <div
                  v-if="cameraActive"
                  class="pointer-events-none absolute inset-[15%] rounded-lg border-2 transition-colors"
                  :class="
                    cameraDetected
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/80 bg-transparent'
                  "
                  aria-hidden="true"
                >
                  <span class="absolute top-1/2 left-1/2 h-px w-3/4 -translate-x-1/2 bg-white/80" />
                </div>
                <div
                  v-if="!cameraActive && !cameraStarting"
                  class="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-sm text-white"
                >
                  <CameraOff class="mb-3 h-8 w-8" />
                  摄像头未启动
                </div>
                <div
                  v-else-if="cameraStarting"
                  class="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-sm text-white"
                >
                  <LoaderCircle class="mb-3 h-8 w-8 animate-spin" />
                  正在启动摄像头
                </div>
                <Badge
                  v-if="cameraActive"
                  class="absolute top-3 left-3"
                  :variant="cameraDetected ? 'default' : 'secondary'"
                >
                  {{ cameraDetected ? '已识别' : '实时扫描中' }}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card v-else class="gap-4 py-4">
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
                <canvas
                  ref="previewCanvas"
                  class="max-h-[55dvh] max-w-full rounded-md object-contain"
                  role="img"
                  :aria-label="
                    results.length
                      ? `条码图片，已标记 ${results.length} 个条码位置`
                      : '待识别的条码图片'
                  "
                />
              </div>
            </CardContent>
          </Card>

          <Card v-if="results.length" class="gap-4 py-4">
            <CardHeader class="px-4">
              <div class="flex items-center justify-between gap-3">
                <CardTitle class="flex items-center gap-2 text-base">
                  <Barcode class="h-4 w-4" />
                  条码信息（{{ results.length }}）
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent class="space-y-3 px-4">
              <div
                v-for="(result, index) in results"
                :key="`${result.format}-${result.text}-${index}`"
                class="space-y-3 rounded-lg border p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-green-600 text-xs font-semibold text-white"
                  >
                    {{ index + 1 }}
                  </span>
                  <Badge variant="secondary">{{ result.formatLabel }}</Badge>
                </div>
                <Textarea
                  :model-value="result.text"
                  class="visible-scrollbar min-h-20 resize-none overflow-auto font-mono"
                  readonly
                  spellcheck="false"
                />
                <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  <span class="text-muted-foreground">原始格式名</span>
                  <code class="break-all">{{ result.format }}</code>
                  <span class="text-muted-foreground">字符数</span>
                  <span>{{ Array.from(result.text).length }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div
            v-else
            class="flex min-h-64 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            <span v-if="inputMode === 'camera' && cameraActive">
              将条码对准取景框，识别结果会自动显示
            </span>
            <span v-else-if="inputMode === 'camera'">启动摄像头后开始实时识别</span>
            <span v-else-if="loading">正在分析图片中的条码…</span>
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
