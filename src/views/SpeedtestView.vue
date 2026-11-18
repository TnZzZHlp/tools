<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Camera,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  Play,
  RefreshCw,
  RotateCw,
  Settings2,
  Sparkles,
  Square,
} from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import CustomTargetDialog from '@/components/speedtest/CustomTargetDialog.vue'
import SpeedConnections from '@/components/speedtest/SpeedConnections.vue'
import SpeedTrendChart from '@/components/speedtest/SpeedTrendChart.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkline } from '@/components/ui/sparkline'
import { Stat } from '@/components/ui/stat'
import { useToast } from '@/components/ui/toast'
import { Toggle } from '@/components/ui/toggle'
import {
  AUTO_TARGET_ID,
  BUILTIN_TARGETS,
  LATENCY_BUDGET,
  LATENCY_PINGS,
  LOADED_POINTS,
  MAX_DURATION,
  MIN_DURATION,
  NOT_STARTED,
  SAMPLE_INTERVAL,
  TREND_SAMPLES,
  fetchGeoInfo,
  formatBandwidth,
  formatGeoLocation,
  formatGeoProvider,
  formatJitter,
  formatLatency,
  formatTraffic,
  loadCustomTargets,
  loadSelectedTargetId,
  pickOptimalTarget,
  probePingUrl,
  probeTargets,
  runSpeedtest,
  saveCustomTargets,
  saveSelectedTargetId,
  type GeoInfo,
  type Phase,
  type SpeedtestTarget,
  type ThreadMode,
  type Throughput,
} from '@/lib/speedtest'
import { cn } from '@/lib/utils'

const SCREENSHOT_MARGIN = 24
const RE_TIMESTAMP_SEPARATORS = /[:T]/g
const MAX_SAMPLES = Math.round(MAX_DURATION / SAMPLE_INTERVAL)
const LATENCY_SHARE = LATENCY_BUDGET / 1000
const TRANSFER_SHARE = MIN_DURATION

const { toast } = useToast()

const phase = ref<Phase>('idle')
const mode = ref<ThreadMode>('multi')
const idleLatency = ref<number | null>(null)
const idlePings = ref<number[]>([])
const jitter = ref<number | null>(null)
const download = ref<Throughput>({ ...NOT_STARTED })
const upload = ref<Throughput>({ ...NOT_STARTED })
const runError = ref('')

const customTargets = ref<SpeedtestTarget[]>(loadCustomTargets())
const allTargets = computed<SpeedtestTarget[]>(() => [...BUILTIN_TARGETS, ...customTargets.value])
const domesticTargets = computed(() => BUILTIN_TARGETS.filter((t) => t.region === 'domestic'))
const globalTargets = computed(() => BUILTIN_TARGETS.filter((t) => t.region === 'global'))

const savedTargetId = loadSelectedTargetId()
const selectedTargetId = ref<string>(
  savedTargetId === AUTO_TARGET_ID || allTargets.value.some((t) => t.id === savedTargetId)
    ? (savedTargetId ?? AUTO_TARGET_ID)
    : AUTO_TARGET_ID,
)

const isAutoMode = computed(() => selectedTargetId.value === AUTO_TARGET_ID)
const probeLatencies = ref<Record<string, number | null>>({})
const probing = ref(false)
const hasAnyProbeResult = computed(() =>
  Object.values(probeLatencies.value).some((v) => typeof v === 'number'),
)

const customDialogOpen = ref(false)
const redacted = ref(false)
const capturing = ref(false)
const captureRoot = ref<HTMLElement | null>(null)

const geo = ref<GeoInfo | null>(null)
const geoLoading = ref(true)

let runController: AbortController | null = null
let geoController: AbortController | null = null
let probeController: AbortController | null = null
let activeProbePromise: Promise<unknown> | null = null

const autoTarget = computed<SpeedtestTarget>(() =>
  pickOptimalTarget(allTargets.value, probeLatencies.value, geo.value?.country_code),
)
const lockedTarget = ref<SpeedtestTarget | null>(null)

const currentTarget = computed<SpeedtestTarget>(
  () =>
    lockedTarget.value ??
    (isAutoMode.value
      ? autoTarget.value
      : (allTargets.value.find((t) => t.id === selectedTargetId.value) ?? BUILTIN_TARGETS[0]!)),
)

const currentTargetLatency = computed(() => {
  const ms = probeLatencies.value[currentTarget.value.id]
  return typeof ms === 'number' ? Math.max(1, Math.round(ms)) : null
})

const targetMenuModel = computed({
  get: () => selectedTargetId.value,
  set: (id: string) => selectTarget(id),
})

const running = computed(() => phase.value !== 'idle' && phase.value !== 'done')
const uploadUnsupported = computed(() => currentTarget.value.upload.length === 0)

const stages = computed<readonly Phase[]>(() =>
  uploadUnsupported.value ? ['latency', 'download'] : ['latency', 'download', 'upload'],
)

function transferProgress(sampleCount: number): number {
  const remaining = 1 - Math.min(1, sampleCount / MAX_SAMPLES)
  return 0.95 * (1 - remaining ** 3)
}

const progressStyle = computed(() => {
  const currentPhase = phase.value
  const currentStageIdx = stages.value.indexOf(currentPhase)
  if (currentStageIdx < 0) {
    return { transform: 'scaleX(0)', transition: 'none' }
  }
  const totalShare = LATENCY_SHARE + TRANSFER_SHARE * (stages.value.length - 1)
  if (currentPhase === 'latency') {
    const ratio = LATENCY_SHARE / totalShare
    return {
      transform: `scaleX(${ratio})`,
      transition: `transform ${LATENCY_BUDGET}ms linear`,
    }
  }
  const activeTrend =
    currentPhase === 'upload' ? upload.value.trend.length : download.value.trend.length
  const transferStart = LATENCY_SHARE + TRANSFER_SHARE * (currentStageIdx - 1)
  const ratio = (transferStart + TRANSFER_SHARE * transferProgress(activeTrend)) / totalShare
  return {
    transform: `scaleX(${Math.min(1, Math.max(0, ratio))})`,
    transition: 'transform 200ms linear',
  }
})

// Formatted readouts
const idleLatencyText = computed(() => formatLatency(idleLatency.value))
const jitterText = computed(() => formatJitter(jitter.value))

const downloadSpeedFigure = computed(() => formatBandwidth(download.value.speed))
const uploadSpeedFigure = computed(() => formatBandwidth(upload.value.speed))

const downloadLatencyText = computed(() => formatLatency(download.value.latency))
const uploadLatencyText = computed(() => formatLatency(upload.value.latency))

const downloadedTraffic = computed(() =>
  download.value.bytes > 0 || phase.value === 'download' || phase.value === 'done'
    ? formatTraffic(download.value.bytes)
    : null,
)
const uploadedTraffic = computed(() =>
  upload.value.bytes > 0 ||
  phase.value === 'upload' ||
  (phase.value === 'done' && !uploadUnsupported.value)
    ? formatTraffic(upload.value.bytes)
    : null,
)

const ipGroups = computed(() => (geo.value?.ip ? geo.value.ip.split(':') : []))
const locationText = computed(() => formatGeoLocation(geo.value, redacted.value))
const providerText = computed(() => formatGeoProvider(geo.value))

function resetFigures(nextPhase: Phase) {
  phase.value = nextPhase
  runError.value = ''
  idleLatency.value = null
  idlePings.value = []
  jitter.value = null
  download.value = { ...NOT_STARTED }
  upload.value = { ...NOT_STARTED }
}

function formatProbeBadge(id: string): string {
  const ms = probeLatencies.value[id]
  if (ms === undefined) return probing.value ? '测速中' : ''
  if (ms === null) return '不可用'
  return `${Math.max(1, Math.round(ms))} ms`
}

function probeBadgeClass(id: string): string {
  const ms = probeLatencies.value[id]
  if (typeof ms === 'number') {
    return ms < 80 ? 'text-accent' : 'text-ink-muted'
  }
  return 'text-ink-faint'
}

function stopTest() {
  runController?.abort()
  runController = null
  lockedTarget.value = null
  resetFigures('idle')
}

async function runNodeProbe(showToast = false) {
  if (running.value) return
  probeController?.abort()
  const controller = new AbortController()
  probeController = controller
  probing.value = true

  const task = probeTargets(allTargets.value, {
    signal: controller.signal,
    onResult: (id, ms) => {
      if (controller.signal.aborted) return
      probeLatencies.value = { ...probeLatencies.value, [id]: ms }
    },
  })
  activeProbePromise = task

  try {
    await task
    if (!controller.signal.aborted && showToast) {
      const winner = autoTarget.value
      const rtt = probeLatencies.value[winner.id]
      toast({
        title: `已优选最快节点：${winner.name}`,
        description:
          typeof rtt === 'number'
            ? `响应延迟约 ${Math.max(1, Math.round(rtt))} ms`
            : '已按当前网络地区匹配可用节点',
        variant: 'success',
      })
    }
  } finally {
    if (probeController === controller) {
      probing.value = false
      activeProbePromise = null
    }
  }
}

async function startTest() {
  runController?.abort()
  const controller = new AbortController()
  runController = controller
  resetFigures('latency')

  if (isAutoMode.value && probing.value && !hasAnyProbeResult.value && activeProbePromise) {
    await Promise.race([
      activeProbePromise,
      new Promise<void>((resolve) => setTimeout(resolve, 1200)),
    ])
    if (controller.signal.aborted) return
  }

  probeController?.abort()
  probeController = null
  probing.value = false

  const target = currentTarget.value
  lockedTarget.value = target

  runSpeedtest(mode.value, target, controller.signal, {
    phase: (next) => {
      phase.value = next
    },
    latency: (ms) => {
      idleLatency.value = ms
    },
    pings: (list) => {
      idlePings.value = list
    },
    jitter: (ms) => {
      jitter.value = ms
    },
    download: (reading) => {
      download.value = reading
    },
    upload: (reading) => {
      upload.value = reading
    },
  })
    .catch((err: unknown) => {
      if (controller.signal.aborted) return
      phase.value = idleLatency.value === null ? 'idle' : 'done'
      runError.value =
        err instanceof Error && err.message
          ? `连接测速节点失败（${err.message}）。请检查网络或自定义测速源是否允许跨域请求（CORS）。`
          : '无法连接至当前测速节点，请检查网络设置或切换测速源后重试。'
    })
    .finally(() => {
      if (runController === controller) {
        lockedTarget.value = null
      }
    })
}

function toggleRun() {
  if (running.value) {
    stopTest()
  } else {
    void startTest()
  }
}

function selectTarget(id: string) {
  if (running.value) return
  selectedTargetId.value = id
  saveSelectedTargetId(id)
}

function handleAddCustomTarget(target: SpeedtestTarget) {
  customTargets.value = [...customTargets.value, target]
  saveCustomTargets(customTargets.value)
  selectTarget(target.id)
  customDialogOpen.value = false
  toast({
    title: '已添加自定义测速源',
    description: `当前已切换至「${target.name}」`,
    variant: 'success',
  })
  void probePingUrl(target.ping, probeController?.signal).then((ms) => {
    probeLatencies.value = { ...probeLatencies.value, [target.id]: ms }
  })
}

function handleRemoveCustomTarget(id: string) {
  customTargets.value = customTargets.value.filter((item) => item.id !== id)
  saveCustomTargets(customTargets.value)
  if (selectedTargetId.value === id) {
    selectTarget(AUTO_TARGET_ID)
  }
}

function saveBlobDownload(blobPromise: Promise<Blob>) {
  return blobPromise
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const stamp = new Date().toISOString().slice(0, 19).replace(RE_TIMESTAMP_SEPARATORS, '-')
      link.download = `speedtest-${stamp}.png`
      link.click()
      URL.revokeObjectURL(url)
      toast({
        title: '测速截图已保存',
        description: '已自动隐藏敏感 IP 与运营商信息。',
        variant: 'success',
      })
    })
    .catch(() => {
      toast({
        title: '截图生成失败',
        description: '请稍后重试或使用系统截图工具。',
        variant: 'danger',
      })
    })
}

async function captureScreenshot() {
  const node = captureRoot.value
  if (!node || phase.value !== 'done' || capturing.value) return

  const previousRedacted = redacted.value
  redacted.value = true
  capturing.value = true
  await nextTick()

  const bgColor = getComputedStyle(document.body).backgroundColor || '#F5F6F8'
  const imagePromise = import('modern-screenshot').then(({ domToBlob }) =>
    domToBlob(node, {
      scale: 2,
      width: node.offsetWidth + SCREENSHOT_MARGIN * 2,
      height: node.offsetHeight + SCREENSHOT_MARGIN * 2,
      style: { padding: `${SCREENSHOT_MARGIN}px` },
      backgroundColor: bgColor,
      filter: (el) => !(el instanceof HTMLElement) || el.dataset.screenshot !== 'hide',
    }),
  )

  imagePromise
    .catch(() => {})
    .finally(() => {
      redacted.value = previousRedacted
      capturing.value = false
    })

  const clipboardCopy =
    typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write
      ? Promise.reject(new Error('ClipboardItem unsupported'))
      : navigator.clipboard.write([new ClipboardItem({ 'image/png': imagePromise })])

  clipboardCopy
    .then(() => {
      toast({
        title: '测速截图已复制到剪贴板',
        description: '敏感 IP 与运营商信息已自动打码隐藏。',
        variant: 'success',
      })
    })
    .catch(() => saveBlobDownload(imagePromise))
}

async function loadGeo() {
  geoController?.abort()
  const controller = new AbortController()
  geoController = controller
  geoLoading.value = true
  try {
    const info = await fetchGeoInfo(controller.signal)
    if (!controller.signal.aborted) {
      geo.value = info
    }
  } catch {
    // Leave empty dash if all geo endpoints are unreachable.
  } finally {
    if (!controller.signal.aborted) {
      geoLoading.value = false
    }
  }
}

onMounted(() => {
  void loadGeo()
  void runNodeProbe()
})

onBeforeUnmount(() => {
  runController?.abort()
  geoController?.abort()
  probeController?.abort()
})
</script>

<template>
  <div class="flex flex-col pb-8">
    <div ref="captureRoot" class="space-y-3 sm:space-y-4">
      <ToolPageHeader
        title="网络测速"
        description="测量当前网络的下载与上传吞吐量、空闲及负载延迟、抖动与连接归属信息。"
        :icon="Gauge"
        class="mb-2 sm:mb-3"
      >
        <template #badges>
          <Badge variant="outline" class="gap-1">
            <Sparkles v-if="isAutoMode" class="size-3 text-accent" aria-hidden="true" />
            <span v-if="isAutoMode && probing && !hasAnyProbeResult">正在自动优选节点…</span>
            <span v-else>
              {{ isAutoMode ? `自动优选 · ${currentTarget.name}` : currentTarget.name }}
              <template v-if="currentTargetLatency !== null">
                · {{ currentTargetLatency }} ms
              </template>
            </span>
          </Badge>
        </template>

        <template #actions>
          <div data-screenshot="hide" class="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              :disabled="phase !== 'done' || capturing"
              @click="captureScreenshot"
            >
              <template #leading>
                <Camera class="size-4" />
              </template>
              <span>截图</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="secondary"
                  size="sm"
                  :disabled="running"
                  :aria-label="`测速节点：${currentTarget.name}`"
                >
                  <template #leading>
                    <Sparkles v-if="isAutoMode" class="size-4 text-accent" />
                    <Globe v-else class="size-4 text-ink-muted" />
                  </template>
                  <span class="max-w-40 truncate">
                    {{ isAutoMode ? `自动 · ${currentTarget.name}` : currentTarget.name }}
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                :min-width="290"
                class="max-h-[min(75dvh,28rem)] overflow-y-auto"
              >
                <DropdownMenuRadioGroup v-model="targetMenuModel">
                  <DropdownMenuRadioItem :value="AUTO_TARGET_ID">
                    <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span class="truncate font-medium text-ink">自动选择最优节点</span>
                      <span class="max-w-28 shrink-0 truncate text-[11px] font-normal text-accent">
                        {{ probing && !hasAnyProbeResult ? '检测中…' : autoTarget.name }}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>中国大陆节点</DropdownMenuLabel>
                  <DropdownMenuRadioItem
                    v-for="item in domesticTargets"
                    :key="item.id"
                    :value="item.id"
                  >
                    <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span class="truncate">{{ item.name }}</span>
                      <span class="flex shrink-0 items-center gap-1.5 text-[11px] font-normal">
                        <span v-if="item.upload.length === 0" class="text-ink-faint">仅下载</span>
                        <span
                          v-if="formatProbeBadge(item.id)"
                          :class="['tabular-nums', probeBadgeClass(item.id)]"
                        >
                          {{ formatProbeBadge(item.id) }}
                        </span>
                      </span>
                    </span>
                  </DropdownMenuRadioItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>全球与海外节点</DropdownMenuLabel>
                  <DropdownMenuRadioItem
                    v-for="item in globalTargets"
                    :key="item.id"
                    :value="item.id"
                  >
                    <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span class="truncate">{{ item.name }}</span>
                      <span class="flex shrink-0 items-center gap-1.5 text-[11px] font-normal">
                        <span v-if="item.dataSaver" class="text-ink-faint">省流</span>
                        <span v-else-if="item.upload.length === 0" class="text-ink-faint">
                          仅下载
                        </span>
                        <span
                          v-if="formatProbeBadge(item.id)"
                          :class="['tabular-nums', probeBadgeClass(item.id)]"
                        >
                          {{ formatProbeBadge(item.id) }}
                        </span>
                      </span>
                    </span>
                  </DropdownMenuRadioItem>

                  <template v-if="customTargets.length">
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>自定义节点</DropdownMenuLabel>
                    <DropdownMenuRadioItem
                      v-for="item in customTargets"
                      :key="item.id"
                      :value="item.id"
                    >
                      <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span class="truncate">{{ item.name }}</span>
                        <span class="flex shrink-0 items-center gap-1.5 text-[11px] font-normal">
                          <span v-if="item.upload.length === 0" class="text-ink-faint">仅下载</span>
                          <span
                            v-if="formatProbeBadge(item.id)"
                            :class="['tabular-nums', probeBadgeClass(item.id)]"
                          >
                            {{ formatProbeBadge(item.id) }}
                          </span>
                        </span>
                      </span>
                    </DropdownMenuRadioItem>
                  </template>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuItem :disabled="probing || running" @select="runNodeProbe(true)">
                  <RefreshCw class="size-4 text-ink-muted" :class="{ 'animate-spin': probing }" />
                  <span>{{ probing ? '正在检测各节点延迟…' : '重新检测最优节点' }}</span>
                </DropdownMenuItem>
                <DropdownMenuItem @select="customDialogOpen = true">
                  <Settings2 class="size-4 text-ink-muted" />
                  <span>管理自定义测速源…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </template>
      </ToolPageHeader>

      <Alert v-if="runError" variant="danger" data-screenshot="hide">
        <AlertTitle>测速中断</AlertTitle>
        <AlertDescription>{{ runError }}</AlertDescription>
      </Alert>

      <!-- Top 4-Up Controls & Idle Latency Strip -->
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:gap-4">
        <Button
          :variant="running ? 'ghost' : 'primary'"
          size="md"
          :class="
            cn(
              'h-full min-h-14 w-full text-[15px] lg:text-[17px]',
              running && 'ring-1 ring-line ring-inset',
            )
          "
          @click="toggleRun"
        >
          <template #progress>
            <span
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 -z-10 origin-left bg-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]"
              :style="progressStyle"
            />
          </template>
          <template #leading>
            <Play v-if="phase === 'idle'" class="size-4 fill-current" aria-hidden="true" />
            <Square v-else-if="running" class="size-3.5 fill-current" aria-hidden="true" />
            <RotateCw v-else class="size-4" aria-hidden="true" />
          </template>
          <span v-if="phase === 'idle'">开始测速</span>
          <span v-else-if="running">停止测速</span>
          <span v-else>重新测速</span>
        </Button>

        <div
          class="flex flex-col justify-center rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
        >
          <span class="text-[13px] font-medium text-ink-muted">连接数</span>
          <SpeedConnections v-model="mode" :disabled="running" />
        </div>

        <div
          class="flex flex-col justify-center rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
        >
          <Stat label="延迟" :value="idleLatencyText" unit="ms">
            <template #figure>
              <Sparkline :values="idlePings" :slots="LATENCY_PINGS" tone="default" />
            </template>
          </Stat>
        </div>

        <div
          class="flex flex-col justify-center rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
        >
          <Stat label="抖动" :value="jitterText" unit="ms" />
        </div>
      </div>

      <!-- Download & Upload Direction Panels -->
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:gap-4">
        <!-- Download Section -->
        <section class="grid gap-2.5 sm:gap-3 lg:gap-4" aria-label="下载测速">
          <div
            class="flex flex-col gap-2 overflow-hidden rounded-panel border border-line bg-raised px-4 pt-4 sm:gap-2.5 sm:px-5 sm:pt-5 lg:gap-3.5 lg:rounded-panel-lg lg:px-7 lg:pt-7"
          >
            <h2
              class="flex items-center gap-1.5 text-[14px] leading-tight font-medium text-ink-muted lg:text-[15px]"
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" class="size-3 shrink-0 text-accent">
                <path
                  d="M6 1.5v9M2.5 7l3.5 3.5L9.5 7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              下载
            </h2>

            <p
              :class="
                cn(
                  'font-condensed text-[clamp(40px,11vw,48px)] leading-none font-medium tracking-[-0.01em] tabular-nums sm:text-[clamp(44px,9vw,64px)] lg:text-[clamp(56px,5.5vw,84px)]',
                  downloadSpeedFigure === null ? 'text-ink-faint' : 'text-ink',
                )
              "
            >
              {{ downloadSpeedFigure?.value ?? '—'
              }}<span
                class="ml-2 font-sans text-[16px] font-normal tracking-normal text-ink-muted lg:text-[20px]"
                >{{ downloadSpeedFigure?.unit ?? 'Mbps' }}</span
              >
            </p>

            <div
              class="-mx-4 mt-1 h-20 sm:-mx-5 sm:mt-1.5 sm:h-28 lg:-mx-7 lg:h-[clamp(140px,13vw,192px)]"
            >
              <SpeedTrendChart
                :samples="download.trend"
                :capacity="Math.max(download.trend.length, TREND_SAMPLES)"
                :marker="download.sustained"
                marker-label="稳定速率"
                tone="download"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
            <div
              class="rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
            >
              <Stat label="下载负载延迟" :value="downloadLatencyText" unit="ms">
                <template #figure>
                  <Sparkline :values="download.pings" :slots="LOADED_POINTS" tone="accent" />
                </template>
              </Stat>
            </div>
            <div
              class="rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
            >
              <Stat
                label="已下载数据"
                :value="downloadedTraffic?.value ?? null"
                :unit="downloadedTraffic?.unit ?? 'MB'"
              />
            </div>
          </div>
        </section>

        <!-- Upload Section -->
        <section
          aria-label="上传测速"
          :class="
            cn(
              'grid gap-2.5 transition-opacity duration-[var(--p0seid0n-duration-normal)] sm:gap-3 lg:gap-4',
              uploadUnsupported && 'opacity-45',
            )
          "
        >
          <div
            class="flex flex-col gap-2 overflow-hidden rounded-panel border border-line bg-raised px-4 pt-4 sm:gap-2.5 sm:px-5 sm:pt-5 lg:gap-3.5 lg:rounded-panel-lg lg:px-7 lg:pt-7"
          >
            <h2
              class="flex items-center gap-1.5 text-[14px] leading-tight font-medium text-ink-muted lg:text-[15px]"
            >
              <svg
                viewBox="0 0 12 12"
                aria-hidden="true"
                class="size-3 shrink-0 rotate-180 text-[var(--p0seid0n-upload)]"
              >
                <path
                  d="M6 1.5v9M2.5 7l3.5 3.5L9.5 7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              上传
              <span v-if="uploadUnsupported" class="text-[12px] font-normal text-ink-faint">
                （当前节点不支持）
              </span>
            </h2>

            <p
              :class="
                cn(
                  'font-condensed text-[clamp(40px,11vw,48px)] leading-none font-medium tracking-[-0.01em] tabular-nums sm:text-[clamp(44px,9vw,64px)] lg:text-[clamp(56px,5.5vw,84px)]',
                  uploadSpeedFigure === null ? 'text-ink-faint' : 'text-ink',
                )
              "
            >
              {{ uploadSpeedFigure?.value ?? '—'
              }}<span
                class="ml-2 font-sans text-[16px] font-normal tracking-normal text-ink-muted lg:text-[20px]"
                >{{ uploadSpeedFigure?.unit ?? 'Mbps' }}</span
              >
            </p>

            <div
              class="-mx-4 mt-1 h-20 sm:-mx-5 sm:mt-1.5 sm:h-28 lg:-mx-7 lg:h-[clamp(140px,13vw,192px)]"
            >
              <SpeedTrendChart
                :samples="upload.trend"
                :capacity="Math.max(upload.trend.length, TREND_SAMPLES)"
                :marker="upload.sustained"
                marker-label="稳定速率"
                tone="upload"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
            <div
              class="rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
            >
              <Stat label="上传负载延迟" :value="uploadLatencyText" unit="ms">
                <template #figure>
                  <Sparkline :values="upload.pings" :slots="LOADED_POINTS" tone="accent-alt" />
                </template>
              </Stat>
            </div>
            <div
              class="rounded-panel border border-line bg-raised px-3 py-2.5 sm:px-3.5 lg:px-4 lg:py-3.5"
            >
              <Stat
                label="已上传数据"
                :value="uploadedTraffic?.value ?? null"
                :unit="uploadedTraffic?.unit ?? 'MB'"
              />
            </div>
          </div>
        </section>
      </div>

      <!-- Client IP, Location & ISP Card -->
      <section
        aria-label="本机网络信息"
        class="flex flex-col gap-3.5 rounded-panel border border-line bg-raised p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5 lg:rounded-panel-lg lg:p-6"
      >
        <dl
          class="flex min-w-0 flex-1 flex-col flex-wrap gap-x-8 gap-y-3 sm:flex-row lg:gap-x-12 lg:gap-y-4"
        >
          <!-- IP Address -->
          <div class="max-w-full flex-1 basis-auto">
            <dt class="text-[13px] leading-snug text-ink-muted lg:text-[14px]">IP 地址</dt>
            <dd
              :class="
                cn(
                  'mt-0.5 text-[14px] leading-snug font-medium tabular-nums wrap-anywhere lg:text-[16px]',
                  !geoLoading && !geo?.ip ? 'text-ink-faint' : 'text-ink',
                )
              "
            >
              <span v-if="geoLoading" class="flex h-[1.3em] items-center">
                <Skeleton class="h-[1em] w-[18ch] max-w-full" />
              </span>
              <Badge v-else-if="redacted" variant="neutral" class="rounded-full">
                <EyeOff class="size-3" aria-hidden="true" />
                已隐藏
              </Badge>
              <template v-else-if="ipGroups.length > 1">
                <template v-for="(group, idx) in ipGroups" :key="idx">
                  <template v-if="idx > 0">:<wbr /></template>{{ group }}
                </template>
              </template>
              <template v-else>{{ geo?.ip || '—' }}</template>
            </dd>
          </div>

          <!-- Location -->
          <div class="max-w-full flex-1 basis-auto">
            <dt class="text-[13px] leading-snug text-ink-muted lg:text-[14px]">地理位置</dt>
            <dd
              :class="
                cn(
                  'mt-0.5 text-[14px] leading-snug font-medium wrap-anywhere lg:text-[16px]',
                  !geoLoading && !locationText ? 'text-ink-faint' : 'text-ink',
                )
              "
            >
              <span v-if="geoLoading" class="flex h-[1.3em] items-center">
                <Skeleton class="h-[1em] w-[20ch] max-w-full" />
              </span>
              <template v-else>{{ locationText || '—' }}</template>
            </dd>
          </div>

          <!-- Provider / ISP -->
          <div class="max-w-full flex-1 basis-auto">
            <dt class="text-[13px] leading-snug text-ink-muted lg:text-[14px]">网络运营商</dt>
            <dd
              :class="
                cn(
                  'mt-0.5 text-[14px] leading-snug font-medium tabular-nums wrap-anywhere lg:text-[16px]',
                  !geoLoading && !providerText ? 'text-ink-faint' : 'text-ink',
                )
              "
            >
              <span v-if="geoLoading" class="flex h-[1.3em] items-center">
                <Skeleton class="h-[1em] w-[26ch] max-w-full" />
              </span>
              <Badge v-else-if="redacted" variant="neutral" class="rounded-full">
                <EyeOff class="size-3" aria-hidden="true" />
                已隐藏
              </Badge>
              <template v-else>{{ providerText || '—' }}</template>
            </dd>
          </div>
        </dl>

        <div data-screenshot="hide" class="flex shrink-0 justify-end">
          <Toggle v-model="redacted" variant="outline" size="sm" class="min-h-7 px-2.5 text-[13px]">
            <Eye v-if="redacted" class="size-3.5" aria-hidden="true" />
            <EyeOff v-else class="size-3.5" aria-hidden="true" />
            <span>{{ redacted ? '显示详情' : '隐藏详情' }}</span>
          </Toggle>
        </div>
      </section>
    </div>

    <CustomTargetDialog
      v-model:open="customDialogOpen"
      :custom-targets="customTargets"
      :active-target-id="currentTarget.id"
      @add="handleAddCustomTarget"
      @remove="handleRemoveCustomTarget"
      @select="selectTarget"
    />
  </div>
</template>
