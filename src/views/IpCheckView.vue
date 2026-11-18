<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Network,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Toggle } from '@/components/ui/toggle'
import {
  countryCodeToFlag,
  createInitialExitSlots,
  inspectIpAddress,
  normalizeQueryInput,
  probeAllClientExits,
  probeWebRtcIps,
  redactIp,
  resolveDomainIps,
  type ExitEndpointResult,
  type ExitSlotId,
  type IpInspectionReport,
  type WebRtcProbeResult,
} from '@/lib/ip-check'
import { cn } from '@/lib/utils'

const SCREENSHOT_MARGIN = 24
const RE_TIMESTAMP_SEPARATORS = /[:T]/g

const { toast } = useToast()

const queryInput = ref('')
const queryError = ref('')
const queryResolving = ref(false)
const resolvedDomain = ref('')
const resolvedDomainIps = ref<string[]>([])

const exitSlots = ref<ExitEndpointResult[]>(createInitialExitSlots())
const selectedIp = ref('')
const selectionSource = ref<'auto' | 'exit' | 'custom'>('auto')
const selectedExitId = ref<ExitSlotId | null>(null)
const hasUserSelection = ref(false)

const report = ref<IpInspectionReport | null>(null)
const inspecting = ref(false)

const webrtc = ref<WebRtcProbeResult>({
  status: 'idle',
  publicIps: [],
  localIps: [],
})

const redacted = ref(false)
const capturing = ref(false)
const captureRoot = ref<HTMLElement | null>(null)
const copiedKey = ref('')

let exitController: AbortController | null = null
let inspectController: AbortController | null = null
let queryController: AbortController | null = null
let webrtcController: AbortController | null = null
let copyTimer: ReturnType<typeof setTimeout> | undefined

const browserTimezone = computed(() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '未知'
  } catch {
    return '未知'
  }
})

const browserLanguage = computed(() => {
  if (typeof navigator === 'undefined') return '未知'
  return navigator.language || '未知'
})

const hasAnyExitIp = computed(() => exitSlots.value.some((slot) => slot.status === 'ok'))

const isCustomTarget = computed(() => selectionSource.value === 'custom' && selectedIp.value !== '')

function maskSegment(cidr: string): string {
  if (!cidr) return ''
  const [prefix, mask] = cidr.split('/')
  if (!prefix) return '***'
  return `${redactIp(prefix)}${mask ? `/${mask}` : ''}`
}

function displayIp(ip: string): string {
  if (!ip) return ''
  return redacted.value ? redactIp(ip) : ip
}

function copyText(value: string, key: string, label: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      copiedKey.value = key
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        if (copiedKey.value === key) copiedKey.value = ''
      }, 1500)
      toast({
        title: `已复制${label}`,
        description: redacted.value ? '已复制原始值到剪贴板' : value,
        variant: 'success',
      })
    })
    .catch(() => {
      toast({
        title: '复制失败',
        description: '当前浏览器环境限制访问剪贴板。',
        variant: 'danger',
      })
    })
}

async function runInspection(ip: string) {
  inspectController?.abort()
  const controller = new AbortController()
  inspectController = controller
  selectedIp.value = ip
  inspecting.value = true

  try {
    const finalReport = await inspectIpAddress(ip, {
      signal: controller.signal,
      onUpdate: (partial) => {
        if (!controller.signal.aborted) {
          report.value = partial
        }
      },
    })
    if (!controller.signal.aborted) {
      report.value = finalReport
    }
  } finally {
    if (inspectController === controller) {
      inspecting.value = false
    }
  }
}

function selectExitSlot(slot: ExitEndpointResult, isManual = true) {
  if (slot.status !== 'ok' || !slot.ip) return
  if (isManual) {
    hasUserSelection.value = true
    selectionSource.value = 'exit'
    queryError.value = ''
    resolvedDomain.value = ''
    resolvedDomainIps.value = []
  } else {
    selectionSource.value = 'auto'
  }
  selectedExitId.value = slot.id
  if (selectedIp.value === slot.ip && report.value) return
  void runInspection(slot.ip)
}

function returnToClientExit() {
  const priorityOrder: ExitSlotId[] = ['global-v4', 'domestic', 'cloudflare', 'ipv6']
  for (const id of priorityOrder) {
    const slot = exitSlots.value.find((item) => item.id === id && item.status === 'ok')
    if (slot) {
      hasUserSelection.value = false
      queryError.value = ''
      queryInput.value = ''
      resolvedDomain.value = ''
      resolvedDomainIps.value = []
      selectExitSlot(slot, false)
      return
    }
  }
  void runExitProbe()
}

async function submitQuery() {
  queryError.value = ''
  const parsed = normalizeQueryInput(queryInput.value)
  if (parsed.kind === 'empty') {
    returnToClientExit()
    return
  }
  if (parsed.kind === 'invalid') {
    queryError.value = '请输入合法的 IPv4、IPv6 地址或域名（例如 1.1.1.1 或 cloudflare.com）。'
    return
  }

  hasUserSelection.value = true
  selectionSource.value = 'custom'
  selectedExitId.value = null

  if (parsed.kind === 'ip') {
    resolvedDomain.value = ''
    resolvedDomainIps.value = []
    await runInspection(parsed.value)
    return
  }

  // Domain resolution via DoH
  queryController?.abort()
  const controller = new AbortController()
  queryController = controller
  queryResolving.value = true
  resolvedDomain.value = parsed.value
  resolvedDomainIps.value = []

  try {
    const ips = await resolveDomainIps(parsed.value, controller.signal)
    if (controller.signal.aborted) return
    if (ips.length === 0) {
      queryError.value = `未通过 DoH 解析到「${parsed.value}」的 A 或 AAAA 记录。`
      return
    }
    resolvedDomainIps.value = ips
    const primary = ips[0]
    if (primary) {
      await runInspection(primary)
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      queryError.value =
        error instanceof Error && error.message
          ? `域名解析失败（${error.message}）`
          : '域名解析失败，请稍后重试。'
    }
  } finally {
    if (queryController === controller) {
      queryResolving.value = false
    }
  }
}

function quickLookup(sample: string) {
  queryInput.value = sample
  void submitQuery()
}

function selectDomainIp(ip: string) {
  hasUserSelection.value = true
  selectionSource.value = 'custom'
  selectedExitId.value = null
  void runInspection(ip)
}

async function runExitProbe() {
  exitController?.abort()
  const controller = new AbortController()
  exitController = controller
  exitSlots.value = createInitialExitSlots()

  await probeAllClientExits({
    signal: controller.signal,
    onSlotUpdate: (updatedSlot) => {
      if (controller.signal.aborted) return
      exitSlots.value = exitSlots.value.map((item) =>
        item.id === updatedSlot.id ? updatedSlot : item,
      )

      if (hasUserSelection.value || updatedSlot.status !== 'ok' || !updatedSlot.ip) {
        return
      }

      // Auto-select first available exit; upgrade to global-v4 when it arrives for richer overseas risk data
      if (!selectedIp.value) {
        selectExitSlot(updatedSlot, false)
      } else if (updatedSlot.id === 'global-v4' && selectedExitId.value !== 'global-v4') {
        selectExitSlot(updatedSlot, false)
      }
    },
  })
}

async function runWebRtcProbe() {
  webrtcController?.abort()
  const controller = new AbortController()
  webrtcController = controller
  webrtc.value = {
    status: 'running',
    publicIps: [],
    localIps: [],
  }

  const result = await probeWebRtcIps({ signal: controller.signal })
  if (!controller.signal.aborted) {
    webrtc.value = result
  }
}

function refreshAll() {
  hasUserSelection.value = selectionSource.value === 'custom'
  if (selectionSource.value === 'custom' && selectedIp.value) {
    void runInspection(selectedIp.value)
  } else {
    selectedIp.value = ''
    selectedExitId.value = null
    report.value = null
    void runExitProbe()
  }
  void runWebRtcProbe()
}

const nativeBadge = computed(() => {
  const current = report.value
  if (!current) {
    return { label: '分析中', variant: 'outline' as const }
  }
  if (current.nativeStatus === 'native') {
    return {
      label: current.rirCountry ? `原生 IP (${current.rirCountry})` : '原生 IP',
      variant: 'accent' as const,
    }
  }
  if (current.nativeStatus === 'broadcast') {
    return {
      label:
        current.rirCountry && current.countryCode
          ? `广播 IP (${current.rirCountry} → ${current.countryCode})`
          : '广播 IP',
      variant: 'accent-alt' as const,
    }
  }
  if (current.nativeStatus === 'bogon') {
    return { label: '保留 / 内网地址', variant: 'neutral' as const }
  }
  return { label: current.rirLoading ? 'RIR 比对中…' : '原生属性待定', variant: 'outline' as const }
})

const usageLabel = computed(() => {
  const usage = report.value?.usageType
  if (usage === 'datacenter') return '数据中心 (IDC)'
  if (usage === 'residential') return '家庭 / 商业宽带'
  if (usage === 'mobile') return '移动蜂窝网络'
  if (usage === 'bogon') return '私有 / 保留网段'
  return '类型检测中 / 未知'
})

const riskTier = computed(() => {
  const score = report.value?.riskScore
  if (score === null || score === undefined) {
    return {
      label: '暂无评分',
      variant: 'outline' as const,
      statTone: 'default' as const,
      progressTone: 'default' as const,
    }
  }
  if (score >= 65) {
    return {
      label: '高风险',
      variant: 'accent-alt' as const,
      statTone: 'accent-alt' as const,
      progressTone: 'danger' as const,
    }
  }
  if (score >= 25) {
    return {
      label: '中等风险',
      variant: 'outline' as const,
      statTone: 'default' as const,
      progressTone: 'default' as const,
    }
  }
  if (score > 0) {
    return {
      label: '低风险',
      variant: 'accent' as const,
      statTone: 'accent' as const,
      progressTone: 'accent' as const,
    }
  }
  return {
    label: '纯净极佳',
    variant: 'accent' as const,
    statTone: 'accent' as const,
    progressTone: 'accent' as const,
  }
})

const riskMatrixItems = computed(() => {
  const current = report.value
  const f = current?.flags
  const flagState = (val: boolean | null | undefined, positiveLabel = '是') => {
    if (val === true) return { text: positiveLabel, variant: 'accent-alt' as const }
    if (val === false) return { text: '未检出', variant: 'neutral' as const }
    return { text: '未知', variant: 'outline' as const }
  }
  const nativeState = () => {
    if (!current || current.nativeStatus === 'unknown') {
      return { text: '待定', variant: 'outline' as const }
    }
    if (current.nativeStatus === 'native') return { text: '原生 IP', variant: 'accent' as const }
    if (current.nativeStatus === 'broadcast') {
      return { text: '广播 IP', variant: 'accent-alt' as const }
    }
    return { text: '保留段', variant: 'neutral' as const }
  }

  return [
    { key: 'idc', label: '机房 / 数据中心', ...flagState(f?.isDatacenter, 'IDC 机房') },
    { key: 'proxy', label: '代理网关 (Proxy)', ...flagState(f?.isProxy, '已标记') },
    { key: 'vpn', label: 'VPN 节点', ...flagState(f?.isVpn, '已标记') },
    { key: 'tor', label: 'Tor 匿名出口', ...flagState(f?.isTor, '已标记') },
    { key: 'mobile', label: '移动网络', ...flagState(f?.isMobile, '移动蜂窝') },
    { key: 'native', label: 'IP 原生度', ...nativeState() },
  ]
})

const databaseConsensus = computed(() => {
  const current = report.value
  if (!current) return { text: '等待检测', variant: 'outline' as const }
  const settled = current.databases.filter(
    (db) => db.status === 'ok' && db.countryCode.length === 2,
  )
  if (settled.length === 0) {
    const anyLoading = current.databases.some((db) => db.status === 'loading')
    return {
      text: anyLoading ? '多源交叉校验中…' : '暂无可比对 ISO 国家码',
      variant: 'outline' as const,
    }
  }
  const uniqueCodes = new Set(settled.map((db) => db.countryCode))
  if (uniqueCodes.size === 1) {
    const code = settled[0]?.countryCode ?? ''
    return {
      text: `${settled.length}/${settled.length} 源国家判定一致 (${code})`,
      variant: 'accent' as const,
    }
  }
  return {
    text: `检测到 ${uniqueCodes.size} 种国家判定 (${Array.from(uniqueCodes).join(' / ')})`,
    variant: 'accent-alt' as const,
  }
})

const splitRouteAudit = computed(() => {
  const dom = exitSlots.value.find((s) => s.id === 'domestic')
  const global = exitSlots.value.find((s) => s.id === 'global-v4')
  if (!dom || !global || dom.status === 'loading' || global.status === 'loading') {
    return { label: '分流检测中…', variant: 'outline' as const, detail: '正在对比国内外出口路径' }
  }
  if (dom.status !== 'ok' || global.status !== 'ok') {
    return { label: '部分链路不可用', variant: 'outline' as const, detail: '仅单侧出口探测成功' }
  }
  if (dom.ip === global.ip) {
    return {
      label: '直连 / 统一出口',
      variant: 'neutral' as const,
      detail: `国内外检测返回同一出口 ${displayIp(dom.ip)}`,
    }
  }
  return {
    label: '国内外分流已生效',
    variant: 'accent' as const,
    detail: `国内 ${displayIp(dom.ip)} · 海外 ${displayIp(global.ip)}`,
  }
})

const timezoneConsistency = computed(() => {
  const ipTz = report.value?.timezone ?? ''
  if (!ipTz) {
    return {
      label: '暂无 IP 时区',
      variant: 'outline' as const,
      detail: `系统：${browserTimezone.value}`,
    }
  }
  if (ipTz === browserTimezone.value) {
    return { label: '时区一致', variant: 'accent' as const, detail: `${ipTz}` }
  }
  return {
    label: '时区存在差异',
    variant: 'accent-alt' as const,
    detail: `系统 ${browserTimezone.value} vs IP ${ipTz}`,
  }
})

const webrtcLeakAudit = computed(() => {
  if (webrtc.value.status === 'idle' || webrtc.value.status === 'running') {
    return { label: 'STUN 探测中…', variant: 'outline' as const }
  }
  if (webrtc.value.status === 'unsupported') {
    return { label: '浏览器未启用 WebRTC', variant: 'neutral' as const }
  }
  if (webrtc.value.publicIps.length === 0) {
    return { label: '未暴露公网 WebRTC IP', variant: 'accent' as const }
  }
  const domesticIp = exitSlots.value.find((s) => s.id === 'domestic' && s.status === 'ok')?.ip
  const globalIp = exitSlots.value.find((s) => s.id === 'global-v4' && s.status === 'ok')?.ip
  const knownProxied = globalIp && domesticIp && globalIp !== domesticIp
  const exposesDomestic = Boolean(
    knownProxied && domesticIp && webrtc.value.publicIps.includes(domesticIp),
  )
  if (exposesDomestic) {
    return { label: '检测到疑似真实 IP 泄露', variant: 'accent-alt' as const }
  }
  return { label: `发现 ${webrtc.value.publicIps.length} 个公网候选`, variant: 'neutral' as const }
})

const activeTargetLabel = computed(() => {
  if (isCustomTarget.value) {
    return resolvedDomain.value ? `域名解析 (${resolvedDomain.value})` : '自定义查询'
  }
  const slot = exitSlots.value.find((s) => s.id === selectedExitId.value)
  return slot ? `${slot.label}` : '本机默认出口'
})

function saveBlobDownload(blobPromise: Promise<Blob>) {
  return blobPromise
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const stamp = new Date().toISOString().slice(0, 19).replace(RE_TIMESTAMP_SEPARATORS, '-')
      link.download = `ip-check-${stamp}.png`
      link.click()
      URL.revokeObjectURL(url)
      toast({
        title: '检测报告截图已保存',
        description: '已自动隐藏敏感 IP、精确坐标与运营商详情。',
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
  if (!node || !report.value || capturing.value) return

  const previousRedacted = redacted.value
  redacted.value = true
  capturing.value = true
  await nextTick()

  const bgColor = getComputedStyle(document.body).backgroundColor || undefined
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
        title: '检测截图已复制到剪贴板',
        description: '敏感 IP 与详细定位已自动打码隐藏。',
        variant: 'success',
      })
    })
    .catch(() => saveBlobDownload(imagePromise))
}

onMounted(() => {
  void runExitProbe()
  void runWebRtcProbe()
})

onBeforeUnmount(() => {
  exitController?.abort()
  inspectController?.abort()
  queryController?.abort()
  webrtcController?.abort()
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
  <div ref="captureRoot" class="space-y-5 pb-10">
    <ToolPageHeader
      title="IP 归属与质量检测"
      description="自动识别本机国内外分流及 IPv4 / IPv6 双栈出口；支持任意 IP 或域名查询、多库交叉对比、原生/广播识别、风险评分、BGP / C 段画像与 WebRTC 泄露检测。"
      badge="IPLark 风格"
      :icon="Radar"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2" data-screenshot="hide">
          <Toggle v-model="redacted" size="sm" aria-label="隐藏敏感 IP 与详细定位">
            <EyeOff v-if="redacted" class="size-3.5" />
            <Eye v-else class="size-3.5" />
            <span>{{ redacted ? '已隐藏敏感信息' : '隐藏敏感 IP' }}</span>
          </Toggle>

          <Button variant="secondary" size="sm" @click="refreshAll">
            <template #leading>
              <RefreshCw class="size-3.5" />
            </template>
            重新检测
          </Button>

          <Button
            variant="secondary"
            size="sm"
            :disabled="!report || capturing"
            @click="captureScreenshot"
          >
            <template #leading>
              <Camera class="size-3.5" />
            </template>
            保存截图
          </Button>
        </div>
      </template>
    </ToolPageHeader>

    <!-- Search / Arbitrary IP & Domain Query -->
    <Card data-screenshot="hide">
      <CardContent class="space-y-3 pt-5">
        <form class="flex flex-col gap-2.5 sm:flex-row" @submit.prevent="submitQuery">
          <div class="relative flex-1">
            <Search
              class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <Input
              v-model="queryInput"
              :invalid="Boolean(queryError)"
              type="text"
              placeholder="输入任意 IPv4 / IPv6 地址或域名（如 1.1.1.1、2606:4700::1111、cloudflare.com）"
              aria-label="查询 IP 地址或域名"
              class="pl-10"
            />
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Button type="submit" variant="primary" :loading="queryResolving">
              <template #leading>
                <Search class="size-4" />
              </template>
              查询分析
            </Button>

            <Button
              v-if="isCustomTarget"
              type="button"
              variant="secondary"
              @click="returnToClientExit"
            >
              <template #leading>
                <RotateCcw class="size-4" />
              </template>
              返回本机出口
            </Button>
          </div>
        </form>

        <p v-if="queryError" class="text-[13px] text-danger" role="alert">
          {{ queryError }}
        </p>

        <div class="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-muted">
          <div class="flex flex-wrap items-center gap-1.5">
            <span>示例查询：</span>
            <button
              v-for="sample in ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']"
              :key="sample"
              type="button"
              class="rounded-control border border-line bg-control px-2.5 py-0.5 font-condensed text-ink transition-colors hover:border-ink"
              @click="quickLookup(sample)"
            >
              {{ sample }}
            </button>
          </div>

          <div
            v-if="resolvedDomain && resolvedDomainIps.length"
            class="flex flex-wrap items-center gap-1.5"
          >
            <span>{{ resolvedDomain }} 解析结果：</span>
            <button
              v-for="itemIp in resolvedDomainIps"
              :key="itemIp"
              type="button"
              :class="
                cn(
                  'rounded-control border px-2 py-0.5 font-condensed transition-colors',
                  selectedIp === itemIp
                    ? 'border-accent bg-accent text-surface'
                    : 'border-line bg-raised text-ink hover:border-ink',
                )
              "
              @click="selectDomainIp(itemIp)"
            >
              {{ displayIp(itemIp) }}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Local Multi-Exit & Dual-Stack Cards -->
    <section aria-label="本机多路出口检测" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="slot in exitSlots"
        :key="slot.id"
        role="button"
        :tabindex="slot.status === 'ok' ? 0 : -1"
        :class="
          cn(
            'group flex flex-col justify-between rounded-panel border bg-raised p-4 text-left outline-none transition-[border-color,background-color] duration-[var(--p0seid0n-duration-normal)]',
            slot.status === 'ok'
              ? 'cursor-pointer hover:border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-line))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid'
              : 'cursor-default opacity-80',
            selectedIp && selectedIp === slot.ip && !isCustomTarget
              ? 'border-accent ring-1 ring-accent'
              : 'border-line',
          )
        "
        @click="selectExitSlot(slot, true)"
        @keydown.enter.prevent="selectExitSlot(slot, true)"
        @keydown.space.prevent="selectExitSlot(slot, true)"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[13px] font-medium text-ink-muted">{{ slot.label }}</span>
            <Badge v-if="selectedIp && selectedIp === slot.ip && !isCustomTarget" variant="accent">
              当前分析
            </Badge>
            <Badge v-else-if="slot.status === 'ok' && slot.latencyMs !== null" variant="neutral">
              {{ slot.latencyMs }} ms
            </Badge>
            <Badge v-else-if="slot.status === 'unavailable'" variant="outline">不可用</Badge>
          </div>

          <div v-if="slot.status === 'loading'" class="mt-2.5 space-y-2">
            <Skeleton class="h-6 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </div>

          <div v-else-if="slot.status === 'ok'" class="mt-2 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-condensed text-[19px] font-semibold text-ink tabular-nums">
                {{ displayIp(slot.ip) }}
              </span>
              <button
                type="button"
                data-screenshot="hide"
                class="shrink-0 rounded-[8px] p-1 text-ink-muted transition-colors hover:bg-control hover:text-ink"
                :aria-label="`复制${slot.label}`"
                @click.stop="copyText(slot.ip, `exit-${slot.id}`, slot.label)"
              >
                <Check v-if="copiedKey === `exit-${slot.id}`" class="size-3.5 text-accent" />
                <Copy v-else class="size-3.5" />
              </button>
            </div>
            <p class="truncate text-[12px] text-ink-muted">
              <span v-if="slot.countryCode" class="mr-1">{{
                countryCodeToFlag(slot.countryCode)
              }}</span>
              {{ slot.location || slot.subtitle }}
            </p>
          </div>

          <div v-else class="mt-2 space-y-1">
            <p class="text-[14px] font-medium text-ink-faint">未检测到连通</p>
            <p class="truncate text-[12px] text-ink-faint">{{ slot.error || slot.subtitle }}</p>
          </div>
        </div>

        <div
          class="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-ink-faint"
        >
          <span class="truncate">{{
            redacted && slot.isp ? '运营商已隐藏' : slot.isp || slot.subtitle
          }}</span>
          <span v-if="slot.extra" class="shrink-0 font-condensed">{{ slot.extra }}</span>
        </div>
      </div>
    </section>

    <Alert
      v-if="!hasAnyExitIp && exitSlots.every((s) => s.status !== 'loading') && !report"
      variant="danger"
    >
      <AlertTriangle class="size-4 text-danger" />
      <AlertTitle>未能获取本机公网出口</AlertTitle>
      <AlertDescription>
        请检查当前网络连接或广告拦截规则，也可以在上方搜索框输入任意 IP（如 1.1.1.1）进行查询。
      </AlertDescription>
    </Alert>

    <!-- Core IP Profile + Risk Score Panel -->
    <section v-if="report" class="grid gap-4 lg:grid-cols-12">
      <!-- Left: IP Profile, Routing & RIR -->
      <Card class="lg:col-span-7">
        <CardHeader>
          <template #title>
            <div class="flex items-center gap-2">
              <Globe class="size-4 text-accent" />
              <span>核心 IP 画像与路由信息</span>
            </div>
          </template>
          <template #description>
            <p class="text-[12px] text-ink-muted">
              检测对象：{{ activeTargetLabel }}
              <span v-if="inspecting"> · 正在汇总各数据源…</span>
            </p>
          </template>
          <template #action>
            <Button
              variant="secondary"
              size="sm"
              data-screenshot="hide"
              @click="copyText(report.ip, 'main-ip', '当前 IP')"
            >
              <template #leading>
                <Check v-if="copiedKey === 'main-ip'" class="size-3.5 text-accent" />
                <Copy v-else class="size-3.5" />
              </template>
              复制 IP
            </Button>
          </template>
        </CardHeader>

        <CardContent class="space-y-5">
          <!-- Hero Address & Badges -->
          <div class="rounded-panel border border-line bg-surface p-4">
            <div class="flex flex-wrap items-center gap-2.5">
              <span v-if="report.countryCode" class="text-2xl leading-none" aria-hidden="true">
                {{ countryCodeToFlag(report.countryCode) }}
              </span>
              <span
                class="break-all font-condensed text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-[28px]"
              >
                {{ displayIp(report.ip) }}
              </span>
              <Badge variant="neutral">IPv{{ report.ipVersion }}</Badge>
              <Badge :variant="nativeBadge.variant">{{ nativeBadge.label }}</Badge>
              <Badge variant="outline">{{ usageLabel }}</Badge>
            </div>

            <p
              v-if="report.nativeStatus === 'broadcast'"
              class="mt-2.5 text-[12px] leading-relaxed text-ink-muted"
            >
              该 IP 在区域互联网注册局 (RIR) 的登记国家为
              <strong class="text-ink">{{ report.rirCountry }}</strong
              >，当前物理/任播落地定位在 <strong class="text-ink">{{ report.countryCode }}</strong
              >，通常为跨区广播网段或全球 Anycast 节点。
            </p>
          </div>

          <!-- Structured Detail Grid -->
          <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-[12px] font-medium text-ink-muted">物理归属地</dt>
              <dd class="mt-1 text-[14px] font-medium text-ink">
                <template v-if="redacted">
                  {{ report.country || report.countryCode || '—' }}
                </template>
                <template v-else>
                  {{
                    [report.country, report.region, report.city].filter(Boolean).join(' · ') || '—'
                  }}
                </template>
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">时区与坐标</dt>
              <dd class="mt-1 text-[14px] text-ink">
                <span>{{ report.timezone || '—' }}</span>
                <span
                  v-if="report.coordinates && !redacted"
                  class="ml-2 font-condensed text-[13px] text-ink-muted tabular-nums"
                >
                  ({{ report.coordinates }})
                </span>
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">ASN 与所属机构</dt>
              <dd class="mt-1 text-[14px] font-medium text-ink">
                <template v-if="redacted">已隐藏</template>
                <template v-else>
                  <span v-if="report.asn" class="font-condensed">AS{{ report.asn }}</span>
                  <span v-if="report.asnOrg" class="ml-1.5 font-normal text-ink-muted">{{
                    report.asnOrg
                  }}</span>
                  <span v-if="!report.asn && !report.asnOrg">—</span>
                </template>
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">ISP 运营商</dt>
              <dd class="mt-1 text-[14px] text-ink">
                {{ redacted ? '已隐藏' : report.isp || '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">BGP 路由前缀</dt>
              <dd class="mt-1 text-[14px] text-ink">
                <Skeleton v-if="report.bgpLoading" class="h-5 w-36" />
                <template v-else>
                  <span class="font-condensed tabular-nums">
                    {{
                      redacted && report.bgpPrefix
                        ? maskSegment(report.bgpPrefix)
                        : report.bgpPrefix || '未公布 / 未知'
                    }}
                  </span>
                  <span
                    v-if="!redacted && report.relatedPrefixes.length"
                    class="ml-1.5 text-[12px] text-ink-muted"
                  >
                    (上层 {{ report.relatedPrefixes[0] }})
                  </span>
                </template>
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">C 段网段画像</dt>
              <dd class="mt-1 font-condensed text-[14px] text-ink tabular-nums">
                {{ redacted ? maskSegment(report.cSegment) : report.cSegment || '—' }}
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">RIR 注册信息</dt>
              <dd class="mt-1 text-[14px] text-ink">
                <Skeleton v-if="report.rirLoading" class="h-5 w-40" />
                <template v-else-if="report.rir">
                  <span class="font-medium">{{ report.rir }}</span>
                  <span v-if="report.rirCountry" class="ml-1.5 text-ink-muted"
                    >({{ report.rirCountry }})</span
                  >
                  <span v-if="report.allocationDate" class="ml-1.5 text-[12px] text-ink-muted">
                    · {{ report.allocationDate }}
                  </span>
                </template>
                <span v-else>—</span>
              </dd>
            </div>

            <div>
              <dt class="text-[12px] font-medium text-ink-muted">PTR 反向解析</dt>
              <dd class="mt-1 break-all text-[14px] text-ink">
                <Skeleton v-if="report.ptrLoading" class="h-5 w-36" />
                <template v-else>
                  {{
                    redacted ? (report.ptr ? '已隐藏' : '无 PTR 记录') : report.ptr || '无 PTR 记录'
                  }}
                </template>
              </dd>
            </div>

            <div class="sm:col-span-2">
              <dt class="text-[12px] font-medium text-ink-muted">数字地址 (Numeric IP)</dt>
              <dd class="mt-1 flex items-center gap-2">
                <span class="break-all font-condensed text-[14px] text-ink tabular-nums">
                  {{ redacted ? '***' : report.numericIp || '—' }}
                </span>
                <button
                  v-if="report.numericIp && !redacted"
                  type="button"
                  data-screenshot="hide"
                  class="rounded-[6px] p-1 text-ink-muted transition-colors hover:bg-control hover:text-ink"
                  aria-label="复制数字地址"
                  @click="copyText(report.numericIp, 'numeric-ip', '数字地址')"
                >
                  <Check v-if="copiedKey === 'numeric-ip'" class="size-3.5 text-accent" />
                  <Copy v-else class="size-3.5" />
                </button>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <!-- Right: Risk Score & Security Feature Matrix -->
      <Card class="lg:col-span-5">
        <CardHeader>
          <template #title>
            <div class="flex items-center gap-2">
              <ShieldAlert v-if="riskTier.variant === 'accent-alt'" class="size-4 text-danger" />
              <ShieldCheck v-else class="size-4 text-accent" />
              <span>纯净度与风险评估</span>
            </div>
          </template>
          <template #description>
            <p class="text-[12px] text-ink-muted">
              基于 IPQuery 风险评分、FreeIPAPI 代理检测与多库特征交叉计算
            </p>
          </template>
          <template #action>
            <Badge :variant="riskTier.variant">{{ riskTier.label }}</Badge>
          </template>
        </CardHeader>

        <CardContent class="space-y-5">
          <div class="rounded-panel border border-line bg-surface p-4">
            <div class="flex items-end justify-between gap-4">
              <Stat
                label="IP 风险评分 (0–100，越低越纯净)"
                :value="report.riskScore"
                unit="/ 100"
                :tone="riskTier.statTone"
              />
              <span class="text-[12px] text-ink-muted">
                {{
                  report.riskScore === null
                    ? '等待风险库响应'
                    : report.riskScore === 0
                      ? '无已知滥用记录'
                      : `风险分值 ${report.riskScore}`
                }}
              </span>
            </div>
            <Progress
              class="mt-3"
              :model-value="report.riskScore"
              :tone="riskTier.progressTone"
              aria-label="IP 风险评分进度条"
            />
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div
              v-for="item in riskMatrixItems"
              :key="item.key"
              class="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2.5"
            >
              <span class="text-[12px] text-ink-muted">{{ item.label }}</span>
              <Badge :variant="item.variant">{{ item.text }}</Badge>
            </div>
          </div>

          <div
            class="rounded-control border border-line bg-surface px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-muted"
          >
            <span class="font-medium text-ink">判定说明：</span>
            <span
              >原生 IP 指 RIR 注册国家与实际落地国家一致；数据中心 IP
              通常托管于云计算机房，可能触发部分流媒体或风控校验。</span
            >
          </div>
        </CardContent>
      </Card>
    </section>

    <!-- Multi-Database Comparison Table -->
    <Card v-if="report">
      <CardHeader>
        <template #title>
          <div class="flex items-center gap-2">
            <Network class="size-4 text-accent" />
            <span>多源数据库归属地对比</span>
          </div>
        </template>
        <template #description>
          <p class="text-[12px] text-ink-muted">
            同时对比 6 家开源及公共 IP 数据库对 {{ displayIp(report.ip) }} 的归属地与运营商判定
          </p>
        </template>
        <template #action>
          <Badge :variant="databaseConsensus.variant">{{ databaseConsensus.text }}</Badge>
        </template>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>数据源</TableHead>
              <TableHead>国家 / 地区</TableHead>
              <TableHead>省州 · 城市</TableHead>
              <TableHead>ISP / 机构</TableHead>
              <TableHead>ASN</TableHead>
              <TableHead>坐标 / 时区</TableHead>
              <TableHead align="right">耗时</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="db in report.databases" :key="db.id">
              <TableCell class="font-medium text-ink whitespace-nowrap">
                {{ db.sourceName }}
              </TableCell>

              <template v-if="db.status === 'loading'">
                <TableCell colspan="6">
                  <Skeleton class="h-4 w-full max-w-md" />
                </TableCell>
              </template>

              <template v-else-if="db.status === 'error'">
                <TableCell colspan="6" class="text-[12px] text-ink-faint">
                  {{ db.error || '查询失败或超时' }}
                </TableCell>
              </template>

              <template v-else>
                <TableCell class="whitespace-nowrap">
                  <span v-if="db.countryCode" class="mr-1.5">{{
                    countryCodeToFlag(db.countryCode)
                  }}</span>
                  <span>{{ db.country || db.countryCode || '—' }}</span>
                </TableCell>
                <TableCell>
                  {{
                    redacted ? '已隐藏' : [db.region, db.city].filter(Boolean).join(' · ') || '—'
                  }}
                </TableCell>
                <TableCell class="max-w-56 truncate">
                  {{ redacted ? '已隐藏' : db.isp || '—' }}
                </TableCell>
                <TableCell class="font-condensed whitespace-nowrap tabular-nums">
                  {{ redacted ? '—' : db.asn || '—' }}
                </TableCell>
                <TableCell class="text-[12px] text-ink-muted whitespace-nowrap">
                  <template v-if="redacted">
                    {{ db.timezone || '—' }}
                  </template>
                  <template v-else>
                    {{ [db.coordinates, db.timezone].filter(Boolean).join(' · ') || '—' }}
                  </template>
                </TableCell>
                <TableCell
                  align="right"
                  class="font-condensed text-ink-muted tabular-nums whitespace-nowrap"
                >
                  {{ db.latencyMs !== null ? `${db.latencyMs} ms` : '—' }}
                </TableCell>
              </template>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- WebRTC Leak Detection & Environment Consistency -->
    <Card>
      <CardHeader>
        <template #title>
          <div class="flex items-center gap-2">
            <Wifi class="size-4 text-accent" />
            <span>WebRTC 泄露检测与环境一致性</span>
          </div>
        </template>
        <template #description>
          <p class="text-[12px] text-ink-muted">
            检测浏览器 WebRTC STUN 连接是否暴露真实公网/局域网地址，并对比分流策略与系统时区语言
          </p>
        </template>
        <template #action>
          <Button
            variant="secondary"
            size="sm"
            data-screenshot="hide"
            :disabled="webrtc.status === 'running'"
            @click="runWebRtcProbe"
          >
            <template #leading>
              <RefreshCw :class="cn('size-3.5', webrtc.status === 'running' && 'animate-spin')" />
            </template>
            重新探测 WebRTC
          </Button>
        </template>
      </CardHeader>

      <CardContent class="grid gap-4 lg:grid-cols-2">
        <!-- WebRTC Candidates -->
        <div class="space-y-3 rounded-panel border border-line bg-surface p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[14px] font-medium text-ink">WebRTC STUN 候选探测</span>
            <Badge :variant="webrtcLeakAudit.variant">{{ webrtcLeakAudit.label }}</Badge>
          </div>

          <div v-if="webrtc.status === 'running'" class="space-y-2 py-2">
            <Skeleton class="h-4 w-2/3" />
            <Skeleton class="h-4 w-1/2" />
          </div>

          <dl v-else class="space-y-2.5 text-[13px]">
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-muted">公网候选 IP</dt>
              <dd class="text-right font-condensed text-ink tabular-nums">
                <template v-if="webrtc.publicIps.length">
                  {{ webrtc.publicIps.map((item) => displayIp(item)).join('、') }}
                </template>
                <span v-else class="font-sans text-ink-faint"
                  >未检测到公网候选（已屏蔽或未响应）</span
                >
              </dd>
            </div>

            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-muted">内网 / mDNS</dt>
              <dd class="text-right font-condensed text-ink-muted tabular-nums">
                <template v-if="webrtc.localIps.length">
                  {{
                    redacted
                      ? `已隐藏 ${webrtc.localIps.length} 条本地候选`
                      : webrtc.localIps.join('、')
                  }}
                </template>
                <span v-else class="font-sans text-ink-faint">无</span>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Split Route & Fingerprint Consistency -->
        <div class="space-y-3 rounded-panel border border-line bg-surface p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[14px] font-medium text-ink">网络分流与环境核验</span>
            <Badge :variant="splitRouteAudit.variant">{{ splitRouteAudit.label }}</Badge>
          </div>

          <dl class="space-y-2.5 text-[13px]">
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-muted">国内外出口对比</dt>
              <dd class="text-right text-ink">{{ splitRouteAudit.detail }}</dd>
            </div>

            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-muted">时区一致性</dt>
              <dd class="flex items-center justify-end gap-2 text-right">
                <span class="text-ink-muted">{{ timezoneConsistency.detail }}</span>
                <Badge :variant="timezoneConsistency.variant">{{
                  timezoneConsistency.label
                }}</Badge>
              </dd>
            </div>

            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-muted">浏览器语言</dt>
              <dd class="text-right font-condensed text-ink">{{ browserLanguage }}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
