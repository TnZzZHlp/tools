<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  RouterLink,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Settings2,
  LoaderCircle,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ReaderText from '@/components/novels/ReaderText.vue'
import ReaderDirectory from '@/components/novels/ReaderDirectory.vue'
import { novelApi, errorMessage, type Novel, type Chapter } from '@/api/novels'
import {
  chapterPath,
  chapterTitle,
  novelTitle,
  novelOriginalTitle,
  progressKey,
  readProgress,
  chapterHistoryKey,
  readChapterHistory,
  chapterReadingStatus,
  type ChapterReadingHistory,
  readStored,
  writeStored,
  type ReadingMode,
} from '@/lib/novel-reader'
import { readerFonts, type ReaderFont } from '@/lib/reader-fonts'
import { useChapterTransition } from '@/lib/chapter-transition'
import { useReaderGestures } from '@/lib/reader-gestures'
import '@/styles/novel-reader.css'

interface Preferences {
  mode: ReadingMode
  fontSize: number
  fontWeight: number
  font: ReaderFont
  lineHeight: number
  paragraphGap: number
  width: number
  layout: 'scroll' | 'paged'
  theme: 'system' | 'paper' | 'dark'
  mobileVersion: 'source' | 'target'
}
const preferences = readStored<Partial<Omit<Preferences, 'font'>> & { font?: string }>(
  'novel-reader-preferences',
)
function numberPreference(key: keyof Preferences, fallback: number, min: number, max: number) {
  const value = preferences?.[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback
}
const route = useRoute()
const router = useRouter()
const novel = ref<Novel | null>(null)
const chapter = ref<Chapter | null>(null)
const loading = ref(false)
const pendingAction = ref<'previous' | 'next' | 'directory' | null>(null)
const error = ref('')
const {
  scope: readerScope,
  phase: chapterPhase,
  direction: chapterDirection,
  layout: chapterTransitionLayout,
  leave: leaveChapter,
  reveal: revealChapter,
  cancel: cancelChapterTransition,
} = useChapterTransition()
const mode = ref<ReadingMode>(
  preferences?.mode === 'source' || preferences?.mode === 'parallel' ? preferences.mode : 'target',
)
const fontSize = ref(numberPreference('fontSize', 20, 16, 30))
const fontWeights = [
  { value: 300, label: '细体' },
  { value: 400, label: '常规' },
  { value: 500, label: '中等' },
] as const
const fontWeight = ref(
  fontWeights.some((item) => item.value === preferences?.fontWeight)
    ? preferences!.fontWeight!
    : 400,
)
const fontWeightLabel = computed(
  () => fontWeights.find((item) => item.value === fontWeight.value)?.label || '常规',
)
const font = ref<ReaderFont>(
  preferences?.font === 'fz-shusong'
    ? 'source-han-serif'
    : readerFonts.find((item) => item.value === preferences?.font)?.value || 'serif',
)
const selectedFont = computed(
  () => readerFonts.find((item) => item.value === font.value) || readerFonts[0],
)
const fontStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const lineHeight = ref(numberPreference('lineHeight', 1.9, 1.5, 2.4))
const paragraphGap = ref(numberPreference('paragraphGap', 1, 0.6, 1.4))
const width = ref(numberPreference('width', 760, 640, 900))
const layout = ref<Preferences['layout']>(preferences?.layout === 'paged' ? 'paged' : 'scroll')
const theme = ref<Preferences['theme']>(
  preferences?.theme === 'paper' || preferences?.theme === 'dark' ? preferences.theme : 'system',
)
const mobileVersion = ref<'source' | 'target'>(
  preferences?.mobileVersion === 'source' ? 'source' : 'target',
)
const isMobile = useMediaQuery('(max-width: 1023px)')
const systemDark = ref(document.documentElement.classList.contains('dark'))
const resolvedTheme = computed(() =>
  theme.value === 'system' ? (systemDark.value ? 'dark' : 'paper') : theme.value,
)
const effectiveMode = computed(() =>
  isMobile.value && mode.value === 'parallel' ? mobileVersion.value : mode.value,
)
const selectedVersion = computed({
  get: () => effectiveMode.value,
  set: (value: ReadingMode) => {
    if (isMobile.value && mode.value === 'parallel' && value !== 'parallel')
      mobileVersion.value = value
    else mode.value = value
  },
})
const hasSource = computed(() => Boolean(chapter.value?.source_content?.trim()))
const hasTarget = computed(() => Boolean(chapter.value?.target_content?.trim()))
const hasReadableContent = computed(() =>
  effectiveMode.value === 'source'
    ? hasSource.value
    : effectiveMode.value === 'target'
      ? hasTarget.value
      : hasSource.value || hasTarget.value,
)
const sourceText = ref<InstanceType<typeof ReaderText>>()
const targetText = ref<InstanceType<typeof ReaderText>>()
const sourcePages = ref(1)
const targetPages = ref(1)
const pageNumber = ref(0)
const totalPages = computed(() => Math.max(sourcePages.value, targetPages.value))
const fraction = ref(0)
const progressPercent = computed(() =>
  Math.round(
    layout.value === 'paged'
      ? ((pageNumber.value + 1) / totalPages.value) * 100
      : fraction.value * 100,
  ),
)
const chapterHistory = ref<ChapterReadingHistory>({})
const currentReadingStatus = computed(() =>
  chapterReadingStatus(chapter.value ? chapterHistory.value[chapter.value.id] : undefined),
)
const toolsVisible = ref(true)
const settingsOpen = ref(false)
const directoryOpen = ref(false)
const readerStyle = computed(() => ({
  '--reader-font-size': `${fontSize.value}px`,
  '--reader-font-weight': String(fontWeight.value),
  '--reader-line-height': String(lineHeight.value),
  '--reader-paragraph-gap': `${paragraphGap.value}em`,
  '--reader-width': `${effectiveMode.value === 'parallel' ? Math.min(width.value * 2, 1280) : width.value}px`,
  '--reader-font': selectedFont.value.family,
}))
let controller: AbortController | undefined
let themeObserver: MutationObserver | undefined
let scrollTimer: ReturnType<typeof setTimeout> | undefined
let layoutFrame = 0
let restoring = true
let anchors: Partial<Record<'source' | 'target', number>> = {}
let legacyScroll: number | undefined
let preferenceRevision = 0
let fontRequest = 0
let lastScrollY = window.scrollY
const autoNavigating = ref(false)
let autoNextTarget: string | undefined
const gestures = useReaderGestures({
  layout,
  toolsVisible,
  chapterId: () => chapter.value?.id,
  blocked: () =>
    Boolean(
      settingsOpen.value ||
      directoryOpen.value ||
      error.value ||
      !chapter.value ||
      !hasReadableContent.value,
    ),
  busy: () => loading.value || restoring || autoNavigating.value,
  atEnd: () =>
    layout.value === 'paged'
      ? pageNumber.value >= totalPages.value - 1
      : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
  turnPage,
  nextChapter() {
    if (!novel.value || !chapter.value?.next || String(route.params.chapterId) !== chapter.value.id)
      return
    autoNavigating.value = true
    autoNextTarget = chapter.value.next.id
    void router
      .push(chapterPath(novel.value.id, chapter.value.next.id))
      .catch((cause) => {
        autoNextTarget = undefined
        error.value = errorMessage(cause)
      })
      .finally(() => {
        autoNavigating.value = false
      })
  },
})

function currentPreferences() {
  return {
    mode: mode.value,
    mobileVersion: mobileVersion.value,
    fontSize: fontSize.value,
    fontWeight: fontWeight.value,
    font: font.value,
    lineHeight: lineHeight.value,
    paragraphGap: paragraphGap.value,
    width: width.value,
    layout: layout.value,
    theme: theme.value,
  }
}
function capturePosition() {
  if (!chapter.value || loading.value || restoring) return
  if (sourceText.value) anchors.source = sourceText.value.capture()
  if (targetText.value) anchors.target = targetText.value.capture()
  const primary = targetText.value || sourceText.value
  const offset = targetText.value ? anchors.target : anchors.source
  fraction.value = primary?.length ? Math.min(1, (offset || 0) / primary.length) : 0
  if (
    layout.value === 'scroll' &&
    window.scrollY > 0 &&
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
  )
    fraction.value = 1
}
function persistProgress() {
  if (!chapter.value || loading.value || restoring) return
  writeStored(progressKey(chapter.value.novel_id), {
    chapterId: chapter.value.id,
    chapterNo: chapter.value.chapter_no,
    scroll: Math.max(0, window.scrollY),
    anchors: { ...anchors },
    fraction: fraction.value,
  })
  if (hasReadableContent.value) {
    const readFraction =
      layout.value === 'paged' ? (pageNumber.value + 1) / totalPages.value : fraction.value
    chapterHistory.value[chapter.value.id] = Math.max(
      chapterHistory.value[chapter.value.id] ?? 0,
      readFraction,
    )
  }
  writeStored(chapterHistoryKey(chapter.value.novel_id), chapterHistory.value)
}
function saveProgress() {
  if (layout.value === 'scroll') capturePosition()
  persistProgress()
}
function onScroll() {
  const delta = Math.abs(window.scrollY - lastScrollY)
  lastScrollY = window.scrollY
  if (
    layout.value !== 'scroll' ||
    restoring ||
    loading.value ||
    settingsOpen.value ||
    directoryOpen.value
  )
    return
  if (delta >= 4) toolsVisible.value = false
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = undefined
    saveProgress()
  }, 150)
}
function restorePosition() {
  sourcePages.value = sourceText.value ? sourcePages.value : 1
  targetPages.value = targetText.value ? targetPages.value : 1
  const entries = (['source', 'target'] as const)
    .map((key) => ({ key, text: key === 'source' ? sourceText.value : targetText.value }))
    .filter((entry) => entry.text)
  for (const { key, text } of entries) {
    anchors[key] = Math.max(
      0,
      Math.min(text!.length - 1, anchors[key] ?? Math.floor(fraction.value * text!.length)),
    )
  }
  const primary = entries.find(({ key }) => key === 'target') || entries[0]
  if (primary?.text?.length) fraction.value = anchors[primary.key]! / primary.text.length
  if (layout.value === 'paged') {
    pageNumber.value = Math.max(
      0,
      ...entries.map(({ key, text }) => text!.pageForOffset(anchors[key]!)),
    )
    window.scrollTo({ top: 0, behavior: 'instant' })
  } else if (legacyScroll !== undefined) {
    window.scrollTo({ top: legacyScroll, behavior: 'instant' })
  } else {
    if (primary) primary.text!.restore(anchors[primary.key]!)
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }
  legacyScroll = undefined
  lastScrollY = window.scrollY
}
function onTextLayout(key: 'source' | 'target', pages: number, changed: boolean) {
  if (key === 'source') sourcePages.value = pages
  else targetPages.value = pages
  if (!changed || restoring || loading.value || !chapter.value) return
  cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(async () => {
    if (restoring || loading.value || !chapter.value) return
    restoring = true
    restorePosition()
    await nextTick()
    restoring = false
    persistProgress()
  })
}
function turnPage(delta: number) {
  const next = pageNumber.value + delta
  if (restoring || next < 0 || next >= totalPages.value) return
  pageNumber.value = next
  void nextTick(() => {
    capturePosition()
    persistProgress()
  })
}
function onKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    settingsOpen.value ||
    directoryOpen.value ||
    layout.value !== 'paged'
  )
    return
  const target = event.target as HTMLElement | null
  if (
    target?.closest(
      'button, a, input, select, textarea, [role="combobox"], [contenteditable="true"]',
    )
  )
    return
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault()
    turnPage(1)
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault()
    turnPage(-1)
  }
}
async function load(refresh = false) {
  controller?.abort()
  cancelChapterTransition()
  clearTimeout(scrollTimer)
  scrollTimer = undefined
  preferenceRevision++
  const current = new AbortController()
  controller = current
  loading.value = true
  restoring = true
  error.value = ''
  const novelId = String(route.params.novelId)
  const chapterId = String(route.params.chapterId)
  chapterHistory.value = readChapterHistory(novelId)
  pendingAction.value =
    chapter.value?.previous?.id === chapterId
      ? 'previous'
      : chapter.value?.next?.id === chapterId
        ? 'next'
        : 'directory'
  const cachedBook = novel.value?.id === novelId ? novel.value : null
  if (!cachedBook) {
    directoryOpen.value = false
    chapter.value = null
    novel.value = null
  }
  try {
    const [book, content] = await Promise.all([
      cachedBook ? Promise.resolve(cachedBook) : novelApi.detail(novelId, current.signal),
      novelApi.chapter(novelId, chapterId, current.signal, refresh),
    ])
    if (current.signal.aborted) return
    const animateChapter = Boolean(cachedBook && chapter.value && chapter.value.id !== content.id)
    if (animateChapter) {
      await leaveChapter(
        current.signal,
        content.chapter_no > chapter.value!.chapter_no,
        layout.value,
      )
      if (current.signal.aborted) return
    }
    sourcePages.value = 1
    targetPages.value = 1
    pageNumber.value = 0
    anchors = {}
    fraction.value = 0
    legacyScroll = undefined
    novel.value = book
    chapter.value = content
    const saved = readProgress(novelId)
    if (saved?.chapterId === chapterId && autoNextTarget !== chapterId) {
      anchors = { ...saved.anchors }
      fraction.value = saved.fraction || 0
      if (!Object.keys(anchors).length) legacyScroll = saved.scroll
    }
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (current.signal.aborted) return
    sourceText.value?.measure()
    targetText.value?.measure()
    restorePosition()
    await nextTick()
    if (current.signal.aborted) return
    if (animateChapter) {
      await revealChapter(current.signal)
      if (current.signal.aborted) return
      sourceText.value?.measure()
      targetText.value?.measure()
      restorePosition()
      await nextTick()
      if (current.signal.aborted) return
    }
    restoring = false
    loading.value = false
    if (autoNextTarget === chapterId) autoNextTarget = undefined
    saveProgress()
  } catch (cause) {
    if (!current.signal.aborted) {
      cancelChapterTransition()
      error.value = errorMessage(cause)
      restoring = false
    }
  } finally {
    if (!current.signal.aborted) {
      loading.value = false
      pendingAction.value = null
    }
  }
}
watch(
  [font, fontWeight],
  async () => {
    const request = ++fontRequest
    const selection = selectedFont.value
    if (!('webFamily' in selection)) {
      fontStatus.value = 'idle'
      return
    }
    fontStatus.value = 'loading'
    try {
      const faces = await document.fonts.load(
        `${fontWeight.value} 20px "${selection.webFamily}"`,
        '小说阅读',
      )
      if (request === fontRequest)
        fontStatus.value = faces.some((face) => face.status === 'loaded') ? 'ready' : 'error'
    } catch {
      if (request === fontRequest) fontStatus.value = 'error'
    }
  },
  { immediate: true },
)
watch(
  () => [currentPreferences(), isMobile.value] as const,
  async ([preferences, mobile], [previous, previousMobile]) => {
    if (mobile === previousMobile && previous.layout === 'scroll') capturePosition()
    const revision = ++preferenceRevision
    cancelChapterTransition()
    restoring = true
    writeStored('novel-reader-preferences', preferences)
    await nextTick()
    if (revision !== preferenceRevision || loading.value || !chapter.value) return
    sourceText.value?.measure()
    targetText.value?.measure()
    restorePosition()
    await nextTick()
    if (revision !== preferenceRevision) return
    restoring = false
    persistProgress()
  },
)
watch([chapter, novel, effectiveMode], () => {
  if (chapter.value && novel.value)
    document.title = `${chapterTitle(chapter.value, effectiveMode.value)} · ${novelTitle(novel.value)}`
})
watch(
  () => [route.params.novelId, route.params.chapterId],
  () => void load(),
  {
    immediate: true,
  },
)
onBeforeRouteUpdate(saveProgress)
onBeforeRouteLeave(saveProgress)
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pagehide', saveProgress)
  window.addEventListener('keydown', onKeydown)
  themeObserver = new MutationObserver(() => {
    systemDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => {
  fontRequest++
  saveProgress()
  controller?.abort()
  cancelChapterTransition()
  themeObserver?.disconnect()
  clearTimeout(scrollTimer)
  cancelAnimationFrame(layoutFrame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('pagehide', saveProgress)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="readerScope"
    class="novel-reader"
    :data-chapter-transition="chapterPhase"
    :data-chapter-direction="chapterDirection === 1 ? 'forward' : 'backward'"
    :data-chapter-layout="chapterTransitionLayout"
    :class="{
      'reader-paged': layout === 'paged' && chapter,
      'reader-chrome-hidden': !toolsVisible,
    }"
    :data-reader-theme="resolvedTheme"
    :style="readerStyle"
    @click="gestures.toggleTools"
    @wheel="gestures.onWheel"
    @touchstart.passive="gestures.onTouchStart"
    @touchmove="gestures.onTouchMove"
    @touchend.passive="gestures.onTouchEnd"
    @touchcancel.passive="gestures.onTouchCancel"
  >
    <div v-if="chapter && novel" class="reader-progress-track" aria-hidden="true">
      <div :style="{ width: `${progressPercent}%` }" />
    </div>
    <header
      class="reader-toolbar"
      aria-label="阅读工具"
      :inert="!toolsVisible"
      :aria-hidden="!toolsVisible"
    >
      <Button as-child variant="ghost" size="icon-lg">
        <RouterLink :to="`/novels/${route.params.novelId}`" aria-label="返回目录"
          ><ArrowLeft aria-hidden="true"
        /></RouterLink>
      </Button>
      <RouterLink
        v-if="novel"
        :to="`/novels/${novel.id}`"
        class="min-w-0 flex-1 text-sm text-muted-foreground"
        ><span class="block truncate">{{ novelTitle(novel) }}</span>
        <span v-if="novelOriginalTitle(novel)" class="block truncate text-xs">{{
          novelOriginalTitle(novel)
        }}</span></RouterLink
      >
      <span v-else class="flex-1 text-sm text-muted-foreground">小说阅读</span>
      <span v-if="chapter" class="shrink-0 text-right text-xs text-muted-foreground">
        <span class="block">第 {{ chapter.chapter_no }} 章</span>
        <output class="block" aria-label="本章阅读状态">{{ currentReadingStatus }}</output>
      </span>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="打开目录"
        :disabled="!chapter"
        :aria-busy="loading && pendingAction === 'directory'"
        @click="directoryOpen = true"
        ><LoaderCircle
          v-if="loading && pendingAction === 'directory'"
          class="animate-spin"
          aria-hidden="true"
          data-slot="chapter-spinner" /><List v-else aria-hidden="true"
      /></Button>
      <Dialog v-model:open="settingsOpen">
        <DialogTrigger as-child
          ><Button variant="ghost" size="icon-lg" aria-label="阅读设置"
            ><Settings2 aria-hidden="true" /></Button
        ></DialogTrigger>
        <DialogContent :data-reader-theme="resolvedTheme" class="reader-dialog">
          <DialogHeader
            ><DialogTitle>阅读设置</DialogTitle
            ><DialogDescription
              >调整到适合你的阅读节奏，设置自动保存在此浏览器。</DialogDescription
            ></DialogHeader
          >
          <section class="reader-font-preview" :style="readerStyle" aria-label="阅读效果预览">
            <p class="reader-preview-label">
              {{ selectedFont.label }} · {{ fontSize }}px · {{ fontWeightLabel }}
            </p>
            <div class="reader-preview-text">
              <p>夜色渐深，风从窗外掠过。</p>
              <p>他合上书，听见远处传来轻轻的脚步声。</p>
            </div>
            <p v-if="fontStatus === 'loading'" role="status" class="reader-preview-label">
              字体加载中…
            </p>
            <p v-else-if="fontStatus === 'error'" role="status" class="reader-preview-label">
              字体加载失败，当前显示系统字体。
            </p>
          </section>
          <div class="space-y-5">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">阅读版本</span>
              <Select v-model="selectedVersion">
                <SelectTrigger class="w-44" aria-label="阅读版本"><SelectValue /></SelectTrigger>
                <SelectContent :data-reader-theme="resolvedTheme"
                  ><SelectItem value="target">译文</SelectItem
                  ><SelectItem value="source">原文</SelectItem
                  ><SelectItem v-if="!isMobile" value="parallel"
                    >原文 / 译文对照</SelectItem
                  ></SelectContent
                >
              </Select>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">阅读方式</span>
              <Select v-model="layout"
                ><SelectTrigger class="w-44" aria-label="阅读方式"><SelectValue /></SelectTrigger
                ><SelectContent :data-reader-theme="resolvedTheme"
                  ><SelectItem value="scroll">连续滚动</SelectItem
                  ><SelectItem value="paged">分页阅读</SelectItem></SelectContent
                ></Select
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">阅读配色</span>
              <Select v-model="theme"
                ><SelectTrigger class="w-44" aria-label="阅读配色"><SelectValue /></SelectTrigger
                ><SelectContent :data-reader-theme="resolvedTheme"
                  ><SelectItem value="system">跟随站点主题</SelectItem
                  ><SelectItem value="paper">暖白纸色</SelectItem
                  ><SelectItem value="dark">深色阅读</SelectItem></SelectContent
                ></Select
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">字体</span>
              <Select v-model="font"
                ><SelectTrigger class="w-44" aria-label="阅读字体"><SelectValue /></SelectTrigger
                ><SelectContent :data-reader-theme="resolvedTheme"
                  ><SelectItem v-for="item in readerFonts" :key="item.value" :value="item.value">{{
                    item.label
                  }}</SelectItem></SelectContent
                ></Select
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">字体粗细</span>
              <Select
                :model-value="String(fontWeight)"
                @update:model-value="fontWeight = Number($event)"
              >
                <SelectTrigger class="w-44" aria-label="字体粗细"><SelectValue /></SelectTrigger>
                <SelectContent :data-reader-theme="resolvedTheme">
                  <SelectItem
                    v-for="item in fontWeights"
                    :key="item.value"
                    :value="String(item.value)"
                    >{{ item.label }}</SelectItem
                  >
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-center justify-between gap-3" role="group" aria-label="字号调整">
              <span class="text-sm font-medium">字号</span>
              <div class="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="fontSize <= 16"
                  aria-label="减小字号"
                  @click="fontSize = Math.max(16, fontSize - 2)"
                  >A−</Button
                ><output class="w-10 text-center text-sm" aria-label="当前字号"
                  >{{ fontSize }}px</output
                ><Button
                  variant="outline"
                  size="sm"
                  :disabled="fontSize >= 30"
                  aria-label="增大字号"
                  @click="fontSize = Math.min(30, fontSize + 2)"
                  >A+</Button
                >
              </div>
            </div>
            <label class="reader-setting"
              ><span
                >行距 <output>{{ lineHeight.toFixed(1) }}</output></span
              ><input
                v-model.number="lineHeight"
                type="range"
                min="1.5"
                max="2.4"
                step="0.1"
                aria-label="阅读行距"
            /></label>
            <label class="reader-setting"
              ><span
                >段距 <output>{{ paragraphGap.toFixed(1) }}</output></span
              ><input
                v-model.number="paragraphGap"
                type="range"
                min="0.6"
                max="1.4"
                step="0.2"
                aria-label="阅读段距"
            /></label>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">正文宽度</span
              ><Select :model-value="String(width)" @update:model-value="width = Number($event)"
                ><SelectTrigger class="w-44" aria-label="正文宽度"><SelectValue /></SelectTrigger
                ><SelectContent :data-reader-theme="resolvedTheme"
                  ><SelectItem value="640">紧凑</SelectItem><SelectItem value="760">舒适</SelectItem
                  ><SelectItem value="900">宽松</SelectItem></SelectContent
                ></Select
              >
            </div>
          </div>
          <DialogClose as-child><Button class="mt-2">完成</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </header>
    <div v-if="!chapter && error" class="reader-status">
      <Alert v-if="error" variant="destructive"
        ><AlertDescription class="flex flex-wrap items-center justify-between gap-3"
          ><span>{{ error }}</span
          ><Button variant="outline" @click="load(true)">重试</Button></AlertDescription
        ></Alert
      >
    </div>
    <div v-if="chapter && error" class="reader-chapter-notice">
      <Alert variant="destructive">
        <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
          <span>章节切换失败，仍显示第 {{ chapter.chapter_no }} 章。{{ error }}</span>
          <Button variant="outline" @click="load(true)">重试</Button>
        </AlertDescription>
      </Alert>
    </div>
    <div v-if="chapter && novel" class="reader-content" :aria-busy="loading">
      <header class="reader-chapter-heading">
        <div data-chapter-motion>
          <p class="mb-3 text-xs tracking-widest text-muted-foreground">
            第 {{ chapter.chapter_no }} 章 / 共 {{ novel.chapter_count }} 章
          </p>
          <h1 class="break-words text-2xl font-semibold leading-relaxed">
            {{ chapterTitle(chapter, effectiveMode) }}
          </h1>
        </div>
        <div
          v-if="isMobile"
          class="mt-4 flex justify-center gap-1"
          role="group"
          aria-label="切换阅读版本"
        >
          <Button
            size="sm"
            :variant="effectiveMode === 'target' ? 'secondary' : 'ghost'"
            :aria-pressed="effectiveMode === 'target'"
            @click="selectedVersion = 'target'"
            >译文</Button
          >
          <Button
            size="sm"
            :variant="effectiveMode === 'source' ? 'secondary' : 'ghost'"
            :aria-pressed="effectiveMode === 'source'"
            @click="selectedVersion = 'source'"
            >原文</Button
          >
        </div>
      </header>
      <div
        v-if="effectiveMode === 'target' && !hasTarget"
        data-chapter-motion
        class="reader-empty"
        role="status"
      >
        <p>本章暂无译文。</p>
        <Button v-if="hasSource" variant="outline" @click="selectedVersion = 'source'"
          >阅读原文</Button
        >
        <p v-else class="text-sm text-muted-foreground">本章暂无原文。</p>
      </div>
      <p
        v-if="effectiveMode === 'source' && !hasSource"
        data-chapter-motion
        role="status"
        class="reader-empty"
      >
        本章暂无原文。
      </p>
      <div
        data-chapter-motion
        class="reader-columns"
        :class="{ 'reader-parallel': effectiveMode === 'parallel' }"
      >
        <section
          v-if="effectiveMode === 'source' || effectiveMode === 'parallel'"
          aria-label="原文正文"
          class="reader-column"
        >
          <h2
            v-if="effectiveMode === 'parallel'"
            class="mb-5 break-words text-sm text-muted-foreground"
          >
            原文 · {{ chapter.source_title || `第 ${chapter.chapter_no} 章` }}
          </h2>
          <ReaderText
            v-if="hasSource"
            ref="sourceText"
            :content="chapter.source_content!"
            :paged="layout === 'paged'"
            :page="pageNumber"
            @layout="(pages, changed) => onTextLayout('source', pages, changed)"
          />
          <p v-else-if="effectiveMode === 'parallel'" class="text-sm text-muted-foreground">
            本章暂无原文。
          </p>
        </section>
        <section
          v-if="effectiveMode === 'target' || effectiveMode === 'parallel'"
          aria-label="译文正文"
          class="reader-column"
        >
          <h2
            v-if="effectiveMode === 'parallel'"
            class="mb-5 break-words text-sm text-muted-foreground"
          >
            译文 · {{ chapter.target_title || `第 ${chapter.chapter_no} 章` }}
          </h2>
          <ReaderText
            v-if="hasTarget"
            ref="targetText"
            :content="chapter.target_content!"
            :paged="layout === 'paged'"
            :page="pageNumber"
            @layout="(pages, changed) => onTextLayout('target', pages, changed)"
          />
          <p v-else-if="effectiveMode === 'parallel'" class="text-sm text-muted-foreground">
            本章暂无译文。
          </p>
        </section>
      </div>
    </div>
    <div class="reader-transition-light" aria-hidden="true">
      <div class="reader-transition-beam" />
    </div>
    <footer
      v-if="chapter && novel"
      class="reader-footer"
      :inert="!toolsVisible"
      :aria-hidden="!toolsVisible"
    >
      <div class="reader-footer-inner">
        <nav
          v-if="layout === 'paged'"
          aria-label="正文分页"
          class="flex items-center justify-center gap-4"
        >
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="上一页正文"
            :disabled="pageNumber === 0"
            @click="turnPage(-1)"
            ><ChevronLeft aria-hidden="true"
          /></Button>
          <output
            class="min-w-24 text-center text-xs tabular-nums"
            aria-label="正文页码"
            aria-live="polite"
            >{{ pageNumber + 1 }} / {{ totalPages }} 页</output
          >
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="下一页正文"
            :disabled="pageNumber >= totalPages - 1"
            @click="turnPage(1)"
            ><ChevronRight aria-hidden="true"
          /></Button>
        </nav>
        <p
          v-else
          class="text-center text-xs text-muted-foreground tabular-nums"
          aria-label="本章阅读进度"
        >
          本章已读 {{ progressPercent }}%
        </p>
        <nav aria-label="章节翻页" class="mt-2 flex items-center justify-between gap-2">
          <Button v-if="chapter.previous" as-child variant="ghost"
            ><RouterLink
              :to="chapterPath(novel.id, chapter.previous.id)"
              :title="chapterTitle(chapter.previous, effectiveMode)"
              :aria-busy="loading && pendingAction === 'previous'"
              ><LoaderCircle
                v-if="loading && pendingAction === 'previous'"
                class="animate-spin"
                aria-hidden="true"
                data-slot="chapter-spinner"
              /><ChevronLeft v-else aria-hidden="true" />上一章</RouterLink
            ></Button
          ><Button v-else variant="ghost" disabled><ChevronLeft aria-hidden="true" />上一章</Button>
          <Button
            variant="ghost"
            :aria-busy="loading && pendingAction === 'directory'"
            @click="directoryOpen = true"
            ><LoaderCircle
              v-if="loading && pendingAction === 'directory'"
              class="animate-spin"
              aria-hidden="true"
              data-slot="chapter-spinner"
            />目录</Button
          >
          <Button v-if="chapter.next" as-child variant="ghost"
            ><RouterLink
              :to="chapterPath(novel.id, chapter.next.id)"
              :title="chapterTitle(chapter.next, effectiveMode)"
              :aria-busy="loading && pendingAction === 'next'"
              >下一章<LoaderCircle
                v-if="loading && pendingAction === 'next'"
                class="animate-spin"
                aria-hidden="true"
                data-slot="chapter-spinner" /><ChevronRight
                v-else
                aria-hidden="true" /></RouterLink></Button
          ><Button v-else variant="ghost" disabled
            >下一章<ChevronRight aria-hidden="true"
          /></Button>
        </nav>
      </div>
    </footer>
    <ReaderDirectory
      v-if="chapter && novel"
      :key="novel.id"
      v-model:open="directoryOpen"
      :novel-id="novel.id"
      :title="novelTitle(novel)"
      :original-title="novelOriginalTitle(novel)"
      :chapter-id="chapter.id"
      :chapter-no="chapter.chapter_no"
      :history="chapterHistory"
      :mode="effectiveMode"
      :theme="resolvedTheme"
    />
  </div>
</template>
