<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowLeft,
  Columns2,
  FilePlus2,
  Maximize2,
  Redo2,
  Save,
  Settings2,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PaginatedSheetModel } from '@/lib/answer-sheet/layout/model'
import { getColumnSizeMm, PAPER_PROFILES, type PaperProfile } from '@/lib/answer-sheet/paper'
import { SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type { DensityPreset, PaperSpecId, SubjectType } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'
import PrintSheetButton from './PrintSheetButton.vue'

const props = defineProps<{
  printRoot?: HTMLElement
  layout?: PaginatedSheetModel
  paper: PaperProfile
  busy: boolean
  zoomPercent: number
  fitWidthMode: boolean
  dualPageView: boolean
}>()

const emit = defineEmits<{
  createNewSheet: [file?: File]
  switchPaper: [spec: PaperSpecId]
  compressToPrevPage: []
  saveLocal: []
  'update:zoomPercent': [val: number]
  'update:fitWidthMode': [val: boolean]
  'update:dualPageView': [val: boolean]
}>()

const store = useAnswerSheetStore()
const newSheetFileInputRef = ref<HTMLInputElement>()

function handleNewSheetFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('createNewSheet', file)
  }
  input.value = ''
}

const eightKPopoverOpen = ref(false)
const eightKVariant = computed<'8K_2COL' | '8K_B4_2COL' | 'custom'>(() => {
  if (store.layoutConfig.customPaperSize) return 'custom'
  if (store.activePaperSpec === '8K_B4_2COL') return '8K_B4_2COL'
  return '8K_2COL'
})
const customWidthInput = ref<string | number>(370)
const customHeightInput = ref<string | number>(260)

function openEightKConfig() {
  const current = store.activePaperProfile
  customWidthInput.value = current.widthMm
  customHeightInput.value = current.heightMm
}

const isCustomValid = computed(() => {
  const w = Number(customWidthInput.value)
  const h = Number(customHeightInput.value)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w > 1000 || h > 1000) return false
  const col = getColumnSizeMm({
    ...PAPER_PROFILES['8K_2COL'],
    widthMm: w,
    heightMm: h,
  })
  return col.widthMm >= 110 && col.heightMm >= 100
})

function selectPaperQuick(spec: 'A3_3COL' | 'A3_2COL' | '8K_2COL' | 'A4_1COL') {
  store.switchPaperSpec(spec, undefined)
  emit('switchPaper', spec)
}

function selectEightKVariant(variant: '8K_2COL' | '8K_B4_2COL') {
  store.switchPaperSpec(variant, undefined)
  customWidthInput.value = PAPER_PROFILES[variant].widthMm
  customHeightInput.value = PAPER_PROFILES[variant].heightMm
  emit('switchPaper', variant)
}

function applyCustomEightK() {
  if (!isCustomValid.value) return
  const spec = store.activePaperSpec.startsWith('8K') ? store.activePaperSpec : '8K_2COL'
  store.switchPaperSpec(spec, {
    widthMm: Number(customWidthInput.value),
    heightMm: Number(customHeightInput.value),
  })
  eightKPopoverOpen.value = false
  emit('switchPaper', spec)
}

const densityOptions: Array<{ id: DensityPreset; label: string }> = [
  { id: 'loose', label: '宽松' },
  { id: 'normal', label: '标准' },
  { id: 'compact', label: '紧凑' },
]

function stepZoom(delta: number) {
  emit('update:fitWidthMode', false)
  const next = Math.max(50, Math.min(200, Math.round((props.zoomPercent + delta) / 10) * 10))
  emit('update:zoomPercent', next)
}
</script>

<template>
  <header
    class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2"
    data-sheet-screen-only
  >
    <!-- Left: Back + Title + Subject Selector -->
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <RouterLink
        to="/"
        aria-label="返回工具集首页"
        title="返回首页"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:bg-control hover:text-ink"
      >
        <ArrowLeft class="size-4" />
      </RouterLink>

      <Input
        v-if="store.semanticData"
        id="workbench-sheet-title"
        :model-value="store.semanticData.meta.title"
        aria-label="试卷标题"
        placeholder="输入试卷主标题"
        class="h-8 w-44 text-xs font-semibold sm:w-56"
        @update:model-value="(val) => store.setTitle(String(val))"
      />

      <Select
        v-if="store.semanticData"
        :model-value="store.semanticData.meta.subject"
        @update:model-value="(val) => store.setSubject(val as SubjectType)"
      >
        <SelectTrigger aria-label="切换学科预设" class="h-8 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(label, key) in SUBJECT_LABELS" :key="key" :value="key">
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <input
        ref="newSheetFileInputRef"
        type="file"
        accept=".docx,.pdf,image/png,image/jpeg,image/webp"
        class="hidden"
        @change="handleNewSheetFileChange"
      />
      <Button
        variant="primary"
        size="sm"
        class="h-8 px-2.5 text-xs"
        :disabled="store.isParsing"
        @click="newSheetFileInputRef?.click()"
      >
        <template #leading><FilePlus2 class="size-3.5" /></template>
        新建答题卡
      </Button>
    </div>

    <!-- Center: Paper Spec Switcher & Density Controls & Compress Capsule -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Paper Spec Switcher -->
      <div
        class="inline-flex items-center rounded-control border border-line bg-surface p-0.5"
        role="group"
        aria-label="纸张与版式切换"
      >
        <button
          type="button"
          class="rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activePaperSpec === 'A3_3COL'
              ? 'bg-ink text-surface'
              : 'text-ink-muted hover:text-ink'
          "
          @click="selectPaperQuick('A3_3COL')"
        >
          A3 三栏
        </button>
        <button
          type="button"
          class="rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activePaperSpec === 'A3_2COL'
              ? 'bg-ink text-surface'
              : 'text-ink-muted hover:text-ink'
          "
          @click="selectPaperQuick('A3_2COL')"
        >
          A3 两栏
        </button>

        <div class="inline-flex items-center">
          <button
            type="button"
            class="rounded-l-[8px] px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              store.activePaperSpec.startsWith('8K')
                ? 'bg-ink text-surface'
                : 'text-ink-muted hover:text-ink'
            "
            @click="selectPaperQuick('8K_2COL')"
          >
            8开 两栏
          </button>
          <Popover v-model:open="eightKPopoverOpen" @update:open="(o) => o && openEightKConfig()">
            <PopoverTrigger as-child>
              <button
                type="button"
                aria-label="8开纸张正度、B4与自定义尺寸微调"
                title="8开纸张规格微调"
                class="rounded-r-[8px] px-1.5 py-1 text-xs transition-colors"
                :class="
                  store.activePaperSpec.startsWith('8K')
                    ? 'bg-ink text-surface'
                    : 'text-ink-muted hover:text-ink'
                "
              >
                <Settings2 class="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" class="w-72 space-y-3 p-3.5">
              <div class="space-y-1">
                <p class="text-xs font-semibold text-ink">8 开两栏纸张规格微调</p>
                <p class="text-[11px] text-ink-muted">
                  支持标准正度 8 开、B4 8 开或学校特殊裁切尺寸
                </p>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  :variant="eightKVariant === '8K_2COL' ? 'primary' : 'secondary'"
                  class="text-xs"
                  @click="selectEightKVariant('8K_2COL')"
                >
                  正度 (386×268)
                </Button>
                <Button
                  size="sm"
                  :variant="eightKVariant === '8K_B4_2COL' ? 'primary' : 'secondary'"
                  class="text-xs"
                  @click="selectEightKVariant('8K_B4_2COL')"
                >
                  B4 (364×257)
                </Button>
              </div>
              <div class="space-y-2 border-t border-line pt-2.5">
                <p class="text-[11px] font-medium text-ink">自定义物理宽高 (mm)</p>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <Label for="custom-8k-w" class="text-[11px]">宽度 (mm)</Label>
                    <Input
                      id="custom-8k-w"
                      v-model="customWidthInput"
                      type="number"
                      step="0.5"
                      min="230"
                      max="1000"
                      class="h-7 text-xs"
                      :invalid="!isCustomValid"
                    />
                  </div>
                  <div>
                    <Label for="custom-8k-h" class="text-[11px]">高度 (mm)</Label>
                    <Input
                      id="custom-8k-h"
                      v-model="customHeightInput"
                      type="number"
                      step="0.5"
                      min="140"
                      max="1000"
                      class="h-7 text-xs"
                      :invalid="!isCustomValid"
                    />
                  </div>
                </div>
                <p v-if="!isCustomValid" class="text-[11px] text-danger">
                  单栏净宽至少 110mm、净高至少 100mm。
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  class="w-full text-xs"
                  :disabled="!isCustomValid"
                  @click="applyCustomEightK"
                >
                  应用自定义尺寸
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <button
          type="button"
          class="rounded-[8px] px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            store.activePaperSpec === 'A4_1COL'
              ? 'bg-ink text-surface'
              : 'text-ink-muted hover:text-ink'
          "
          @click="selectPaperQuick('A4_1COL')"
        >
          A4 单栏
        </button>
      </div>

      <!-- Density Switcher -->
      <div
        class="inline-flex items-center rounded-control border border-line bg-surface p-0.5"
        role="group"
        aria-label="紧凑度调节"
      >
        <button
          v-for="d in densityOptions"
          :key="d.id"
          type="button"
          class="rounded-[8px] px-2 py-1 text-xs font-medium transition-colors"
          :class="
            store.layoutConfig.densityPreset === d.id
              ? 'bg-ink text-surface'
              : 'text-ink-muted hover:text-ink'
          "
          @click="store.setDensityPreset(d.id)"
        >
          {{ d.label }}
        </button>
      </div>

      <!-- Smart One-Click Compress Capsule -->
      <button
        v-if="layout && layout.canCompressToPrevPage"
        type="button"
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs font-semibold text-accent transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        @click="emit('compressToPrevPage')"
      >
        <Sparkles class="size-3.5" />
        <span>仅溢出少量内容，一键压回 {{ layout.pages.length - 1 }} 面</span>
      </button>
    </div>

    <!-- Right: Undo/Redo + Zoom Controls + Save + Print -->
    <div class="flex flex-wrap items-center gap-1.5">
      <!-- Undo / Redo -->
      <div class="inline-flex items-center rounded-control border border-line bg-surface p-0.5">
        <button
          type="button"
          title="撤销 (Ctrl+Z)"
          aria-label="撤销"
          :disabled="!store.canUndo"
          class="inline-flex size-7 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
          @click="store.undo()"
        >
          <Undo2 class="size-3.5" />
        </button>
        <button
          type="button"
          title="重做 (Ctrl+Y)"
          aria-label="重做"
          :disabled="!store.canRedo"
          class="inline-flex size-7 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
          @click="store.redo()"
        >
          <Redo2 class="size-3.5" />
        </button>
      </div>

      <!-- Zoom Controls (50% ~ 150%, Fit Width, Dual Page) -->
      <div
        class="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5"
      >
        <button
          type="button"
          aria-label="缩小画布"
          title="缩小画布"
          class="inline-flex size-7 items-center justify-center rounded-[7px] text-ink-muted hover:bg-control hover:text-ink"
          @click="stepZoom(-10)"
        >
          <ZoomOut class="size-3.5" />
        </button>
        <Badge variant="neutral" class="min-w-12 justify-center font-mono text-[11px] tabular-nums">
          {{ zoomPercent }}%
        </Badge>
        <button
          type="button"
          aria-label="放大画布"
          title="放大画布"
          class="inline-flex size-7 items-center justify-center rounded-[7px] text-ink-muted hover:bg-control hover:text-ink"
          @click="stepZoom(10)"
        >
          <ZoomIn class="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="适应宽度"
          title="适应宽度"
          class="inline-flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[11px] font-medium transition-colors"
          :class="
            fitWidthMode ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-control hover:text-ink'
          "
          @click="emit('update:fitWidthMode', !fitWidthMode)"
        >
          <Maximize2 class="size-3" />
          <span class="hidden xl:inline">适应宽度</span>
        </button>
        <button
          type="button"
          aria-label="双页并排预览"
          title="双页并排预览"
          class="inline-flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[11px] font-medium transition-colors"
          :class="
            dualPageView ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-control hover:text-ink'
          "
          @click="emit('update:dualPageView', !dualPageView)"
        >
          <Columns2 class="size-3" />
          <span class="hidden xl:inline">双页并排</span>
        </button>
      </div>

      <!-- Explicit Save to Local IndexedDB -->
      <Button
        variant="secondary"
        size="sm"
        class="h-8 px-2.5 text-xs"
        :loading="store.isSaving"
        @click="emit('saveLocal')"
      >
        <template #leading><Save class="size-3.5" /></template>
        保存到本机
      </Button>

      <!-- Browser Print / Save as Vector PDF -->
      <PrintSheetButton
        :root="printRoot"
        :layout="layout"
        :disabled="busy || !layout"
        :paper="paper"
        :sheet-title="store.semanticData?.meta.title"
        :unpassed-groups="store.unpassedQuestionGroups"
      />
    </div>
  </header>
</template>
