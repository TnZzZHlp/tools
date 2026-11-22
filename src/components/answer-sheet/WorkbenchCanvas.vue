<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDownToLine,
  FilePlus2,
  GitFork,
  GripHorizontal,
  Loader2,
  Merge,
  Minus,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { PaginatedSheetModel, RenderItem } from '@/lib/answer-sheet/layout/model'
import { PX_PER_MM, settingsStyle } from '@/lib/answer-sheet/layout/measure'
import type { PaperProfile } from '@/lib/answer-sheet/paper'
import type { AnswerSheetBlock } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'
import PaperPage from './PaperPage.vue'
import SheetRenderItem from './SheetRenderItem.vue'

const props = defineProps<{
  layout?: PaginatedSheetModel
  paper: PaperProfile
  busy: boolean
  zoom: number
  dualPageView: boolean
  referenceStyle?: boolean
}>()

const emit = defineEmits<{
  wheelZoom: [deltaPercent: number]
  createNewSheet: [file?: File]
}>()

const store = useAnswerSheetStore()
const containerRef = ref<HTMLElement>()
const printRootRef = ref<HTMLElement>()
const emptyCanvasFileInputRef = ref<HTMLInputElement>()

function handleEmptyCanvasFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('createNewSheet', file)
  }
  input.value = ''
}

defineExpose({
  printRoot: printRootRef,
  scrollToBlock,
})

// Pan state
const isPanning = ref(false)
let panStartX = 0
let panStartY = 0
let panScrollLeft = 0
let panScrollTop = 0

// Height Resize Handle state (for all non-OMR subjective blocks)
const resizingBlockId = ref<string | null>(null)
const liveResizeHeightMm = ref<number | null>(null)
const liveResizeLines = ref<number | null>(null)
const liveResizeGrids = ref<number | null>(null)
let resizeStartY = 0
let resizeInitialHeightMm = 60
let resizeInitialLines = 4
let resizeInitialGrids = 800

function itemBlock(item: RenderItem): AnswerSheetBlock | null {
  if (item.type === 'block') return item.block
  return null
}

function isResizableBlock(block: AnswerSheetBlock | null): boolean {
  return Boolean(block && block.type !== 'omr_choice')
}

function getLinedWritingTotalLines(
  block: Extract<AnswerSheetBlock, { type: 'lined_writing' }>,
): number {
  const ov = store.currentPaperOverrides.blockOverrides[block.id]
  if (ov?.manualLines !== undefined) return ov.manualLines
  if (block.englishWritingMeta?.continuationParagraphs?.length) {
    return block.englishWritingMeta.continuationParagraphs.reduce((s, p) => s + p.baseLines, 0)
  }
  if (block.subItems?.length) {
    return block.subItems.reduce((s, p) => s + p.baseLines, 0)
  }
  return block.baseLines
}

function getEffectiveBlockHeightMm(block: AnswerSheetBlock, fallbackMm = 60): number {
  if (resizingBlockId.value === block.id && liveResizeHeightMm.value !== null) {
    return liveResizeHeightMm.value
  }
  const ov = store.currentPaperOverrides.blockOverrides[block.id]
  if (ov?.manualHeightMm !== undefined) return ov.manualHeightMm
  if (block.type === 'open_blank_box' || block.type === 'drawing_grid') {
    return block.baseHeightMm
  }
  return Math.round(fallbackMm)
}

function getResizeHandleLabel(block: AnswerSheetBlock, fallbackMm: number): string {
  if (block.type === 'lined_writing') {
    const lines =
      resizingBlockId.value === block.id && liveResizeLines.value !== null
        ? liveResizeLines.value
        : getLinedWritingTotalLines(block)
    return `${lines} 行`
  }
  if (block.type === 'composition_grid') {
    const grids =
      resizingBlockId.value === block.id && liveResizeGrids.value !== null
        ? liveResizeGrids.value
        : block.totalGrids
    return `${grids} 格`
  }
  return `${getEffectiveBlockHeightMm(block, fallbackMm)}mm`
}

function hasSubQuestions(block: AnswerSheetBlock): boolean {
  if (block.type === 'lined_writing') return (block.subItems?.length ?? 0) > 1
  if (block.type === 'open_blank_box') return (block.subQuestions?.length ?? 0) > 1
  if (block.type === 'compact_blank') return block.items.length > 1
  if (block.type === 'mixed_inline') return block.rows.length > 1
  return false
}

function onResizePointerDown(event: PointerEvent, block: AnswerSheetBlock, placedHeightMm: number) {
  event.stopPropagation()
  event.preventDefault()
  store.selectBlock(block.id)
  resizingBlockId.value = block.id
  resizeStartY = event.clientY

  const lineHeightMm = props.layout?.settings.lineHeightMm ?? 9
  const compCols = store.layoutConfig.defaultCompositionCols ?? 20

  if (block.type === 'lined_writing') {
    resizeInitialLines = getLinedWritingTotalLines(block)
    liveResizeLines.value = resizeInitialLines
    liveResizeHeightMm.value = null
    liveResizeGrids.value = null
  } else if (block.type === 'composition_grid') {
    resizeInitialGrids = block.totalGrids
    liveResizeGrids.value = resizeInitialGrids
    liveResizeHeightMm.value = null
    liveResizeLines.value = null
  } else {
    resizeInitialHeightMm = getEffectiveBlockHeightMm(block, placedHeightMm)
    liveResizeHeightMm.value = resizeInitialHeightMm
    liveResizeLines.value = null
    liveResizeGrids.value = null
  }

  const onMove = (moveEvent: PointerEvent) => {
    const dyPx = moveEvent.clientY - resizeStartY
    const dyMm = dyPx / (PX_PER_MM * props.zoom)
    if (block.type === 'lined_writing') {
      const deltaLines = Math.round(dyMm / Math.max(5, lineHeightMm))
      liveResizeLines.value = Math.max(1, Math.min(40, resizeInitialLines + deltaLines))
    } else if (block.type === 'composition_grid') {
      const deltaRows = Math.round(dyMm / 8)
      liveResizeGrids.value = Math.max(
        100,
        Math.min(2000, resizeInitialGrids + deltaRows * compCols),
      )
    } else {
      liveResizeHeightMm.value = Math.max(
        14,
        Math.min(240, Math.round(resizeInitialHeightMm + dyMm)),
      )
    }
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    const activeId = resizingBlockId.value
    if (activeId) {
      if (block.type === 'lined_writing' && liveResizeLines.value !== null) {
        const delta = liveResizeLines.value - resizeInitialLines
        if (delta !== 0) store.adjustBlockLines(activeId, delta)
      } else if (block.type === 'composition_grid' && liveResizeGrids.value !== null) {
        const nextGrids = liveResizeGrids.value
        if (nextGrids !== resizeInitialGrids) {
          store.updateBlock(activeId, (b) =>
            b.type === 'composition_grid' ? { ...b, totalGrids: nextGrids } : b,
          )
        }
      } else if (liveResizeHeightMm.value !== null) {
        store.setBlockHeightMm(activeId, liveResizeHeightMm.value)
      }
    }
    resizingBlockId.value = null
    liveResizeHeightMm.value = null
    liveResizeLines.value = null
    liveResizeGrids.value = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onCanvasPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (
    target.closest('[data-block-wrapper]') ||
    target.closest('[data-omr-qid]') ||
    target.closest('button')
  ) {
    return
  }
  // Clicked empty background -> deselect & enable drag pan
  store.selectBlock(null)
  if (!containerRef.value) return
  isPanning.value = true
  panStartX = event.clientX
  panStartY = event.clientY
  panScrollLeft = containerRef.value.scrollLeft
  panScrollTop = containerRef.value.scrollTop

  const onMove = (moveEvent: PointerEvent) => {
    if (!containerRef.value) return
    containerRef.value.scrollLeft = panScrollLeft - (moveEvent.clientX - panStartX)
    containerRef.value.scrollTop = panScrollTop - (moveEvent.clientY - panStartY)
  }

  const onUp = () => {
    isPanning.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    emit('wheelZoom', event.deltaY < 0 ? 10 : -10)
  }
}

function handleChoiceMatrixClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const qNode = target.closest<HTMLElement>('[data-block-id]')
  if (qNode?.dataset.blockId) {
    event.stopPropagation()
    store.selectBlock(qNode.dataset.blockId)
  }
}

function scrollToBlock(blockId: string) {
  store.highlightedBlockId = blockId
  setTimeout(() => {
    if (store.highlightedBlockId === blockId) {
      store.highlightedBlockId = null
    }
  }, 1800)

  const root = printRootRef.value
  if (!root) return
  const el =
    root.querySelector<HTMLElement>(`[data-wrapper-block-id="${blockId}"]`) ??
    root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
}

const renderedItemWithLiveResize = computed(() => {
  return (item: RenderItem): RenderItem => {
    if (item.type !== 'block' || resizingBlockId.value !== item.block.id) return item
    if (
      liveResizeHeightMm.value !== null &&
      (item.block.type === 'open_blank_box' || item.block.type === 'drawing_grid')
    ) {
      return {
        ...item,
        block: {
          ...item.block,
          baseHeightMm: liveResizeHeightMm.value,
        },
      }
    }
    if (
      liveResizeHeightMm.value !== null &&
      (item.block.type === 'compact_blank' || item.block.type === 'mixed_inline')
    ) {
      return {
        ...item,
        minHeightMm: liveResizeHeightMm.value,
      }
    }
    if (liveResizeLines.value !== null && item.block.type === 'lined_writing') {
      return {
        ...item,
        block: {
          ...item.block,
          baseLines: liveResizeLines.value,
        },
      }
    }
    if (liveResizeGrids.value !== null && item.block.type === 'composition_grid') {
      return {
        ...item,
        block: {
          ...item.block,
          totalGrids: liveResizeGrids.value,
        },
      }
    }
    return item
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex h-full min-h-0 flex-1 overflow-auto bg-control p-4 select-none sm:p-6"
    :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'"
    @pointerdown="onCanvasPointerDown"
    @wheel="onWheel"
  >
    <div
      ref="printRootRef"
      class="sheet-print-root m-auto"
      :class="
        dualPageView
          ? 'grid grid-cols-1 items-start justify-items-center gap-6 2xl:grid-cols-2'
          : 'flex flex-col items-center gap-6'
      "
      aria-label="纸张预览画布"
      :aria-busy="busy"
    >
      <template v-if="store.semanticData && layout">
        <div
          v-for="(columns, pageIndex) in layout.pages"
          :key="pageIndex"
          class="sheet-print-page relative shadow-popup transition-shadow"
          :style="{
            width: `${paper.widthMm * zoom}mm`,
            height: `${paper.heightMm * zoom}mm`,
          }"
        >
          <div
            class="sheet-print-content absolute top-0 left-0 origin-top-left"
            :style="{ transform: `scale(${zoom})`, ...settingsStyle(layout.settings) }"
          >
            <PaperPage
              :profile="paper"
              :reference-style="referenceStyle"
              :page="pageIndex + 1"
              :total-pages="layout.pages.length"
            >
              <template #default="{ index, columnWidthMm }">
                <div
                  v-for="entry in columns[index]"
                  :key="entry.item.key"
                  data-block-wrapper
                  :data-wrapper-block-id="itemBlock(entry.item)?.id"
                  class="sheet-placed group/block relative"
                  :style="{ '--sheet-balance-padding': `${entry.paddingMm}mm` }"
                  @click.stop="
                    itemBlock(entry.item)
                      ? store.selectBlock(itemBlock(entry.item)!.id)
                      : entry.item.type === 'choices'
                        ? handleChoiceMatrixClick($event)
                        : store.selectBlock(null)
                  "
                >
                  <!-- Interactive Selection & Hover Dashed Frame (Screen Only) -->
                  <div
                    v-if="itemBlock(entry.item)"
                    data-sheet-screen-only
                    class="pointer-events-none absolute -inset-[0.8mm] z-10 rounded-[1.5mm] transition-colors"
                    :class="[
                      store.selectedBlockId === itemBlock(entry.item)!.id
                        ? 'border-[0.55mm] border-solid border-[#2563eb] bg-[#2563eb]/[0.03]'
                        : store.highlightedBlockId === itemBlock(entry.item)!.id
                          ? 'border-[0.55mm] border-solid border-[#d97706] bg-[#d97706]/10'
                          : 'border-[0.45mm] border-dashed border-transparent group-hover/block:border-[#60a5fa]',
                    ]"
                  />

                  <!-- Floating Quick Action Micro-Toolbar when Selected (Screen Only) -->
                  <div
                    v-if="
                      entry.item.type === 'block' &&
                      store.selectedBlockId === entry.item.block.id &&
                      (!entry.item.start || entry.item.start === 0)
                    "
                    data-sheet-screen-only
                    class="absolute -top-7 right-0 z-30 flex items-center gap-1 rounded-[6px] border border-line bg-raised px-1.5 py-0.5 text-[10px] text-ink shadow-popup"
                    @click.stop
                  >
                    <button
                      type="button"
                      title="增加 1 行 / 增加高度"
                      aria-label="+1行"
                      class="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-medium hover:bg-control"
                      @click="store.adjustBlockLines(itemBlock(entry.item)!.id, 1)"
                    >
                      <Plus class="size-2.5" />
                      <span>+1行</span>
                    </button>
                    <button
                      type="button"
                      title="减少 1 行 / 减小高度"
                      aria-label="-1行"
                      class="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-medium hover:bg-control"
                      @click="store.adjustBlockLines(itemBlock(entry.item)!.id, -1)"
                    >
                      <Minus class="size-2.5" />
                      <span>-1行</span>
                    </button>
                    <button
                      type="button"
                      title="强制从此题换栏"
                      aria-label="强制从此题换栏"
                      class="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-medium transition-colors"
                      :class="
                        store.currentPaperOverrides.blockOverrides[itemBlock(entry.item)!.id]
                          ?.forceBreakBefore
                          ? 'bg-ink text-surface'
                          : 'hover:bg-control'
                      "
                      @click="store.toggleForceBreakBefore(itemBlock(entry.item)!.id)"
                    >
                      <ArrowDownToLine class="size-2.5" />
                      <span>换栏</span>
                    </button>
                    <button
                      v-if="
                        itemBlock(entry.item)!.type === 'lined_writing' ||
                        itemBlock(entry.item)!.type === 'open_blank_box' ||
                        itemBlock(entry.item)!.type === 'compact_blank' ||
                        itemBlock(entry.item)!.type === 'mixed_inline'
                      "
                      type="button"
                      :title="hasSubQuestions(itemBlock(entry.item)!) ? '合并子题' : '拆分子题'"
                      class="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-medium hover:bg-control"
                      @click="store.splitOrMergeSubQuestions(itemBlock(entry.item)!.id)"
                    >
                      <Merge v-if="hasSubQuestions(itemBlock(entry.item)!)" class="size-2.5" />
                      <GitFork v-else class="size-2.5" />
                      <span>{{
                        hasSubQuestions(itemBlock(entry.item)!) ? '合并子题' : '拆分子题'
                      }}</span>
                    </button>
                    <button
                      type="button"
                      title="删除题块"
                      aria-label="删除"
                      class="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-medium text-danger hover:bg-danger/10"
                      @click="store.deleteBlock(itemBlock(entry.item)!.id)"
                    >
                      <Trash2 class="size-2.5" />
                      <span>删除</span>
                    </button>
                  </div>

                  <!-- Actual Rendered Sheet Block -->
                  <SheetRenderItem
                    :item="renderedItemWithLiveResize(entry.item)"
                    :column-width-mm="columnWidthMm"
                    :block-padding-mm="layout.settings.blockPaddingMm"
                    :asset-urls="store.assetUrls"
                    :assets="store.assetsMap"
                  />

                  <!-- Bottom Drag Handle for all subjective blocks (Screen Only) -->
                  <div
                    v-if="isResizableBlock(itemBlock(entry.item))"
                    data-sheet-screen-only
                    data-resize-handle
                    role="slider"
                    :aria-label="`拖拽调整第 ${itemBlock(entry.item)!.displayNo} 题高度`"
                    :aria-valuenow="
                      getEffectiveBlockHeightMm(itemBlock(entry.item)!, entry.heightMm)
                    "
                    class="absolute inset-x-0 -bottom-2 z-20 flex h-4 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover/block:opacity-100"
                    :class="{
                      'opacity-100':
                        store.selectedBlockId === itemBlock(entry.item)!.id ||
                        resizingBlockId === itemBlock(entry.item)!.id,
                    }"
                    @pointerdown="
                      onResizePointerDown($event, itemBlock(entry.item)!, entry.heightMm)
                    "
                  >
                    <div
                      class="flex items-center gap-1 rounded-full border border-[#2563eb] bg-raised px-2 py-0.5 text-[9px] font-semibold text-ink shadow-sm"
                    >
                      <GripHorizontal class="size-3 text-[#2563eb]" />
                      <span class="font-mono tabular-nums">
                        {{ getResizeHandleLabel(itemBlock(entry.item)!, entry.heightMm) }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
            </PaperPage>
          </div>
        </div>
      </template>

      <div
        v-else-if="store.isParsing"
        class="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-panel border border-line bg-raised px-8 py-12 text-center shadow-popup"
      >
        <Loader2 class="size-7 animate-spin text-accent" />
        <div class="space-y-1">
          <p class="text-sm font-semibold text-ink">
            {{ store.parseStage?.message ?? '正在解析试卷文件并生成答题卡...' }}
          </p>
          <p class="text-xs text-ink-muted">右侧全局边栏正在实时展示解析进度与逐题识别结果</p>
        </div>
      </div>

      <p v-else-if="busy && store.semanticData" role="status" class="py-12 text-sm text-ink-muted">
        正在离屏测量与自动分页...
      </p>

      <div
        v-else
        class="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-panel border border-dashed border-line bg-raised px-8 py-12 text-center shadow-popup"
      >
        <div class="space-y-1.5">
          <h3 class="text-sm font-semibold text-ink">新建答题卡并选择试卷文件</h3>
          <p class="text-xs leading-relaxed text-ink-muted">
            所有答题卡与配图数据均保存在浏览器本地。点击下方按钮选择试卷文件（支持 .docx、.pdf
            与试卷图片），右侧全局边栏将直接加载解析进度。
          </p>
        </div>

        <input
          ref="emptyCanvasFileInputRef"
          type="file"
          accept=".docx,.pdf,image/png,image/jpeg,image/webp"
          class="hidden"
          @change="handleEmptyCanvasFileChange"
        />
        <Button
          variant="primary"
          size="md"
          class="text-xs"
          @click="emptyCanvasFileInputRef?.click()"
        >
          <template #leading><FilePlus2 class="size-4" /></template>
          新建答题卡并选择试卷文件
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-placed {
  display: flow-root;
}
</style>
