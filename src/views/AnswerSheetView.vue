<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import SheetRenderItem from '@/components/answer-sheet/SheetRenderItem.vue'
import WorkbenchCanvas from '@/components/answer-sheet/WorkbenchCanvas.vue'
import WorkbenchLeftOutline from '@/components/answer-sheet/WorkbenchLeftOutline.vue'
import WorkbenchRightInspector from '@/components/answer-sheet/WorkbenchRightInspector.vue'
import WorkbenchTopBar from '@/components/answer-sheet/WorkbenchTopBar.vue'
import '@/components/answer-sheet/print.css'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
  DEFAULT_SHEET_FONT,
  loadSheetFont,
  SHEET_FONTS,
  type SheetFont,
} from '@/lib/answer-sheet/fonts'
import { PX_PER_MM, settingsStyle } from '@/lib/answer-sheet/layout/measure'
import { sliceItem } from '@/lib/answer-sheet/layout/prepare'
import { useLayoutEngine } from '@/lib/answer-sheet/layout/useLayoutEngine'
import { PAPER_PROFILES } from '@/lib/answer-sheet/paper'
import { usePrintPageSize } from '@/lib/answer-sheet/print'
import { previewSamples, SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type { PaperSpecId, SubjectType } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

function tryUseToast() {
  try {
    return useToast()
  } catch {
    return null
  }
}

const toastApi = tryUseToast()
const store = useAnswerSheetStore()
const retrySubject = ref<SubjectType | 'auto'>('auto')
watch(
  () => store.sheetId,
  () => {
    retrySubject.value = 'auto'
  },
)

function notify(
  title: string,
  description?: string,
  variant: 'default' | 'success' | 'danger' = 'default',
) {
  toastApi?.toast({ title, description, variant })
}

// Load both Noto Serif SC and Noto Sans SC upfront so crisp outline CJK glyphs are immediately ready
void import('@fontsource-variable/noto-serif-sc/index.css')
void import('@fontsource-variable/noto-sans-sc/index.css')

// Font loading state
const font = ref<SheetFont>(DEFAULT_SHEET_FONT)
const activeFont = ref<SheetFont>(font.value)
const fontLoading = ref(false)
const fontError = ref(false)

watch(
  font,
  async (selected, _, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    fontError.value = false
    fontLoading.value = true
    try {
      await loadSheetFont(selected)
      if (current) activeFont.value = selected
    } catch {
      if (current) fontError.value = true
    } finally {
      if (current) fontLoading.value = false
    }
  },
  { immediate: true },
)

const layoutDefaults = computed(() => ({
  fontFamily: SHEET_FONTS[activeFont.value].family,
}))

const activeSheetData = computed(() => store.semanticData ?? previewSamples.chinese)
const activePaperProfile = computed(() => store.activePaperProfile)
const activeLayoutConfig = computed(() => store.layoutConfig)

usePrintPageSize(activePaperProfile)

const {
  root: measurementRoot,
  job,
  result,
  busy,
  error,
  column,
  autoFitTargetPages,
} = useLayoutEngine(activeSheetData, activePaperProfile, activeLayoutConfig, layoutDefaults)

watch(
  result,
  (model) => {
    store.syncPaginatedLayoutFingerprints(model)
  },
  { flush: 'post' },
)

// Canvas zoom & view state
const centerZoneRef = ref<HTMLElement>()
const canvasComponentRef = ref<InstanceType<typeof WorkbenchCanvas>>()
const { width: centerZoneWidth } = useElementSize(centerZoneRef)

const zoomPercent = ref(90)
const fitWidthMode = ref(true)
const dualPageView = ref(false)

const effectiveZoom = computed(() => {
  if (fitWidthMode.value && centerZoneWidth.value > 80) {
    const pagesPerRow = dualPageView.value ? 2 : 1
    const paddingPx = dualPageView.value ? 72 : 48
    const singlePagePx = activePaperProfile.value.widthMm * PX_PER_MM
    const calculated = (centerZoneWidth.value - paddingPx) / (singlePagePx * pagesPerRow)
    return Math.min(2, Math.max(0.45, Math.round(calculated * 100) / 100))
  }
  return Math.min(2, Math.max(0.5, zoomPercent.value / 100))
})

const displayZoomPercent = computed(() => Math.round(effectiveZoom.value * 100))

function handleWheelZoom(delta: number) {
  fitWidthMode.value = false
  zoomPercent.value = Math.max(50, Math.min(200, displayZoomPercent.value + delta))
}

function handleSwitchPaper(spec: PaperSpecId) {
  const label = PAPER_PROFILES[spec].label
  notify(
    '当前版式已重排',
    `已切换至 ${label}（${activePaperProfile.value.widthMm} × ${activePaperProfile.value.heightMm} mm），语义内容与单纸张微调已保留。`,
    'success',
  )
}

async function handleCompressToPrevPage() {
  if (!result.value) return
  const targetPages = result.value.pages.length - 1
  if (targetPages < 1) return
  const ok = await autoFitTargetPages(targetPages)
  if (ok && result.value) {
    store.setGlobalLineHeightMm(result.value.settings.lineHeightMm)
    notify(
      `已压回 ${targetPages} 面`,
      `行高已优化至 ${result.value.settings.lineHeightMm}mm，保持手写舒适度。`,
      'success',
    )
  } else {
    notify(
      '无法继续压页',
      '在保留最小手写安全行高（7.0mm）的前提下，内容无法压入上一面。',
      'danger',
    )
  }
}

async function handleExplicitSave() {
  const ok = await store.persistDraftToLocal(true)
  if (ok) {
    notify(
      '已保存到本机草稿',
      '原始试卷、语义结构、版式微调、复审记录及配图已写入本地 IndexedDB。',
      'success',
    )
  } else {
    notify(
      '本地保存失败',
      store.saveError || '无法写入浏览器 IndexedDB，请检查存储空间。',
      'danger',
    )
  }
}

async function handleCreateNewSheet(file?: File) {
  await store.createNewAnswerSheet(file)
  if (file) {
    if (store.semanticData) {
      notify('试卷解析完成', '已生成答题卡语义结构并自动保存在本地列表。', 'success')
    }
  } else {
    notify('已新建答题卡', '请在右侧全局边栏选择试卷文件开始解析。')
  }
}

function handleLocateBlock(blockId: string) {
  canvasComponentRef.value?.scrollToBlock(blockId)
}

async function handleReviewGroup(groupId: string) {
  const res = await store.reviewQuestionGroup(groupId, canvasComponentRef.value?.printRoot)
  if (!res) return
  if (res.verdict === 'passed') {
    notify('大题复审通过', '作答空间与语义结构核验无误。', 'success')
  } else {
    notify('发现待优化项', res.issues[0]?.suggestion ?? '请查看左侧大题复审详情。')
  }
}

async function handleRepairGroup(groupId: string) {
  const ok = await store.applyAutoRepairForGroup(groupId, canvasComponentRef.value?.printRoot)
  if (ok) {
    notify('已完成自动返修', '已按复审建议微调作答行数或高度并重新送审。', 'success')
  } else {
    notify('已转为待人工核对', '该大题已达两轮自动返修上限，请人工确认。')
  }
}

// Keyboard Shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+S
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const isEditingInput =
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  const mod = event.ctrlKey || event.metaKey
  if (!mod) return

  if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    void handleExplicitSave()
    return
  }

  if (isEditingInput) return

  if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    if (store.undo()) {
      notify('已撤销上一步微调')
    }
  } else if (
    event.key.toLowerCase() === 'y' ||
    (event.key.toLowerCase() === 'z' && event.shiftKey)
  ) {
    event.preventDefault()
    if (store.redo()) {
      notify('已重做微调')
    }
  }
}

watch(
  () => store.semanticData?.meta.title,
  (title) => {
    const clean = title?.trim()
    document.title = clean ? clean : '智能答题卡 · Tools'
  },
  { immediate: true },
)

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  await store.initializeWorkbench()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.title = '智能答题卡 · Tools'
})
</script>

<template>
  <div class="flex h-[100dvh] w-full flex-col overflow-hidden bg-surface text-ink">
    <!-- 1. Top Global Toolbar -->
    <WorkbenchTopBar
      :print-root="canvasComponentRef?.printRoot"
      :layout="store.semanticData ? result : undefined"
      :paper="activePaperProfile"
      :busy="busy || fontLoading || store.isParsing"
      :zoom-percent="displayZoomPercent"
      :fit-width-mode="fitWidthMode"
      :dual-page-view="dualPageView"
      @create-new-sheet="handleCreateNewSheet"
      @switch-paper="handleSwitchPaper"
      @compress-to-prev-page="handleCompressToPrevPage"
      @save-local="handleExplicitSave"
      @update:zoom-percent="(val) => (zoomPercent = val)"
      @update:fit-width-mode="(val) => (fitWidthMode = val)"
      @update:dual-page-view="(val) => (dualPageView = val)"
    />

    <!-- Error Banners -->
    <div
      v-if="fontError || error"
      data-sheet-screen-only
      class="flex shrink-0 items-center justify-between border-b border-line bg-danger/10 px-4 py-1.5 text-xs text-danger"
    >
      <span v-if="fontError"> 字体加载失败，已回退至{{ SHEET_FONTS[activeFont].label }}。 </span>
      <span v-else>{{ error }}</span>
    </div>

    <div
      v-if="store.pdfParseIncomplete"
      data-sheet-screen-only
      class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-xs text-ink-muted"
      aria-live="polite"
    >
      <span v-if="store.isParsing">{{ store.parseStage?.message ?? '正在准备 PDF' }}</span>
      <template v-else>
        <span>{{ store.parseError || 'PDF 解析尚未完成，已保存本地进度。' }}</span>
        <Select v-if="!store.semanticData && !store.pdfHintSubject" v-model="retrySubject">
          <SelectTrigger aria-label="解析学科"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">自动识别学科</SelectItem>
            <SelectItem
              v-for="(label, subject) in SUBJECT_LABELS"
              :key="subject"
              :value="subject"
              >{{ label }}</SelectItem
            >
          </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" @click="store.retryDraftParse(retrySubject)"
          >继续未完成项</Button
        >
      </template>
    </div>

    <!-- 2. Three-Column Workbench Body -->
    <div
      class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18.5rem_minmax(0,1fr)_20rem] xl:grid-cols-[20rem_minmax(0,1fr)_21.5rem]"
    >
      <!-- Left Answer Sheet List + Outline & Validation & Per-Question Review Panel -->
      <WorkbenchLeftOutline
        class="hidden lg:flex"
        @create-new-sheet="handleCreateNewSheet"
        @locate-block="handleLocateBlock"
        @review-group="handleReviewGroup"
        @repair-group="handleRepairGroup"
      />

      <!-- Center Zoomable & Direct-Manipulation Physical Paper Canvas -->
      <div ref="centerZoneRef" class="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkbenchCanvas
          ref="canvasComponentRef"
          :layout="store.semanticData ? result : undefined"
          :paper="activePaperProfile"
          :busy="busy || fontLoading"
          :zoom="effectiveZoom"
          :dual-page-view="dualPageView"
          @wheel-zoom="handleWheelZoom"
          @create-new-sheet="handleCreateNewSheet"
        />
      </div>

      <!-- Right Global Sidebar & Property Inspector -->
      <WorkbenchRightInspector
        class="hidden lg:flex"
        :font="font"
        @update:font="(val) => (font = val)"
      />
    </div>

    <!-- 3. Offscreen Sandbox Measurement Container -->
    <div
      v-if="store.semanticData && job"
      ref="measurementRoot"
      aria-hidden="true"
      class="sheet-page measurement"
      :style="{ width: `${column.widthMm}mm`, ...settingsStyle(job.settings) }"
    >
      <div v-for="entry in job.entries" :key="entry.item.key">
        <div class="measurement-item">
          <SheetRenderItem
            :item="entry.item"
            :column-width-mm="column.widthMm"
            :block-padding-mm="job.settings.blockPaddingMm"
            :asset-urls="store.assetUrls"
            :assets="store.assetsMap"
          />
        </div>
        <div v-if="entry.unitCount > 1" class="measurement-item">
          <SheetRenderItem
            :item="sliceItem(entry, 1, 2)"
            :column-width-mm="column.widthMm"
            :block-padding-mm="job.settings.blockPaddingMm"
            :asset-urls="store.assetUrls"
            :assets="store.assetsMap"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.measurement {
  visibility: hidden;
  position: fixed;
  left: -9999px;
  top: 0;
}
.measurement-item {
  display: flow-root;
}
</style>
