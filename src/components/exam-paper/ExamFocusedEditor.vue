<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  FolderPlus,
  Layers,
  ListPlus,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-vue-next'

import ExamKnowledgeInput from './ExamKnowledgeInput.vue'
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
import { Textarea } from '@/components/ui/textarea'
import { useExamPaperContext, type OptionContainer } from '@/composables/useExamPaperEditor'
import {
  formatGroupDelimiter,
  splitEmbeddedOptions,
  toChineseNumeral,
} from '@/lib/exam-paper/render'
import {
  DIFFICULTY_LEVELS,
  type CompoundQuestionItem,
  type DifficultyLevel,
  type GroupDelimiterStyle,
  type SectionScoreMode,
} from '@/lib/exam-paper/types'

const editor = useExamPaperContext()

const batchPopoverOpen = ref(false)
const customBatchCount = ref<string | number>(5)

const standardStemRef = ref<unknown>(null)
const compoundMotherStemRef = ref<unknown>(null)
const subStemRef = ref<unknown>(null)
const groupPassageRef = ref<unknown>(null)
const groupChildStemRef = ref<unknown>(null)

const sectionIndex = computed(() => {
  const sec = editor.activeSection.value
  if (!sec) return 0
  return Math.max(
    0,
    editor.doc.value.sections.findIndex((s) => s.id === sec.id),
  )
})

const isMultiChoiceSection = computed(() => {
  const title = editor.activeSection.value?.title ?? ''
  return /多选|多项/.test(title)
})

const activeCompoundSub = computed(() => {
  const item = editor.activeItem.value
  if (!item || item.kind !== 'compound') return null
  const idx = editor.selectedSubQuestionIndex.value
  return item.subQuestions[idx] ?? item.subQuestions[0] ?? null
})

const activeQuestionNumber = computed(() => {
  const item = editor.activeItem.value
  if (!item) return 0
  if (item.kind === 'group') {
    const child = editor.activeGroupChild.value
    return child ? (editor.numbering.value.questionNumbers.get(child.id) ?? 0) : 0
  }
  return editor.numbering.value.questionNumbers.get(item.id) ?? 0
})

const standardEmbeddedOptions = computed(() => {
  const item = editor.activeItem.value
  if (!item || item.kind !== 'standard' || item.options.length > 0) return null
  return splitEmbeddedOptions(item.stem)
})

const subEmbeddedOptions = computed(() => {
  const sub = activeCompoundSub.value
  if (!sub || sub.options.length > 0) return null
  return splitEmbeddedOptions(sub.stem)
})

const groupChildEmbeddedOptions = computed(() => {
  const child = editor.activeGroupChild.value
  if (!child || child.options.length > 0) return null
  return splitEmbeddedOptions(child.stem)
})

function resolveTextareaElement(target: unknown): HTMLTextAreaElement | null {
  if (!target) return null
  if (target instanceof HTMLTextAreaElement) return target
  if (typeof target === 'object' && '$el' in target) {
    const el = (target as { $el?: unknown }).$el
    if (el instanceof HTMLTextAreaElement) return el
  }
  return null
}

watch(
  () => editor.focusStemTick.value,
  async () => {
    await nextTick()
    const item = editor.activeItem.value
    const el =
      item?.kind === 'compound'
        ? resolveTextareaElement(compoundMotherStemRef.value)
        : item?.kind === 'group'
          ? (resolveTextareaElement(groupChildStemRef.value) ??
            resolveTextareaElement(groupPassageRef.value))
          : resolveTextareaElement(standardStemRef.value)
    el?.focus()
  },
)

function handleGlobalShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    editor.addNextQuestion()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalShortcut)
})

function updateSectionScoreMode(value: unknown) {
  const sec = editor.activeSection.value
  if (!sec) return
  if (value === 'uniform' || value === 'per-question' || value === 'none') {
    editor.setSectionScoreMode(sec.id, value satisfies SectionScoreMode)
  }
}

function updateSectionUniformScore(raw: string | number) {
  const sec = editor.activeSection.value
  if (!sec) return
  const text = String(raw).trim()
  if (!text) {
    editor.setSectionUniformScore(sec.id, undefined)
    return
  }
  const num = Number(text)
  editor.setSectionUniformScore(sec.id, Number.isFinite(num) && num > 0 ? num : undefined)
}

function parsePositiveScore(raw: string | number): number | undefined {
  const text = String(raw).trim()
  if (!text) return undefined
  const num = Number(text)
  return Number.isFinite(num) && num > 0 ? num : undefined
}

function handleBatchAdd(count: number) {
  const sec = editor.activeSection.value
  if (!sec) return
  editor.batchAddStandardQuestions(sec.id, count)
  batchPopoverOpen.value = false
}

function applySplitOptions(
  target: OptionContainer & { stem: string },
  split: { stem: string; options: OptionContainer['options'] } | null,
) {
  if (!split) return
  editor.pushUndoSnapshot()
  target.stem = split.stem
  target.options = split.options.map((opt) => ({ ...opt }))
}

function onOptionEnterKey(target: OptionContainer, index: number) {
  if (index === target.options.length - 1) {
    editor.addSingleOption(target)
  }
}

function isOptionAnswerSelected(answer: string, label: string): boolean {
  const cleanLabel = label.trim().toUpperCase()
  if (!cleanLabel) return false
  const cleanAns = answer.trim().toUpperCase()
  if (!isMultiChoiceSection.value) {
    return cleanAns === cleanLabel
  }
  return cleanAns.includes(cleanLabel)
}

function itemIndexInSection(itemId: string): number {
  const sec = editor.activeSection.value
  if (!sec) return -1
  return sec.items.findIndex((it) => it.id === itemId)
}

function setCompoundDifficulty(item: CompoundQuestionItem, level: DifficultyLevel | '') {
  editor.setDifficulty(item, level)
}

function setGroupDelimiter(style: GroupDelimiterStyle) {
  const item = editor.activeItem.value
  if (item?.kind === 'group') {
    editor.setGroupDelimiterStyle(item, style)
  }
}

const GROUP_DELIMITER_OPTIONS: Array<{ value: GroupDelimiterStyle; label: string }> = [
  { value: 'chinese-paren', label: '（一）' },
  { value: 'chinese-section', label: '第一节' },
  { value: 'uppercase-letter', label: 'A / B' },
]
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-raised"
    aria-label="试题聚焦编辑区"
  >
    <!-- Zone 1: Pinned Active Section Bar -->
    <div
      v-if="editor.activeSection.value"
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3.5 py-2.5"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Badge variant="neutral" class="shrink-0 font-semibold">
          {{ toChineseNumeral(sectionIndex + 1) }}、
        </Badge>
        <Input
          :model-value="editor.activeSection.value.title"
          :invalid="!editor.activeSection.value.title.trim()"
          class="h-8 min-w-28 max-w-44 px-2.5 text-[13px] font-medium"
          placeholder="大题名称"
          aria-label="当前大题名称"
          @update:model-value="
            (v) =>
              editor.activeSection.value &&
              editor.setSectionTitle(editor.activeSection.value.id, String(v))
          "
        />

        <Select
          :model-value="editor.activeSection.value.scoreMode"
          @update:model-value="updateSectionScoreMode"
        >
          <SelectTrigger class="h-8 w-32 px-2 text-[12px]" aria-label="大题计分方式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uniform">每小题统一分值</SelectItem>
            <SelectItem value="per-question">逐题单独标分</SelectItem>
            <SelectItem value="none">不标分值</SelectItem>
          </SelectContent>
        </Select>

        <div
          v-if="editor.activeSection.value.scoreMode === 'uniform'"
          class="flex items-center gap-1"
        >
          <Input
            type="number"
            min="0.5"
            step="0.5"
            placeholder="分值"
            class="h-8 w-16 px-2 text-center font-mono text-[12px]"
            aria-label="每小题分值"
            :model-value="editor.activeSection.value.scorePerQuestion ?? ''"
            @update:model-value="updateSectionUniformScore"
          />
          <span class="text-[12px] text-ink-muted">分</span>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-7 px-2 text-[12px]"
          @click="editor.addItem(editor.activeSection.value.id, 'standard')"
        >
          <Plus class="size-3.5" />
          普通题
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-7 px-2 text-[12px]"
          @click="editor.addItem(editor.activeSection.value.id, 'compound')"
        >
          <Layers class="size-3.5" />
          子母题
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-7 px-2 text-[12px]"
          @click="editor.addItem(editor.activeSection.value.id, 'group')"
        >
          <FolderPlus class="size-3.5" />
          题组
        </Button>

        <Popover v-model:open="batchPopoverOpen">
          <PopoverTrigger as-child>
            <Button type="button" variant="ghost" size="sm" class="min-h-7 px-2 text-[12px]">
              批量加题
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-60 space-y-2.5 p-3">
            <p class="text-[12px] font-medium text-ink">
              向“{{ editor.activeSection.value.title }}”批量追加空题
            </p>
            <div class="flex flex-wrap gap-1.5">
              <Button
                v-for="n in [3, 5, 10]"
                :key="n"
                type="button"
                variant="secondary"
                size="sm"
                class="min-h-7 px-2.5 font-mono text-[12px]"
                @click="handleBatchAdd(n)"
              >
                +{{ n }} 题
              </Button>
            </div>
            <div class="flex items-center gap-1.5 pt-1">
              <Input
                v-model="customBatchCount"
                type="number"
                min="1"
                max="20"
                class="h-8 w-20 px-2 text-center font-mono text-[12px]"
                aria-label="自定义题数"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                class="min-h-8 flex-1 text-[12px]"
                @click="handleBatchAdd(Number(customBatchCount) || 1)"
              >
                确定添加
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>

    <!-- Zone 2: Scrollable Focused Item Body -->
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        v-if="!editor.activeSection.value"
        class="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-center text-ink-muted"
      >
        <p class="text-[14px] font-medium text-ink">请先添加一个大题开始组卷</p>
        <p class="text-[12px]">可在左侧大纲底部的“添加大题”选择预设题型。</p>
      </div>

      <div
        v-else-if="editor.activeSection.value.items.length === 0 || !editor.activeItem.value"
        class="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-control border border-dashed border-line bg-surface p-6 text-center"
      >
        <p class="text-[14px] font-medium text-ink">
          “{{ editor.activeSection.value.title || '当前大题' }}”暂无试题
        </p>
        <p class="text-[12px] text-ink-muted">点击下方按钮立即新建一道题目，或批量生成空题骨架：</p>
        <div class="flex flex-wrap justify-center gap-2 pt-1">
          <Button
            type="button"
            variant="primary"
            size="sm"
            @click="editor.addItem(editor.activeSection.value.id, 'standard')"
          >
            <Plus class="size-3.5" />
            添加普通小题
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="editor.addItem(editor.activeSection.value.id, 'compound')"
          >
            <Layers class="size-3.5" />
            添加子母题
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="editor.addItem(editor.activeSection.value.id, 'group')"
          >
            <FolderPlus class="size-3.5" />
            添加题组
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="editor.batchAddStandardQuestions(editor.activeSection.value.id, 5)"
          >
            <Sparkles class="size-3.5" />
            批量生成 5 题
          </Button>
        </div>
      </div>

      <!-- Focused Standard Question -->
      <div v-else-if="editor.activeItem.value.kind === 'standard'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="accent" class="font-mono tabular-nums">
              第 {{ activeQuestionNumber }} 题
            </Badge>
            <Badge variant="outline">普通题</Badge>

            <div
              v-if="editor.activeSection.value.scoreMode === 'per-question'"
              class="flex items-center gap-1"
            >
              <Label for="focused-q-score" class="text-[12px] text-ink-muted">本题</Label>
              <Input
                id="focused-q-score"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="分值"
                class="h-7 w-18 px-2 text-center font-mono text-[12px]"
                :model-value="editor.activeItem.value.score ?? ''"
                @update:model-value="
                  (v) => {
                    if (editor.activeItem.value?.kind === 'standard') {
                      editor.activeItem.value.score = parsePositiveScore(v)
                    }
                  }
                "
              />
              <span class="text-[12px] text-ink-muted">分</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 px-2 text-[12px]"
              @click="
                editor.convertStandardToCompound(
                  editor.activeSection.value.id,
                  editor.activeItem.value.id,
                )
              "
            >
              <Layers class="size-3.5" />
              转为子母题
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="itemIndexInSection(editor.activeItem.value.id) <= 0"
              aria-label="上移当前题目"
              @click="
                editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, -1)
              "
            >
              <ArrowUp class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="
                itemIndexInSection(editor.activeItem.value.id) >=
                editor.activeSection.value.items.length - 1
              "
              aria-label="下移当前题目"
              @click="editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, 1)"
            >
              <ArrowDown class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              aria-label="复制当前题目"
              @click="
                editor.duplicateItem(editor.activeSection.value.id, editor.activeItem.value.id)
              "
            >
              <Copy class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0 text-danger hover:text-danger"
              aria-label="删除当前题目"
              @click="editor.removeItem(editor.activeSection.value.id, editor.activeItem.value.id)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Stem -->
        <div class="space-y-1.5">
          <Label for="focused-standard-stem" class="text-[12px]">题目题干</Label>
          <Textarea
            id="focused-standard-stem"
            ref="standardStemRef"
            v-model="editor.activeItem.value.stem"
            :rows="3"
            :invalid="!editor.activeItem.value.stem.trim()"
            class="min-h-22 bg-surface text-[14px]"
            placeholder="输入题干正文（支持多行换行，也可直接粘贴含 A. B. C. D. 选项的整道题目）…"
          />

          <div
            v-if="standardEmbeddedOptions"
            class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-accent/40 bg-surface px-3 py-2 text-[12px]"
          >
            <span class="text-ink">
              <Wand2 class="mr-1 inline size-3.5 text-accent" />
              检测到题干中包含
              {{ standardEmbeddedOptions.options.length }} 个选项，是否拆分到选项栏？
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="min-h-7 px-2.5 text-[12px]"
              @click="
                editor.activeItem.value?.kind === 'standard' &&
                applySplitOptions(editor.activeItem.value, standardEmbeddedOptions)
              "
            >
              一键拆分到选项栏
            </Button>
          </div>
        </div>

        <!-- Options -->
        <div class="space-y-2 rounded-control border border-line bg-surface p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-[12px] font-medium text-ink-muted">
              选项（选填，留空则不输出选项行）
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="min-h-7 px-2 text-[12px]"
                @click="
                  editor.activeItem.value?.kind === 'standard' &&
                  editor.addPresetOptions(editor.activeItem.value)
                "
              >
                <Plus class="size-3.5" />
                {{
                  editor.activeItem.value.options.length === 0 ? '添加 A/B/C/D 选项' : '添加选项'
                }}
              </Button>
              <Button
                v-if="editor.activeItem.value.options.length > 0"
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-7 px-2 text-[12px] text-ink-muted hover:text-danger"
                @click="
                  editor.activeItem.value?.kind === 'standard' &&
                  editor.clearOptions(editor.activeItem.value)
                "
              >
                清空
              </Button>
            </div>
          </div>

          <div v-if="editor.activeItem.value.options.length > 0" class="space-y-1.5">
            <div
              v-for="(opt, optIdx) in editor.activeItem.value.options"
              :key="optIdx"
              class="flex items-center gap-1.5"
            >
              <Input
                v-model="opt.label"
                class="h-8 w-11 shrink-0 bg-raised px-1.5 text-center font-mono text-[12px]"
                aria-label="选项序号"
              />
              <Input
                v-model="opt.text"
                class="h-8 min-w-0 flex-1 bg-raised px-2.5 text-[13px]"
                :placeholder="`输入选项 ${opt.label} 内容（回车新增下一项）`"
                @keydown.enter.prevent="
                  editor.activeItem.value?.kind === 'standard' &&
                  onOptionEnterKey(editor.activeItem.value, optIdx)
                "
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                aria-label="删除选项"
                @click="
                  editor.activeItem.value?.kind === 'standard' &&
                  editor.removeOptionAt(editor.activeItem.value, optIdx)
                "
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Answer (with 1-click Option Pills when options exist) -->
        <div
          v-if="editor.advancedFields.value.answer"
          class="space-y-1.5 rounded-control border border-line bg-surface p-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <Label for="focused-standard-ans" class="text-[12px]">【答案】（选填）</Label>
            <div
              v-if="editor.activeItem.value.options.length > 0"
              class="flex flex-wrap items-center gap-1"
            >
              <span class="mr-0.5 text-[11px] text-ink-muted">快捷点选：</span>
              <button
                v-for="opt in editor.activeItem.value.options"
                :key="opt.label"
                type="button"
                class="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border px-1.5 font-mono text-[11px] font-medium transition-colors"
                :class="
                  isOptionAnswerSelected(editor.activeItem.value.answer, opt.label)
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-raised text-ink hover:border-ink/40'
                "
                @click="
                  editor.activeItem.value?.kind === 'standard' &&
                  (editor.activeItem.value.answer = editor.toggleChoiceAnswer(
                    editor.activeItem.value.answer,
                    opt.label,
                    isMultiChoiceSection,
                  ))
                "
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <Textarea
            id="focused-standard-ans"
            v-model="editor.activeItem.value.answer"
            :rows="1"
            class="min-h-11 bg-raised text-[13px]"
            placeholder="留空则不输出【答案】标签…"
          />
        </div>

        <!-- Difficulty 1-Click Segmented Pills -->
        <div
          v-if="editor.advancedFields.value.difficulty"
          class="space-y-1.5 rounded-control border border-line bg-surface p-3"
        >
          <span class="block text-[12px] font-medium text-ink">【难度】（选填）</span>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="题目难度">
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-[12px] transition-colors"
              :class="
                editor.activeItem.value.difficulty === ''
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-raised text-ink-muted hover:text-ink'
              "
              @click="
                editor.activeItem.value?.kind === 'standard' &&
                editor.setDifficulty(editor.activeItem.value, '')
              "
            >
              不设
            </button>
            <button
              v-for="level in DIFFICULTY_LEVELS"
              :key="level"
              type="button"
              class="rounded-full border px-3 py-1 text-[12px] transition-colors"
              :class="
                editor.activeItem.value.difficulty === level
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-raised text-ink-muted hover:text-ink'
              "
              @click="
                editor.activeItem.value?.kind === 'standard' &&
                editor.setDifficulty(editor.activeItem.value, level)
              "
            >
              {{ level }}
            </button>
          </div>
        </div>

        <!-- Knowledge Points Chip Input -->
        <div
          v-if="editor.advancedFields.value.knowledge"
          class="space-y-1.5 rounded-control border border-line bg-surface p-3"
        >
          <Label for="focused-standard-kp" class="text-[12px]">【知识点】（选填）</Label>
          <ExamKnowledgeInput
            v-model="editor.activeItem.value.knowledgePoints"
            input-id="focused-standard-kp"
            :suggestions="editor.paperKnowledgePoints.value"
          />
        </div>

        <!-- Analysis & Steps -->
        <div
          v-if="editor.advancedFields.value.analysis"
          class="space-y-2 rounded-control border border-line bg-surface p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <Label for="focused-standard-ana" class="text-[12px]">【解析】（选填）</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 px-2 text-[12px]"
              @click="
                editor.activeItem.value?.kind === 'standard' &&
                editor.addStep(editor.activeItem.value.steps)
              "
            >
              <ListPlus class="size-3.5" />
              添加解题步骤
            </Button>
          </div>
          <Textarea
            id="focused-standard-ana"
            v-model="editor.activeItem.value.analysis"
            :rows="2"
            class="min-h-16 bg-raised text-[13px]"
            placeholder="留空则不输出【解析】标签…"
          />

          <div v-if="editor.activeItem.value.steps.length > 0" class="space-y-1.5 pt-1">
            <div
              v-for="(_step, stepIdx) in editor.activeItem.value.steps"
              :key="stepIdx"
              class="flex items-start gap-2"
            >
              <Badge variant="outline" class="mt-2 shrink-0 font-mono text-[11px]">
                步骤{{ stepIdx + 1 }}
              </Badge>
              <Textarea
                v-model="editor.activeItem.value.steps[stepIdx]"
                :rows="1"
                class="min-h-10 flex-1 bg-raised text-[13px]"
                :placeholder="`输入【步骤${stepIdx + 1}】内容…`"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="mt-1 min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                aria-label="删除步骤"
                @click="
                  editor.activeItem.value?.kind === 'standard' &&
                  editor.removeStepAt(editor.activeItem.value.steps, stepIdx)
                "
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Focused Compound Question -->
      <div v-else-if="editor.activeItem.value.kind === 'compound'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="accent" class="font-mono tabular-nums">
              第 {{ activeQuestionNumber }} 题
            </Badge>
            <Badge variant="outline">
              子母题 · {{ editor.activeItem.value.subQuestions.length }} 问
            </Badge>

            <div
              v-if="editor.activeSection.value.scoreMode === 'per-question'"
              class="flex items-center gap-1"
            >
              <Label for="focused-cq-score" class="text-[12px] text-ink-muted">本题</Label>
              <Input
                id="focused-cq-score"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="分值"
                class="h-7 w-18 px-2 text-center font-mono text-[12px]"
                :model-value="editor.activeItem.value.score ?? ''"
                @update:model-value="
                  (v) => {
                    if (editor.activeItem.value?.kind === 'compound') {
                      editor.activeItem.value.score = parsePositiveScore(v)
                    }
                  }
                "
              />
              <span class="text-[12px] text-ink-muted">分</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="itemIndexInSection(editor.activeItem.value.id) <= 0"
              aria-label="上移当前题目"
              @click="
                editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, -1)
              "
            >
              <ArrowUp class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="
                itemIndexInSection(editor.activeItem.value.id) >=
                editor.activeSection.value.items.length - 1
              "
              aria-label="下移当前题目"
              @click="editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, 1)"
            >
              <ArrowDown class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              aria-label="复制当前题目"
              @click="
                editor.duplicateItem(editor.activeSection.value.id, editor.activeItem.value.id)
              "
            >
              <Copy class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0 text-danger hover:text-danger"
              aria-label="删除当前题目"
              @click="editor.removeItem(editor.activeSection.value.id, editor.activeItem.value.id)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Mother Stem -->
        <div class="space-y-1.5">
          <Label for="focused-compound-stem" class="text-[12px]">母题题干</Label>
          <Textarea
            id="focused-compound-stem"
            ref="compoundMotherStemRef"
            v-model="editor.activeItem.value.stem"
            :rows="2"
            :invalid="!editor.activeItem.value.stem.trim()"
            class="min-h-18 bg-surface text-[14px]"
            placeholder="输入子母题公共题干或背景条件…"
          />
        </div>

        <!-- Overall Taxonomy (Controlled by Advanced Settings) -->
        <div
          v-if="editor.advancedFields.value.difficulty || editor.advancedFields.value.knowledge"
          class="space-y-2"
        >
          <div
            v-if="editor.advancedFields.value.difficulty"
            class="space-y-2 rounded-control border border-line bg-surface p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="block text-[12px] font-medium text-ink">【难度】（选填，整体）</span>
              <span class="text-[11px] text-ink-muted">
                子题使用（1）（2）编号，不占用全卷大题号
              </span>
            </div>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label="子母题整体难度">
              <button
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-[12px] transition-colors"
                :class="
                  editor.activeItem.value.difficulty === ''
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                "
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  setCompoundDifficulty(editor.activeItem.value, '')
                "
              >
                不设难度
              </button>
              <button
                v-for="level in DIFFICULTY_LEVELS"
                :key="level"
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-[12px] transition-colors"
                :class="
                  editor.activeItem.value.difficulty === level
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                "
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  setCompoundDifficulty(editor.activeItem.value, level)
                "
              >
                {{ level }}
              </button>
            </div>
          </div>

          <div
            v-if="editor.advancedFields.value.knowledge"
            class="space-y-2 rounded-control border border-line bg-surface p-3"
          >
            <Label for="focused-compound-kp" class="text-[12px]">【知识点】（选填，整体）</Label>
            <ExamKnowledgeInput
              v-model="editor.activeItem.value.knowledgePoints"
              input-id="focused-compound-kp"
              :suggestions="editor.paperKnowledgePoints.value"
              placeholder="输入子母题整体知识点…"
            />
          </div>
        </div>

        <!-- Sub-question Pill Tab Strip -->
        <div class="space-y-3 rounded-control border border-line bg-surface p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="(_sub, subIdx) in editor.activeItem.value.subQuestions"
                :key="_sub.id"
                type="button"
                class="rounded-[8px] border px-2.5 py-1 font-mono text-[12px] font-medium transition-colors"
                :class="
                  editor.selectedSubQuestionIndex.value === subIdx
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                "
                @click="editor.selectedSubQuestionIndex.value = subIdx"
              >
                （{{ subIdx + 1 }}）
              </button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="min-h-7 px-2 text-[12px]"
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  editor.addSubQuestion(editor.activeItem.value)
                "
              >
                <Plus class="size-3.5" />
                添加子题
              </Button>
            </div>

            <div v-if="activeCompoundSub" class="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-7 w-7 px-0"
                :disabled="editor.selectedSubQuestionIndex.value <= 0"
                aria-label="上移子题"
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  editor.moveSubQuestion(
                    editor.activeItem.value,
                    editor.selectedSubQuestionIndex.value,
                    -1,
                  )
                "
              >
                <ArrowUp class="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-7 w-7 px-0"
                :disabled="
                  editor.selectedSubQuestionIndex.value >=
                  editor.activeItem.value.subQuestions.length - 1
                "
                aria-label="下移子题"
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  editor.moveSubQuestion(
                    editor.activeItem.value,
                    editor.selectedSubQuestionIndex.value,
                    1,
                  )
                "
              >
                <ArrowDown class="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-7 w-7 px-0 text-danger hover:text-danger"
                aria-label="删除子题"
                @click="
                  editor.activeItem.value?.kind === 'compound' &&
                  editor.removeSubQuestion(
                    editor.activeItem.value,
                    editor.selectedSubQuestionIndex.value,
                  )
                "
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>

          <div
            v-if="activeCompoundSub"
            class="space-y-3 rounded-control border border-line bg-raised p-3"
          >
            <div class="space-y-1.5">
              <Label for="focused-sub-stem" class="text-[12px]">
                子题（{{ editor.selectedSubQuestionIndex.value + 1 }}）题干
              </Label>
              <Textarea
                id="focused-sub-stem"
                ref="subStemRef"
                v-model="activeCompoundSub.stem"
                :rows="2"
                :invalid="!activeCompoundSub.stem.trim()"
                class="min-h-16 bg-surface text-[13px]"
                :placeholder="`输入第（${editor.selectedSubQuestionIndex.value + 1}）问内容…`"
              />
              <div
                v-if="subEmbeddedOptions"
                class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-accent/40 bg-surface px-3 py-1.5 text-[12px]"
              >
                <span>检测到 {{ subEmbeddedOptions.options.length }} 个选项</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="min-h-6 px-2 text-[11px]"
                  @click="
                    activeCompoundSub && applySplitOptions(activeCompoundSub, subEmbeddedOptions)
                  "
                >
                  拆分到选项栏
                </Button>
              </div>
            </div>

            <!-- Sub Options -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[12px] text-ink-muted">子题选项（选填）</span>
                <div class="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="min-h-7 px-2 text-[12px]"
                    @click="activeCompoundSub && editor.addPresetOptions(activeCompoundSub)"
                  >
                    <Plus class="size-3.5" />
                    {{ activeCompoundSub.options.length === 0 ? '添加 A/B/C/D 选项' : '添加选项' }}
                  </Button>
                </div>
              </div>

              <div v-if="activeCompoundSub.options.length > 0" class="space-y-1.5">
                <div
                  v-for="(opt, optIdx) in activeCompoundSub.options"
                  :key="optIdx"
                  class="flex items-center gap-1.5"
                >
                  <Input
                    v-model="opt.label"
                    class="h-8 w-11 shrink-0 bg-surface px-1.5 text-center font-mono text-[12px]"
                  />
                  <Input
                    v-model="opt.text"
                    class="h-8 min-w-0 flex-1 bg-surface px-2.5 text-[13px]"
                    :placeholder="`选项 ${opt.label}`"
                    @keydown.enter.prevent="
                      activeCompoundSub && onOptionEnterKey(activeCompoundSub, optIdx)
                    "
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                    @click="activeCompoundSub && editor.removeOptionAt(activeCompoundSub, optIdx)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <!-- Sub Answer -->
            <div v-if="editor.advancedFields.value.answer" class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <Label for="focused-sub-ans" class="text-[12px]">【答案】（子题选填）</Label>
                <div
                  v-if="activeCompoundSub.options.length > 0"
                  class="flex flex-wrap items-center gap-1"
                >
                  <button
                    v-for="opt in activeCompoundSub.options"
                    :key="opt.label"
                    type="button"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border px-1.5 font-mono text-[11px] font-medium transition-colors"
                    :class="
                      isOptionAnswerSelected(activeCompoundSub.answer, opt.label)
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line bg-surface text-ink hover:border-ink/40'
                    "
                    @click="
                      activeCompoundSub &&
                      (activeCompoundSub.answer = editor.toggleChoiceAnswer(
                        activeCompoundSub.answer,
                        opt.label,
                        isMultiChoiceSection,
                      ))
                    "
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <Textarea
                id="focused-sub-ans"
                v-model="activeCompoundSub.answer"
                :rows="1"
                class="min-h-11 bg-surface text-[13px]"
                placeholder="输入该子题答案…"
              />
            </div>

            <!-- Sub Analysis & Steps -->
            <div v-if="editor.advancedFields.value.analysis" class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="focused-sub-ana" class="text-[12px]">【解析】（子题选填）</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 px-2 text-[12px]"
                  @click="activeCompoundSub && editor.addStep(activeCompoundSub.steps)"
                >
                  <ListPlus class="size-3.5" />
                  添加步骤
                </Button>
              </div>
              <Textarea
                id="focused-sub-ana"
                v-model="activeCompoundSub.analysis"
                :rows="2"
                class="min-h-14 bg-surface text-[13px]"
                placeholder="输入该子题解析…"
              />

              <div v-if="activeCompoundSub.steps.length > 0" class="space-y-1.5 pt-1">
                <div
                  v-for="(_step, stepIdx) in activeCompoundSub.steps"
                  :key="stepIdx"
                  class="flex items-start gap-2"
                >
                  <Badge variant="outline" class="mt-2 shrink-0 font-mono text-[11px]">
                    步骤{{ stepIdx + 1 }}
                  </Badge>
                  <Textarea
                    v-model="activeCompoundSub.steps[stepIdx]"
                    :rows="1"
                    class="min-h-10 flex-1 bg-surface text-[13px]"
                    :placeholder="`输入子题步骤${stepIdx + 1}…`"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="mt-1 min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                    @click="
                      activeCompoundSub && editor.removeStepAt(activeCompoundSub.steps, stepIdx)
                    "
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Focused Question Group -->
      <div v-else-if="editor.activeItem.value.kind === 'group'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="accent-alt" class="font-mono">
              题组
              {{
                formatGroupDelimiter(
                  editor.activeItem.value.delimiterStyle,
                  editor.numbering.value.groupIndexes.get(editor.activeItem.value.id) ?? 1,
                )
              }}
            </Badge>

            <div class="inline-flex rounded-[8px] border border-line bg-surface p-0.5">
              <button
                v-for="delimOpt in GROUP_DELIMITER_OPTIONS"
                :key="delimOpt.value"
                type="button"
                class="rounded-[6px] px-2 py-0.5 text-[11px] transition-colors"
                :class="
                  editor.activeItem.value.delimiterStyle === delimOpt.value
                    ? 'bg-ink text-surface'
                    : 'text-ink-muted hover:text-ink'
                "
                @click="setGroupDelimiter(delimOpt.value)"
              >
                {{ delimOpt.label }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="itemIndexInSection(editor.activeItem.value.id) <= 0"
              aria-label="上移题组"
              @click="
                editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, -1)
              "
            >
              <ArrowUp class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              :disabled="
                itemIndexInSection(editor.activeItem.value.id) >=
                editor.activeSection.value.items.length - 1
              "
              aria-label="下移题组"
              @click="editor.moveItem(editor.activeSection.value.id, editor.activeItem.value.id, 1)"
            >
              <ArrowDown class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0"
              aria-label="复制题组"
              @click="
                editor.duplicateItem(editor.activeSection.value.id, editor.activeItem.value.id)
              "
            >
              <Copy class="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-7 w-7 px-0 text-danger hover:text-danger"
              aria-label="删除题组"
              @click="editor.removeItem(editor.activeSection.value.id, editor.activeItem.value.id)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Required Passage -->
        <div class="space-y-1.5">
          <Label for="focused-group-passage" class="text-[12px]">
            题组题干内容（材料正文，必填）
          </Label>
          <Textarea
            id="focused-group-passage"
            ref="groupPassageRef"
            v-model="editor.activeItem.value.passage"
            :rows="3"
            :invalid="!editor.activeItem.value.passage.trim()"
            class="min-h-22 bg-surface text-[13px]"
            placeholder="请输入阅读理解短文、完形填空材料或综合题共用材料（不能为空）…"
          />
          <p v-if="!editor.activeItem.value.passage.trim()" class="text-[12px] text-danger">
            题组题干内容不能为空（模板硬性要求）。
          </p>
        </div>

        <!-- Group Child Selector Strip -->
        <div class="space-y-3 rounded-control border border-line bg-surface p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="child in editor.activeItem.value.questions"
                :key="child.id"
                type="button"
                class="rounded-[8px] border px-2.5 py-1 font-mono text-[12px] font-medium transition-colors"
                :class="
                  editor.activeGroupChild.value?.id === child.id
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                "
                @click="
                  editor.activeSection.value &&
                  editor.activeItem.value &&
                  editor.selectItem(
                    editor.activeSection.value.id,
                    editor.activeItem.value.id,
                    child.id,
                  )
                "
              >
                第 {{ editor.numbering.value.questionNumbers.get(child.id) ?? '?' }} 题
              </button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="min-h-7 px-2 text-[12px]"
                @click="
                  editor.activeItem.value?.kind === 'group' &&
                  editor.addGroupChild(editor.activeItem.value, editor.activeGroupChild.value?.id)
                "
              >
                <Plus class="size-3.5" />
                添加题组小题
              </Button>
            </div>

            <span
              v-if="editor.advancedFields.value.difficulty || editor.advancedFields.value.knowledge"
              class="text-[11px] text-ink-muted"
            >
              题组小题不支持【难度】【知识点】
            </span>
          </div>

          <div
            v-if="editor.activeGroupChild.value"
            class="space-y-3 rounded-control border border-line bg-raised p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Badge variant="accent" class="font-mono tabular-nums">
                  第 {{ activeQuestionNumber }} 题
                </Badge>
                <div
                  v-if="editor.activeSection.value.scoreMode === 'per-question'"
                  class="flex items-center gap-1"
                >
                  <Label for="focused-gq-score" class="text-[12px] text-ink-muted">本题</Label>
                  <Input
                    id="focused-gq-score"
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="分值"
                    class="h-7 w-16 px-2 text-center font-mono text-[12px]"
                    :model-value="editor.activeGroupChild.value.score ?? ''"
                    @update:model-value="
                      (v) => {
                        if (editor.activeGroupChild.value) {
                          editor.activeGroupChild.value.score = parsePositiveScore(v)
                        }
                      }
                    "
                  />
                  <span class="text-[12px] text-ink-muted">分</span>
                </div>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 w-7 px-0"
                  :disabled="
                    editor.activeItem.value.questions.findIndex(
                      (q) => q.id === editor.activeGroupChild.value?.id,
                    ) <= 0
                  "
                  aria-label="上移题组小题"
                  @click="
                    editor.activeItem.value?.kind === 'group' &&
                    editor.activeGroupChild.value &&
                    editor.moveGroupChild(
                      editor.activeItem.value,
                      editor.activeItem.value.questions.findIndex(
                        (q) => q.id === editor.activeGroupChild.value?.id,
                      ),
                      -1,
                    )
                  "
                >
                  <ArrowUp class="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 w-7 px-0"
                  :disabled="
                    editor.activeItem.value.questions.findIndex(
                      (q) => q.id === editor.activeGroupChild.value?.id,
                    ) >=
                    editor.activeItem.value.questions.length - 1
                  "
                  aria-label="下移题组小题"
                  @click="
                    editor.activeItem.value?.kind === 'group' &&
                    editor.activeGroupChild.value &&
                    editor.moveGroupChild(
                      editor.activeItem.value,
                      editor.activeItem.value.questions.findIndex(
                        (q) => q.id === editor.activeGroupChild.value?.id,
                      ),
                      1,
                    )
                  "
                >
                  <ArrowDown class="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 w-7 px-0 text-danger hover:text-danger"
                  aria-label="删除题组小题"
                  @click="
                    editor.activeItem.value?.kind === 'group' &&
                    editor.activeGroupChild.value &&
                    editor.removeGroupChild(
                      editor.activeItem.value,
                      editor.activeItem.value.questions.findIndex(
                        (q) => q.id === editor.activeGroupChild.value?.id,
                      ),
                    )
                  "
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
            </div>

            <!-- Child Stem -->
            <div class="space-y-1.5">
              <Label for="focused-gq-stem" class="text-[12px]">小题题干</Label>
              <Textarea
                id="focused-gq-stem"
                ref="groupChildStemRef"
                v-model="editor.activeGroupChild.value.stem"
                :rows="2"
                :invalid="!editor.activeGroupChild.value.stem.trim()"
                class="min-h-16 bg-surface text-[13px]"
                placeholder="输入题组小题题干…"
              />

              <div
                v-if="groupChildEmbeddedOptions"
                class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-accent/40 bg-surface px-3 py-1.5 text-[12px]"
              >
                <span>检测到 {{ groupChildEmbeddedOptions.options.length }} 个选项</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="min-h-6 px-2 text-[11px]"
                  @click="
                    editor.activeGroupChild.value &&
                    applySplitOptions(editor.activeGroupChild.value, groupChildEmbeddedOptions)
                  "
                >
                  拆分到选项栏
                </Button>
              </div>
            </div>

            <!-- Child Options -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[12px] text-ink-muted">选项（选填）</span>
                <div class="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="min-h-7 px-2 text-[12px]"
                    @click="
                      editor.activeGroupChild.value &&
                      editor.addPresetOptions(editor.activeGroupChild.value)
                    "
                  >
                    <Plus class="size-3.5" />
                    {{
                      editor.activeGroupChild.value.options.length === 0
                        ? '添加 A/B/C/D 选项'
                        : '添加选项'
                    }}
                  </Button>
                </div>
              </div>

              <div v-if="editor.activeGroupChild.value.options.length > 0" class="space-y-1.5">
                <div
                  v-for="(opt, optIdx) in editor.activeGroupChild.value.options"
                  :key="optIdx"
                  class="flex items-center gap-1.5"
                >
                  <Input
                    v-model="opt.label"
                    class="h-8 w-11 shrink-0 bg-surface px-1.5 text-center font-mono text-[12px]"
                  />
                  <Input
                    v-model="opt.text"
                    class="h-8 min-w-0 flex-1 bg-surface px-2.5 text-[13px]"
                    :placeholder="`选项 ${opt.label}`"
                    @keydown.enter.prevent="
                      editor.activeGroupChild.value &&
                      onOptionEnterKey(editor.activeGroupChild.value, optIdx)
                    "
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                    @click="
                      editor.activeGroupChild.value &&
                      editor.removeOptionAt(editor.activeGroupChild.value, optIdx)
                    "
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <!-- Child Answer & Analysis -->
            <div v-if="editor.advancedFields.value.answer" class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <Label for="focused-gq-ans" class="text-[12px]">【答案】（选填）</Label>
                <div
                  v-if="editor.activeGroupChild.value.options.length > 0"
                  class="flex flex-wrap items-center gap-1"
                >
                  <button
                    v-for="opt in editor.activeGroupChild.value.options"
                    :key="opt.label"
                    type="button"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border px-1.5 font-mono text-[11px] font-medium transition-colors"
                    :class="
                      isOptionAnswerSelected(editor.activeGroupChild.value.answer, opt.label)
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line bg-surface text-ink hover:border-ink/40'
                    "
                    @click="
                      editor.activeGroupChild.value &&
                      (editor.activeGroupChild.value.answer = editor.toggleChoiceAnswer(
                        editor.activeGroupChild.value.answer,
                        opt.label,
                        isMultiChoiceSection,
                      ))
                    "
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <Textarea
                id="focused-gq-ans"
                v-model="editor.activeGroupChild.value.answer"
                :rows="1"
                class="min-h-11 bg-surface text-[13px]"
                placeholder="留空则不输出【答案】"
              />
            </div>

            <div v-if="editor.advancedFields.value.analysis" class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="focused-gq-ana" class="text-[12px]">【解析】（选填）</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="min-h-7 px-2 text-[12px]"
                  @click="
                    editor.activeGroupChild.value &&
                    editor.addStep(editor.activeGroupChild.value.steps)
                  "
                >
                  <ListPlus class="size-3.5" />
                  添加步骤
                </Button>
              </div>
              <Textarea
                id="focused-gq-ana"
                v-model="editor.activeGroupChild.value.analysis"
                :rows="2"
                class="min-h-14 bg-surface text-[13px]"
                placeholder="留空则不输出【解析】"
              />

              <div v-if="editor.activeGroupChild.value.steps.length > 0" class="space-y-1.5 pt-1">
                <div
                  v-for="(_step, stepIdx) in editor.activeGroupChild.value.steps"
                  :key="stepIdx"
                  class="flex items-start gap-2"
                >
                  <Badge variant="outline" class="mt-2 shrink-0 font-mono text-[11px]">
                    步骤{{ stepIdx + 1 }}
                  </Badge>
                  <Textarea
                    v-model="editor.activeGroupChild.value.steps[stepIdx]"
                    :rows="1"
                    class="min-h-10 flex-1 bg-surface text-[13px]"
                    :placeholder="`输入【步骤${stepIdx + 1}】内容…`"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="mt-1 min-h-7 w-7 shrink-0 px-0 text-ink-muted hover:text-danger"
                    @click="
                      editor.activeGroupChild.value &&
                      editor.removeStepAt(editor.activeGroupChild.value.steps, stepIdx)
                    "
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Zone 3: Pinned Bottom Rapid-Entry Bar -->
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3.5 py-2"
    >
      <div class="flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-8 px-2.5 text-[12px]"
          :disabled="!editor.canGoPrev.value"
          @click="editor.goPrev()"
        >
          <ArrowLeft class="size-3.5" />
          上一题
        </Button>
        <span class="min-w-16 text-center font-mono text-[12px] text-ink-muted tabular-nums">
          {{ editor.activeNavIndex.value >= 0 ? editor.activeNavIndex.value + 1 : 0 }} /
          {{ editor.flatNavEntries.value.length }}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-8 px-2.5 text-[12px]"
          :disabled="!editor.canGoNext.value"
          @click="editor.goNext()"
        >
          下一题
          <ArrowRight class="size-3.5" />
        </Button>
      </div>

      <Button
        type="button"
        variant="primary"
        size="sm"
        class="min-h-8 px-3 text-[12px]"
        @click="editor.addNextQuestion()"
      >
        <Plus class="size-3.5" />
        新增下一题 (Ctrl+Enter)
      </Button>
    </div>
  </section>
</template>
