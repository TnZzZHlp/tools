<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { IScannerControls } from '@zxing/browser'
import {
  Camera,
  CameraOff,
  Check,
  ClipboardCopy,
  FileImage,
  LoaderCircle,
  QrCode,
  ScanLine,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
const copySuccessIndex = ref<number | null>(null)
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

const modeModel = computed({
  get: () => inputMode.value,
  set: (val: string | number | undefined) => {
    if (val !== undefined) switchInputMode(val)
  },
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
  copySuccessIndex.value = null
  await nextTick()
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
  copySuccessIndex.value = null
}

function switchInputMode(nextMode: string | number) {
  const mode = nextMode === 'camera' ? 'camera' : 'image'
  if (inputMode.value === mode) return

  recognitionToken++
  loading.value = false
  results.value = []
  error.value = ''
  copySuccessIndex.value = null
  inputMode.value = mode

  if (mode === 'camera') {
    void startCamera()
    return
  }

  stopCamera()
  if (previewUrl.value) {
    void nextTick(() => recognize())
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
          results.value.unshift(nextResult)
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

    context.strokeStyle = '#2F6FE4'
    context.fillStyle = 'rgba(47, 111, 228, 0.14)'
    context.fillRect(x, y, width, height)
    context.strokeRect(x, y, width, height)

    const label = `${index + 1}`
    const labelSize = Math.max(24, lineWidth * 7)
    context.fillStyle = '#2F6FE4'
    context.fillRect(x, y, labelSize, labelSize)
    context.fillStyle = '#fff'
    context.fillText(label, x + labelSize * 0.3, y + labelSize * 0.52)
  })
}

async function copySingle(text: string, index: number) {
  try {
    await navigator.clipboard.writeText(text)
    copySuccessIndex.value = index
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccessIndex.value = null
    }, 1800)
  } catch {
    error.value = '复制失败，请手动选择识别内容。'
  }
}

async function copyAll() {
  if (!results.value.length) return
  try {
    await navigator.clipboard.writeText(results.value.map((item) => item.text).join('\n'))
    copySuccessIndex.value = -1
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccessIndex.value = null
    }, 1800)
  } catch {
    error.value = '复制失败，请手动选择识别内容。'
  }
}
</script>

<template>
  <div class="flex flex-col pb-8" :aria-busy="loading || cameraStarting">
    <ToolPageHeader
      title="二维码 / 条码识别"
      description="粘贴或上传图片识别同一画面中的多个条码，或开启摄像头实时扫码；全程本地解析。"
      badge="本地离线"
      :icon="QrCode"
    >
      <template #actions>
        <Tabs v-model="modeModel">
          <TabsList>
            <TabsTrigger value="image">
              <FileImage class="size-3.5" />
              图片识别
            </TabsTrigger>
            <TabsTrigger value="camera">
              <Camera class="size-3.5" />
              摄像头扫码
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ToolPageHeader>

    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <!-- Left Card: Viewfinder / Image Canvas -->
      <Card>
        <CardHeader class="px-5 pt-5 pb-3">
          <template #title>
            {{ inputMode === 'image' ? '条码图片画面' : '实时摄像头取景' }}
          </template>
          <template #action>
            <Badge
              v-if="inputMode === 'camera' && cameraActive"
              :variant="cameraDetected ? 'accent' : 'neutral'"
            >
              {{ cameraDetected ? '已捕获条码' : '实时扫描中' }}
            </Badge>
          </template>
        </CardHeader>

        <CardContent class="space-y-4 px-5 pt-2 pb-5">
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept="image/*"
            @change="handleFileInput"
          />

          <template v-if="inputMode === 'image'">
            <!-- Canvas Preview when Image Selected -->
            <div v-if="previewUrl" class="space-y-3">
              <div
                class="relative flex min-h-64 items-center justify-center overflow-hidden rounded-panel border border-line bg-surface p-3"
              >
                <canvas
                  ref="previewCanvas"
                  class="max-h-[54dvh] max-w-full rounded-[8px] object-contain"
                  role="img"
                  :aria-label="
                    results.length
                      ? `条码图片，已标记 ${results.length} 个条码位置`
                      : '待识别的条码图片'
                  "
                />
                <div
                  v-if="loading"
                  class="absolute inset-0 flex items-center justify-center gap-2 bg-[color-mix(in_oklab,var(--color-surface)_75%,transparent)] text-[14px] font-medium text-ink backdrop-blur-[2px]"
                >
                  <LoaderCircle class="size-5 animate-spin text-accent" />
                  正在识别条码…
                </div>
              </div>

              <div
                v-if="file"
                class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2"
              >
                <div class="min-w-0">
                  <p class="truncate text-[14px] font-medium text-ink">{{ file.name }}</p>
                  <p class="text-[12px] text-ink-muted">{{ file.type }} · {{ fileSize }}</p>
                </div>
                <div class="flex items-center gap-1.5">
                  <Button type="button" variant="secondary" size="sm" @click="fileInput?.click()">
                    <Upload class="size-3.5" />
                    更换图片
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="w-8 px-0 text-ink-muted hover:text-danger"
                    aria-label="移除图片"
                    @click="clearFile"
                  >
                    <X class="size-4" />
                  </Button>
                </div>
              </div>

              <Button type="button" class="w-full" :loading="loading" @click="recognize">
                <LoaderCircle v-if="loading" class="size-4 animate-spin" />
                <ScanLine v-else class="size-4" />
                {{ loading ? '识别中…' : '重新扫描图片' }}
              </Button>
            </div>

            <!-- Upload Dropzone when Empty -->
            <div
              v-else
              role="button"
              tabindex="0"
              class="group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed p-6 text-center outline-none transition-[border-color,background-color] duration-[var(--p0seid0n-duration-normal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
              :class="
                dragging
                  ? 'border-ink bg-control'
                  : 'border-line hover:border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-line))] hover:bg-surface'
              "
              @click="fileInput?.click()"
              @keydown.enter.prevent="fileInput?.click()"
              @keydown.space.prevent="fileInput?.click()"
              @dragenter.prevent="dragging = true"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="handleDrop"
            >
              <div
                class="mb-3 flex size-12 items-center justify-center rounded-full border border-line bg-control text-ink-muted transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface"
              >
                <Upload class="size-5" />
              </div>
              <p class="text-[15px] font-medium text-ink">粘贴截图、拖放或点击选择图片</p>
              <p class="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-muted">
                支持 QR Code、Code 128、EAN-13、Data Matrix 等常见一维与二维条码
              </p>
            </div>
          </template>

          <!-- Live Camera Viewfinder -->
          <template v-else>
            <div class="relative aspect-[4/3] overflow-hidden rounded-panel bg-[#121419]">
              <video
                ref="cameraVideo"
                class="h-full w-full object-cover"
                autoplay
                muted
                playsinline
                aria-label="条码实时识别摄像头画面"
              />

              <div
                v-if="cameraActive"
                class="pointer-events-none absolute inset-[15%] rounded-panel border-2 transition-colors"
                :class="
                  cameraDetected
                    ? 'border-accent bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)]'
                    : 'border-white/80 bg-transparent'
                "
                aria-hidden="true"
              >
                <span class="absolute top-1/2 left-1/2 h-px w-3/4 -translate-x-1/2 bg-accent" />
              </div>

              <div
                v-if="!cameraActive && !cameraStarting"
                class="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-6 text-center text-[14px] text-white/85"
              >
                <CameraOff class="mb-2.5 size-8 opacity-80" />
                <p>摄像头已停止，点击下方按钮启动扫码</p>
              </div>

              <div
                v-else-if="cameraStarting"
                class="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-6 text-center text-[14px] text-white"
              >
                <LoaderCircle class="mb-2.5 size-8 animate-spin" />
                <p>正在请求摄像头权限…</p>
              </div>
            </div>

            <Button
              v-if="cameraActive"
              type="button"
              variant="secondary"
              class="w-full"
              @click="stopCamera"
            >
              <CameraOff class="size-4" />
              停止摄像头
            </Button>
            <Button
              v-else
              type="button"
              class="w-full"
              :loading="cameraStarting"
              @click="startCamera"
            >
              <LoaderCircle v-if="cameraStarting" class="size-4 animate-spin" />
              <Camera v-else class="size-4" />
              {{ cameraStarting ? '正在启动…' : '启动摄像头扫码' }}
            </Button>
          </template>

          <Alert v-if="error" variant="danger" class="bg-surface">
            <AlertTitle>{{ inputMode === 'camera' ? '无法使用摄像头' : '识别未成功' }}</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <!-- Right Card: Decoded Results -->
      <Card class="min-w-0">
        <CardHeader class="px-5 pt-5 pb-3">
          <template #title>
            <span class="inline-flex items-center gap-2">
              <span>识别结果</span>
              <Badge variant="neutral" class="tabular-nums">{{ results.length }} 条</Badge>
            </span>
          </template>
          <template #action>
            <div v-if="results.length" class="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                :class="copySuccessIndex === -1 && 'text-accent'"
                @click="copyAll"
              >
                <Check v-if="copySuccessIndex === -1" class="size-3.5" />
                <ClipboardCopy v-else class="size-3.5" />
                {{ copySuccessIndex === -1 ? '已复制全部' : '复制全部' }}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="text-ink-muted hover:text-danger"
                @click="results = []"
              >
                <Trash2 class="size-3.5" />
                清空
              </Button>
            </div>
          </template>
        </CardHeader>

        <CardContent class="px-5 pt-2 pb-5">
          <ul v-if="results.length" class="space-y-2.5">
            <li
              v-for="(item, index) in results"
              :key="`${item.format}-${item.text}-${index}`"
              class="rounded-control border border-line bg-surface p-3.5 transition-colors hover:bg-control"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Badge variant="neutral" class="font-mono tabular-nums">#{{ index + 1 }}</Badge>
                  <Badge variant="outline">{{ item.formatLabel }}</Badge>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 px-2 text-[12px]"
                  :class="copySuccessIndex === index && 'text-accent'"
                  @click="copySingle(item.text, index)"
                >
                  <Check v-if="copySuccessIndex === index" class="size-3.5" />
                  <ClipboardCopy v-else class="size-3.5" />
                  {{ copySuccessIndex === index ? '已复制' : '复制' }}
                </Button>
              </div>

              <p class="break-all font-mono text-[14px] leading-relaxed text-ink">
                {{ item.text }}
              </p>
            </li>
          </ul>

          <div
            v-else
            class="flex min-h-72 flex-col items-center justify-center rounded-panel border border-dashed border-line p-6 text-center text-ink-muted"
          >
            <ScanLine class="mb-3 size-8 text-ink-faint" aria-hidden="true" />
            <p class="text-[14px] font-medium text-ink">等待识别结果</p>
            <p class="mt-1 max-w-xs text-[12px] leading-relaxed">
              {{
                inputMode === 'camera'
                  ? '将条码或二维码对准左侧取景框中央，识别结果会自动追加到此处。'
                  : '上传或粘贴条码图片后，将在此展示编码格式与完整内容。'
              }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
