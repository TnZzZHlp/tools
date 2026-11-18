<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createWorker, PSM, type Worker } from 'tesseract.js'
import {
  Camera,
  CameraOff,
  Check,
  ClipboardCopy,
  Cpu,
  Download,
  FileImage,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Trash2,
  Upload,
} from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildMacAddress, extractMacSuffix, normalizeMacPrefix } from '@/utils/macAddress'

type InputMode = 'camera' | 'image'

const STORAGE_PREFIX = 'mac-scanner-prefix'
const STORAGE_RESULTS = 'mac-scanner-results'
const OCR_WHITELIST = '0123456789ABCDEFabcdef-: '

const inputMode = ref<InputMode>('camera')
const prefix = ref(localStorage.getItem(STORAGE_PREFIX) ?? '')
const results = ref<string[]>(loadResults())
const error = ref('')
const info = ref('点击启动摄像头或上传照片开始识别')
const currentRead = ref('')
const cameraStarting = ref(false)
const cameraActive = ref(false)
const scanInProgress = ref(false)
const loadingImage = ref(false)
const workerReady = ref(false)
const copySuccessIndex = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const cameraCanvas = ref<HTMLCanvasElement | null>(null)
const uploadedImage = ref<HTMLImageElement | null>(null)
const previewUrl = ref('')

let stream: MediaStream | null = null
let worker: Worker | null = null
let copyTimer: ReturnType<typeof setTimeout> | undefined
let cameraSession = 0

const fullResults = computed(() =>
  results.value.map((suffix) => buildMacAddress(prefix.value, suffix)),
)
const latestResult = computed(() => fullResults.value[0] ?? '')
const canExport = computed(() => fullResults.value.length > 0)
const displayPrefix = computed(() => normalizeMacPrefix(prefix.value) || '未设置')

watch(prefix, (value) => {
  prefix.value = normalizeMacPrefix(value)
  localStorage.setItem(STORAGE_PREFIX, prefix.value)
})

watch(results, (value) => localStorage.setItem(STORAGE_RESULTS, JSON.stringify(value)), {
  deep: true,
})

onBeforeUnmount(() => {
  stopCamera()
  void disposeWorker()
  releasePreviewUrl()
  clearTimeout(copyTimer)
})

function loadResults(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_RESULTS) ?? '[]')
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string')
      : []
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
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    if (session !== cameraSession || !video.value) return

    video.value.srcObject = stream
    await video.value.play()
    cameraActive.value = true
    info.value = '将屏幕上的 MAC 对准取景框，点击“拍照识别”即可录入。'
  } catch (cause) {
    error.value =
      cause instanceof DOMException && cause.name === 'NotAllowedError'
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
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (video.value) video.value.srcObject = null
}

function getCameraCrop(source: HTMLVideoElement) {
  const sourceWidth = source.videoWidth
  const sourceHeight = source.videoHeight
  const containerRatio = 4 / 3
  const sourceRatio = sourceWidth / sourceHeight
  const visibleWidth = sourceRatio > containerRatio ? sourceHeight * containerRatio : sourceWidth
  const visibleHeight = sourceRatio < containerRatio ? sourceWidth / containerRatio : sourceHeight
  const visibleX = (sourceWidth - visibleWidth) / 2
  const visibleY = (sourceHeight - visibleHeight) / 2
  return {
    x: visibleX + visibleWidth * 0.15,
    y: visibleY + visibleHeight * 0.34,
    width: visibleWidth * 0.7,
    height: visibleHeight * 0.32,
  }
}

function setCanvasSize(target: HTMLCanvasElement, width: number, height: number) {
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height
}

function drawCameraRegion(source: HTMLVideoElement, target: HTMLCanvasElement) {
  const crop = getCameraCrop(source)
  const width = Math.max(640, Math.round(crop.width))
  const height = Math.max(180, Math.round(crop.height))

  setCanvasSize(target, width, height)
  const context = target.getContext('2d')
  if (!context) return
  context.filter = 'grayscale(1) contrast(1.65) brightness(1.1)'
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
  context.filter = 'none'
}

async function captureCameraFrame() {
  if (
    !cameraActive.value ||
    scanInProgress.value ||
    !video.value?.videoWidth ||
    !cameraCanvas.value
  ) {
    return
  }

  const session = cameraSession
  scanInProgress.value = true
  error.value = ''
  info.value = '正在识别当前画面…'
  try {
    drawCameraRegion(video.value, cameraCanvas.value)
    const suffix = await recognizeCanvas(cameraCanvas.value)
    if (!suffix || !cameraActive.value || session !== cameraSession) return

    currentRead.value = suffix
    addResult(suffix)
  } finally {
    scanInProgress.value = false
  }
}

async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const result = await (await getWorker()).recognize(canvas)
    const suffix = extractMacSuffix(result.data.text)
    if (suffix) return suffix
    if (cameraActive.value) {
      currentRead.value = ''
      info.value = '未识别到完整的 4 段 MAC，请调整距离、角度或光线。'
    }
    return null
  } catch {
    error.value = 'OCR 识别失败，请重试或改用更清晰的图片。'
    return null
  }
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

function switchMode(nextMode: string | number) {
  const mode: InputMode = nextMode === 'image' ? 'image' : 'camera'
  if (inputMode.value === mode) return
  if (mode === 'camera') {
    inputMode.value = mode
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
  currentRead.value = ''
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

    if (!suffix) {
      drawFullImage(uploadedImage.value, cameraCanvas.value)
      result = await imageWorker.recognize(cameraCanvas.value)
      suffix = extractMacSuffix(result.data.text)
    }
    if (!suffix) throw new Error('not-found')
    currentRead.value = suffix
    addResult(suffix)
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message === 'not-found'
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
  const targetWidth = Math.max(640, Math.round(cropWidth))
  const targetHeight = Math.max(180, Math.round(cropHeight))
  setCanvasSize(target, targetWidth, targetHeight)
  const context = target.getContext('2d')
  if (!context) return
  context.filter = 'grayscale(1) contrast(1.65) brightness(1.1)'
  context.drawImage(
    source,
    width * 0.15,
    height * 0.34,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  )
  context.filter = 'none'
}

function drawFullImage(source: HTMLImageElement, target: HTMLCanvasElement) {
  const scale = Math.min(1600 / source.naturalWidth, 1600 / source.naturalHeight, 1)
  const targetWidth = Math.max(1, Math.round(source.naturalWidth * scale))
  const targetHeight = Math.max(1, Math.round(source.naturalHeight * scale))
  setCanvasSize(target, targetWidth, targetHeight)
  const context = target.getContext('2d')
  if (!context) return
  context.filter = 'grayscale(1) contrast(1.45) brightness(1.08)'
  context.drawImage(source, 0, 0, targetWidth, targetHeight)
  context.filter = 'none'
}

async function copyResults() {
  if (!canExport.value) return
  try {
    await navigator.clipboard.writeText(fullResults.value.join('\n'))
    copySuccessIndex.value = -1
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copySuccessIndex.value = null), 1800)
  } catch {
    error.value = '复制失败，请确认当前页面使用 HTTPS，或手动选择结果复制。'
  }
}

async function copySingle(mac: string, index: number) {
  try {
    await navigator.clipboard.writeText(mac)
    copySuccessIndex.value = index
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copySuccessIndex.value = null), 1800)
  } catch {
    error.value = '复制失败，请手动复制。'
  }
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
  currentRead.value = ''
  info.value = '已清空识别结果'
}

function removeResult(suffix: string) {
  results.value = results.value.filter((item) => item !== suffix)
}
</script>

<template>
  <div class="flex flex-col pb-8">
    <ToolPageHeader
      title="MAC 地址扫描录入"
      description="扫描设备屏幕上的后四段 MAC，自动拼接固定前缀、去重归档并支持一键导出 CSV。"
      badge="本地 OCR"
      :icon="Cpu"
    >
      <template #actions>
        <Tabs :model-value="inputMode" @update:model-value="switchMode">
          <TabsList>
            <TabsTrigger value="camera" class="gap-1.5 px-3 text-xs sm:text-sm">
              <Camera class="size-3.5" />
              摄像头拍照
            </TabsTrigger>
            <TabsTrigger value="image" class="gap-1.5 px-3 text-xs sm:text-sm">
              <FileImage class="size-3.5" />
              图片上传
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ToolPageHeader>

    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.95fr)]">
      <!-- Left Card: Scanner Viewfinder -->
      <Card class="py-5">
        <CardHeader class="px-5">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-base">
              {{ inputMode === 'camera' ? '摄像头取景识别' : '照片识别' }}
            </CardTitle>
            <Badge v-if="workerReady" variant="outline" class="gap-1 font-normal">
              <Check class="size-3 text-emerald-600 dark:text-emerald-400" />
              OCR 模型就绪
            </Badge>
            <Badge v-else variant="secondary" class="font-normal">首次识别加载模型</Badge>
          </div>
        </CardHeader>

        <CardContent class="space-y-4 px-5">
          <div
            v-if="inputMode === 'camera'"
            class="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-950"
          >
            <video ref="video" class="h-full w-full object-cover" muted autoplay playsinline />

            <div
              v-if="cameraStarting"
              class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-sm text-white"
            >
              <LoaderCircle class="size-5 animate-spin" />
              正在启动摄像头…
            </div>

            <button
              v-if="!cameraActive && !cameraStarting"
              type="button"
              class="absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center bg-black/70 p-6 text-center text-sm text-white/85 transition-colors hover:bg-black/60"
              @click="startCamera"
            >
              <Camera class="mb-2.5 size-8 opacity-85" />
              <span class="font-medium">点击启动摄像头开始采集</span>
            </button>

            <template v-if="cameraActive">
              <div class="pointer-events-none absolute inset-0">
                <div class="absolute inset-x-0 top-0 h-[34%] bg-black/35" />
                <div class="absolute inset-x-0 bottom-0 h-[34%] bg-black/35" />
                <div class="absolute top-[34%] bottom-[34%] left-0 w-[15%] bg-black/35" />
                <div class="absolute top-[34%] right-0 bottom-[34%] w-[15%] bg-black/35" />
              </div>
              <div
                class="pointer-events-none absolute top-[34%] left-[15%] h-[32%] w-[70%] rounded-lg border-2 border-emerald-400"
              >
                <span
                  class="absolute -top-7 left-0 rounded bg-emerald-400 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-950"
                >
                  将 MAC 后四段放入框内
                </span>
              </div>
            </template>
          </div>

          <div
            v-else
            class="relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed bg-muted/25"
          >
            <img
              v-if="previewUrl"
              ref="uploadedImage"
              :src="previewUrl"
              class="h-full w-full object-contain"
              alt="待识别设备照片"
            />
            <button
              v-else
              type="button"
              class="flex h-full w-full cursor-pointer flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40"
              @click="fileInput?.click()"
            >
              <Upload class="mb-2.5 size-8" />
              <span class="font-medium text-foreground">点击选择一张设备屏幕照片</span>
              <span class="mt-1 text-xs">优先裁剪中央区域识别，失败时自动全图重试</span>
            </button>
            <div
              v-if="previewUrl"
              class="pointer-events-none absolute top-[34%] left-[15%] h-[32%] w-[70%] rounded-lg border-2 border-emerald-400"
            />
          </div>

          <canvas ref="cameraCanvas" class="hidden" />
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept="image/*"
            @change="handleFileInput"
          />

          <!-- Controls -->
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="inputMode === 'camera' && !cameraActive"
              class="flex-1"
              :disabled="cameraStarting"
              @click="startCamera"
            >
              <Camera class="size-4" />
              启动摄像头
            </Button>
            <Button
              v-if="inputMode === 'camera' && cameraActive"
              class="flex-1"
              :disabled="scanInProgress"
              @click="captureCameraFrame"
            >
              <LoaderCircle v-if="scanInProgress" class="size-4 animate-spin" />
              <ScanLine v-else class="size-4" />
              {{ scanInProgress ? '正在识别…' : '拍照识别录入' }}
            </Button>
            <Button
              v-if="inputMode === 'camera' && cameraActive"
              variant="outline"
              :disabled="scanInProgress"
              @click="stopCamera"
            >
              <CameraOff class="size-4" />
              停止
            </Button>

            <Button
              v-if="inputMode === 'image'"
              class="flex-1"
              :disabled="loadingImage"
              @click="fileInput?.click()"
            >
              <LoaderCircle v-if="loadingImage" class="size-4 animate-spin" />
              <Upload v-else class="size-4" />
              {{ loadingImage ? '识别中…' : '选择照片识别' }}
            </Button>
            <Button
              v-if="inputMode === 'image' && previewUrl"
              variant="outline"
              @click="releasePreviewUrl"
            >
              <RotateCcw class="size-4" />
              清除预览
            </Button>
          </div>

          <!-- Status Banner -->
          <div class="rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm">
            <p class="text-xs text-muted-foreground">{{ info }}</p>
            <p
              v-if="currentRead"
              class="mt-1 font-mono text-base font-semibold tracking-wider text-foreground"
            >
              本次读取：{{ currentRead }}
            </p>
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertTitle>操作提示</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <!-- Right Card: Prefix & Collected MAC List -->
      <Card class="min-w-0 py-5">
        <CardHeader class="gap-3 px-5">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="flex items-center gap-2 text-base">
              <ListChecks class="size-4.5" />
              已录入列表
            </CardTitle>
            <Badge variant="secondary" class="tabular-nums font-normal">
              {{ results.length }} 条
            </Badge>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <Label for="mac-prefix-input">固定前缀（前两段）</Label>
              <span class="font-mono text-xs text-muted-foreground">当前：{{ displayPrefix }}</span>
            </div>
            <Input
              id="mac-prefix-input"
              v-model="prefix"
              maxlength="5"
              placeholder="例如 AA-BB（留空仅输出后四段）"
              class="font-mono uppercase"
            />
          </div>
        </CardHeader>

        <CardContent class="space-y-3.5 px-5">
          <div
            v-if="latestResult"
            class="rounded-lg border border-emerald-500/35 bg-emerald-500/8 px-3.5 py-2.5"
          >
            <div
              class="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <Check class="size-3.5" />
              最新录入
            </div>
            <p class="mt-0.5 break-all font-mono text-base font-semibold tracking-wider">
              {{ latestResult }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              class="flex-1"
              :disabled="!canExport"
              :class="
                copySuccessIndex === -1 &&
                'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              "
              @click="copyResults"
            >
              <Check v-if="copySuccessIndex === -1" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copySuccessIndex === -1 ? '已复制全部' : '复制全部' }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="flex-1"
              :disabled="!canExport"
              @click="exportCsv"
            >
              <Download class="size-3.5" />
              导出 CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              :disabled="!canExport"
              @click="clearResults"
            >
              <Trash2 class="size-3.5" />
              清空
            </Button>
          </div>

          <div class="max-h-96 overflow-y-auto rounded-xl border bg-muted/15">
            <div
              v-if="!fullResults.length"
              class="flex min-h-48 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground"
            >
              <ScanLine class="mb-2 size-7 opacity-45" />
              <p>识别到的 MAC 地址会自动去重并排列在此处</p>
            </div>

            <ol v-else class="divide-y">
              <li
                v-for="(mac, index) in fullResults"
                :key="mac"
                class="flex items-center gap-2.5 px-3 py-2 font-mono text-sm transition-colors hover:bg-muted/40"
              >
                <span class="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 break-all">{{ mac }}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :class="copySuccessIndex === index && 'text-emerald-600 dark:text-emerald-400'"
                  :aria-label="`复制 ${mac}`"
                  @click="copySingle(mac, index)"
                >
                  <Check v-if="copySuccessIndex === index" class="size-3.5" />
                  <ClipboardCopy v-else class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="删除此条结果"
                  @click="removeResult(results[index]!)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
