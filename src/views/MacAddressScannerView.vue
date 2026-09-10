<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createWorker, PSM, type Worker } from 'tesseract.js'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Camera,
  CameraOff,
  Check,
  ClipboardCopy,
  Download,
  FileImage,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Trash2,
  Upload,
} from 'lucide-vue-next'

import { buildMacAddress, extractMacSuffix, normalizeMacPrefix } from '@/utils/macAddress'

type InputMode = 'camera' | 'image'

const STORAGE_PREFIX = 'mac-scanner-prefix'
const STORAGE_RESULTS = 'mac-scanner-results'
const OCR_WHITELIST = '0123456789ABCDEFabcdef-: '
const OCR_INTERVAL = 650
const STABLE_READS_REQUIRED = 2

const inputMode = ref<InputMode>('camera')
const prefix = ref(localStorage.getItem(STORAGE_PREFIX) ?? '')
const results = ref<string[]>(loadResults())
const error = ref('')
const info = ref('准备开始')
const currentRead = ref('')
const stableCount = ref(0)
const cameraStarting = ref(false)
const cameraActive = ref(false)
const loadingImage = ref(false)
const workerReady = ref(false)
const copySuccess = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const cameraCanvas = ref<HTMLCanvasElement | null>(null)
const uploadedImage = ref<HTMLImageElement | null>(null)
const previewUrl = ref('')

let stream: MediaStream | null = null
let worker: Worker | null = null
let scanTimer: ReturnType<typeof setTimeout> | undefined
let copyTimer: ReturnType<typeof setTimeout> | undefined
let scanInProgress = false
let cameraSession = 0

const fullResults = computed(() => results.value.map((suffix) => buildMacAddress(prefix.value, suffix)))
const latestResult = computed(() => fullResults.value[0] ?? '')
const canExport = computed(() => fullResults.value.length > 0)
const displayPrefix = computed(() => normalizeMacPrefix(prefix.value) || '未设置')
const progressLabel = computed(() => `${stableCount.value}/${STABLE_READS_REQUIRED}`)

watch(prefix, (value) => {
  prefix.value = normalizeMacPrefix(value)
  localStorage.setItem(STORAGE_PREFIX, prefix.value)
})

watch(
  results,
  (value) => localStorage.setItem(STORAGE_RESULTS, JSON.stringify(value)),
  { deep: true },
)

onMounted(() => {
  if (inputMode.value === 'camera') void startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  void disposeWorker()
  releasePreviewUrl()
  clearTimeout(copyTimer)
  clearTimeout(scanTimer)
})

function loadResults(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_RESULTS) ?? '[]')
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function releasePreviewUrl() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function getWorker() {
  if (worker) return worker

  info.value = '首次使用正在加载本地 OCR 模型…'
  worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        info.value = `正在识别 ${(message.progress * 100).toFixed(0)}%`
      }
    },
  })
  await worker.setParameters({
    tessedit_char_whitelist: OCR_WHITELIST,
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
  })
  workerReady.value = true
  return worker
}

async function disposeWorker() {
  if (!worker) return
  const currentWorker = worker
  worker = null
  workerReady.value = false
  await currentWorker.terminate()
}

async function startCamera() {
  if (cameraActive.value || cameraStarting.value) return
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '当前浏览器不支持摄像头，请改用图片上传。'
    return
  }

  cameraStarting.value = true
  error.value = ''
  const session = ++cameraSession

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    if (session !== cameraSession || !video.value) return

    video.value.srcObject = stream
    await video.value.play()
    cameraActive.value = true
    info.value = '将屏幕上的 MAC 对准取景框，保持稳定即可自动录入。'
    scheduleScan(session)
  } catch (cause) {
    error.value = cause instanceof DOMException && cause.name === 'NotAllowedError'
      ? '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头。'
      : '无法启动摄像头，请检查设备权限或改用图片上传。'
  } finally {
    cameraStarting.value = false
  }
}

function stopCamera() {
  cameraSession++
  cameraActive.value = false
  cameraStarting.value = false
  clearTimeout(scanTimer)
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  resetStability()
}

function scheduleScan(session: number) {
  clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    void scanCameraFrame(session)
  }, OCR_INTERVAL)
}

async function scanCameraFrame(session: number) {
  if (!cameraActive.value || session !== cameraSession || scanInProgress) return
  if (!video.value?.videoWidth || !cameraCanvas.value) {
    scheduleScan(session)
    return
  }

  scanInProgress = true
  try {
    drawCameraRegion(video.value, cameraCanvas.value)
    await recognizeCanvas(cameraCanvas.value)
  } finally {
    scanInProgress = false
    if (cameraActive.value && session === cameraSession) scheduleScan(session)
  }
}

function drawCameraRegion(source: HTMLVideoElement, target: HTMLCanvasElement) {
  const sourceWidth = source.videoWidth
  const sourceHeight = source.videoHeight
  const containerRatio = 4 / 3
  const sourceRatio = sourceWidth / sourceHeight
  const visibleWidth = sourceRatio > containerRatio ? sourceHeight * containerRatio : sourceWidth
  const visibleHeight = sourceRatio < containerRatio ? sourceWidth / containerRatio : sourceHeight
  const visibleX = (sourceWidth - visibleWidth) / 2
  const visibleY = (sourceHeight - visibleHeight) / 2
  const crop = {
    x: visibleX + visibleWidth * 0.15,
    y: visibleY + visibleHeight * 0.34,
    width: visibleWidth * 0.7,
    height: visibleHeight * 0.32,
  }

  target.width = Math.max(640, Math.round(crop.width))
  target.height = Math.max(180, Math.round(crop.height))
  const context = target.getContext('2d')
  if (!context) return
  context.filter = 'grayscale(1) contrast(1.65) brightness(1.1)'
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height)
  context.filter = 'none'
}

async function recognizeCanvas(canvas: HTMLCanvasElement) {
  try {
    const result = await (await getWorker()).recognize(canvas)
    const suffix = extractMacSuffix(result.data.text)
    if (suffix) handleRecognizedSuffix(suffix)
    else if (cameraActive.value) {
      currentRead.value = ''
      info.value = '未识别到完整的 4 段 MAC，请调整距离、角度或光线。'
    }
  } catch {
    error.value = 'OCR 识别失败，请重试或改用更清晰的图片。'
  }
}

function handleRecognizedSuffix(suffix: string) {
  const previousRead = currentRead.value
  currentRead.value = suffix
  stableCount.value = previousRead === suffix ? stableCount.value + 1 : 1
  info.value = `识别到 ${suffix}，保持稳定 ${Math.min(stableCount.value, STABLE_READS_REQUIRED)}/${STABLE_READS_REQUIRED}`

  if (stableCount.value < STABLE_READS_REQUIRED) return
  addResult(suffix)
  stableCount.value = 0
}

function resetStability() {
  currentRead.value = ''
  stableCount.value = 0
}

function addResult(suffix: string) {
  if (results.value.includes(suffix)) {
    info.value = `${buildMacAddress(prefix.value, suffix)} 已存在，未重复添加。`
    return
  }

  results.value.unshift(suffix)
  info.value = `已录入 ${buildMacAddress(prefix.value, suffix)}`
  if ('vibrate' in navigator) navigator.vibrate(80)
}

function switchMode(mode: InputMode) {
  if (inputMode.value === mode) return
  if (mode === 'camera') {
    inputMode.value = mode
    void nextTick(startCamera)
  } else {
    stopCamera()
    inputMode.value = mode
  }
  error.value = ''
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void recognizeImage(file)
}

async function recognizeImage(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件。'
    return
  }
  loadingImage.value = true
  error.value = ''
  releasePreviewUrl()
  previewUrl.value = URL.createObjectURL(file)
  resetStability()
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        uploadedImage.value = image
        resolve()
      }
      image.onerror = () => reject(new Error('image-load'))
      image.src = previewUrl.value
    })

    await nextTick()
    if (!uploadedImage.value || !cameraCanvas.value) throw new Error('image-not-ready')
    const imageWorker = await getWorker()
    drawImageRegion(uploadedImage.value, cameraCanvas.value)
    let result = await imageWorker.recognize(cameraCanvas.value)
    let suffix = extractMacSuffix(result.data.text)

    // A full photo may place the display outside the guide rectangle. Use the
    // focused crop first, then fall back to the complete image for uploads.
    if (!suffix) {
      drawFullImage(uploadedImage.value, cameraCanvas.value)
      result = await imageWorker.recognize(cameraCanvas.value)
      suffix = extractMacSuffix(result.data.text)
    }
    if (!suffix) throw new Error('not-found')
    currentRead.value = suffix
    addResult(suffix)
  } catch (cause) {
    error.value = cause instanceof Error && cause.message === 'not-found'
      ? '图片中未识别到完整的 4 段 MAC，请使用更清晰的正面照片。'
      : '图片 OCR 失败，请重试。'
  } finally {
    loadingImage.value = false
  }
}

function drawImageRegion(source: HTMLImageElement, target: HTMLCanvasElement) {
  const width = source.naturalWidth
  const height = source.naturalHeight
  const cropWidth = width * 0.7
  const cropHeight = height * 0.32
  const context = target.getContext('2d')
  if (!context) return
  target.width = Math.max(640, Math.round(cropWidth))
  target.height = Math.max(180, Math.round(cropHeight))
  context.filter = 'grayscale(1) contrast(1.65) brightness(1.1)'
  context.drawImage(source, width * 0.15, height * 0.34, cropWidth, cropHeight, 0, 0, target.width, target.height)
  context.filter = 'none'
}

function drawFullImage(source: HTMLImageElement, target: HTMLCanvasElement) {
  const scale = Math.min(1600 / source.naturalWidth, 1600 / source.naturalHeight, 1)
  target.width = Math.max(1, Math.round(source.naturalWidth * scale))
  target.height = Math.max(1, Math.round(source.naturalHeight * scale))
  const context = target.getContext('2d')
  if (!context) return
  context.filter = 'grayscale(1) contrast(1.45) brightness(1.08)'
  context.drawImage(source, 0, 0, target.width, target.height)
  context.filter = 'none'
}

async function copyResults() {
  if (!canExport.value) return
  try {
    await navigator.clipboard.writeText(fullResults.value.join('\n'))
  } catch {
    error.value = '复制失败，请确认当前页面使用 HTTPS，或手动选择结果复制。'
    return
  }
  copySuccess.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copySuccess.value = false), 1800)
}

function exportCsv() {
  if (!canExport.value) return
  const csv = ['MAC 地址', ...fullResults.value].join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mac-addresses-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function clearResults() {
  results.value = []
  resetStability()
  info.value = '已清空识别结果'
}

function removeResult(suffix: string) {
  results.value = results.value.filter((item) => item !== suffix)
}
</script>

<template>
  <div class="min-h-0 w-full overflow-y-auto pb-8">
    <div class="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <Card class="overflow-hidden">
        <CardHeader class="gap-3 pb-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <CardTitle class="flex items-center gap-2 text-xl">
                <ScanLine class="h-5 w-5" />
                MAC 地址识别
              </CardTitle>
              <p class="mt-1 text-sm text-muted-foreground">扫描设备屏幕上的后四段，稳定识别后自动追加。</p>
            </div>
            <Badge variant="secondary" class="shrink-0">本地 OCR</Badge>
          </div>
          <div class="flex rounded-lg bg-muted p-1">
            <Button
              class="flex-1"
              :variant="inputMode === 'camera' ? 'default' : 'ghost'"
              size="sm"
              @click="switchMode('camera')"
            >
              <Camera class="mr-2 h-4 w-4" />摄像头连续识别
            </Button>
            <Button
              class="flex-1"
              :variant="inputMode === 'image' ? 'default' : 'ghost'"
              size="sm"
              @click="switchMode('image')"
            >
              <FileImage class="mr-2 h-4 w-4" />上传图片测试
            </Button>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <div v-if="inputMode === 'camera'" class="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-950">
            <video ref="video" class="h-full w-full object-cover" muted playsinline />
            <div v-if="cameraStarting" class="absolute inset-0 grid place-items-center bg-black/50 text-white">
              <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />正在启动摄像头…
            </div>
            <div v-if="!cameraActive && !cameraStarting" class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
              <div>
                <CameraOff class="mx-auto mb-2 h-8 w-8" />
                点击下方按钮启动摄像头
              </div>
            </div>
            <div class="pointer-events-none absolute left-[15%] top-[34%] h-[32%] w-[70%] rounded-lg border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.32)]">
              <span class="absolute -top-7 left-0 rounded bg-emerald-400 px-2 py-1 text-xs font-medium text-emerald-950">将 MAC 放入框内</span>
            </div>
          </div>

          <div v-else class="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted/30">
            <img v-if="previewUrl" ref="uploadedImage" :src="previewUrl" class="h-full w-full object-contain" alt="待识别图片" />
            <div v-else class="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
              选择一张设备屏幕照片，识别区域默认取图片中央位置。
            </div>
            <div v-if="previewUrl" class="pointer-events-none absolute left-[15%] top-[34%] h-[32%] w-[70%] rounded-lg border-2 border-emerald-400" />
          </div>

          <canvas ref="cameraCanvas" class="hidden" />

          <div class="flex flex-wrap gap-2">
            <Button v-if="inputMode === 'camera' && !cameraActive" :disabled="cameraStarting" @click="startCamera">
              <Camera class="mr-2 h-4 w-4" />启动摄像头
            </Button>
            <Button v-if="inputMode === 'camera' && cameraActive" variant="outline" @click="stopCamera">
              <CameraOff class="mr-2 h-4 w-4" />停止摄像头
            </Button>
            <Button v-if="inputMode === 'image'" :disabled="loadingImage" @click="fileInput?.click()">
              <LoaderCircle v-if="loadingImage" class="mr-2 h-4 w-4 animate-spin" />
              <Upload v-else class="mr-2 h-4 w-4" />选择图片
            </Button>
            <input ref="fileInput" class="hidden" type="file" accept="image/*" @change="handleFileInput" />
            <Button v-if="inputMode === 'image' && previewUrl" variant="outline" @click="releasePreviewUrl">
              <RotateCcw class="mr-2 h-4 w-4" />重新选择
            </Button>
          </div>

          <div class="rounded-lg bg-muted/60 p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted-foreground">识别状态</span>
              <Badge v-if="workerReady" variant="outline"><Check class="mr-1 h-3 w-3" />模型已加载</Badge>
              <Badge v-else variant="outline">待加载模型</Badge>
            </div>
            <p class="mt-2">{{ info }}</p>
            <p v-if="currentRead" class="mt-1 font-mono text-lg font-semibold tracking-wider">{{ currentRead }} <span class="text-sm font-normal text-muted-foreground">{{ progressLabel }}</span></p>
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card class="min-h-0 overflow-hidden">
        <CardHeader class="gap-3 pb-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <CardTitle class="flex items-center gap-2 text-xl"><ListChecks class="h-5 w-5" />识别结果</CardTitle>
              <p class="mt-1 text-sm text-muted-foreground">前缀：<span class="font-mono">{{ displayPrefix }}</span></p>
            </div>
            <Badge>{{ results.length }} 条</Badge>
          </div>
          <label class="space-y-2 text-sm font-medium">
            MAC 前缀（前两段）
            <Input v-model="prefix" maxlength="5" placeholder="例如 AA-BB" class="font-mono uppercase" />
          </label>
          <p class="text-xs text-muted-foreground">可输入 AABB、AA-BB 或 AA BB，结果会自动规范化。</p>
        </CardHeader>

        <CardContent class="flex min-h-0 flex-col gap-3">
          <div v-if="latestResult" class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div class="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><Check class="h-4 w-4" />最近录入</div>
            <p class="mt-1 break-all font-mono text-lg font-semibold tracking-wider">{{ latestResult }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="!canExport" @click="copyResults">
              <Check v-if="copySuccess" class="mr-2 h-4 w-4" />
              <ClipboardCopy v-else class="mr-2 h-4 w-4" />{{ copySuccess ? '已复制' : '复制全部' }}
            </Button>
            <Button size="sm" variant="outline" :disabled="!canExport" @click="exportCsv">
              <Download class="mr-2 h-4 w-4" />导出 CSV
            </Button>
            <Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" :disabled="!canExport" @click="clearResults">
              <Trash2 class="mr-2 h-4 w-4" />清空
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border">
            <div v-if="!fullResults.length" class="grid min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">
              <div><ScanLine class="mx-auto mb-2 h-8 w-8 opacity-50" />识别结果会自动排列在这里</div>
            </div>
            <ol v-else class="divide-y">
              <li v-for="(mac, index) in fullResults" :key="mac" class="flex items-center gap-3 px-3 py-2.5 font-mono text-sm">
                <span class="w-7 shrink-0 text-right text-xs text-muted-foreground">{{ index + 1 }}</span>
                <span class="min-w-0 flex-1 break-all">{{ mac }}</span>
                <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" aria-label="删除此条结果" @click="removeResult(results[index]!)">
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
