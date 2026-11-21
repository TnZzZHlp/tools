<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { FileText } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buildRenderedParagraphs, type RenderedParagraph } from '@/lib/exam-paper/render'
import type { ExamDocument } from '@/lib/exam-paper/types'

const props = withDefaults(
  defineProps<{
    doc: ExamDocument
    errorCount: number
    warningCount: number
    activeSectionId?: string
    activeItemId?: string | null
    activeChildId?: string | null
  }>(),
  {
    activeSectionId: undefined,
    activeItemId: null,
    activeChildId: null,
  },
)

const emit = defineEmits<{
  select: [payload: { sectionId?: string; itemId?: string; childId?: string }]
}>()

const paperContainerRef = ref<HTMLElement | null>(null)

const paragraphs = computed(() => buildRenderedParagraphs(props.doc))

function isParagraphActive(p: RenderedParagraph): boolean {
  if (props.activeChildId) {
    return p.childId === props.activeChildId
  }
  if (props.activeItemId) {
    return p.itemId === props.activeItemId && !p.childId
  }
  if (props.activeSectionId) {
    return p.sectionId === props.activeSectionId && !p.itemId
  }
  return false
}

function handleParagraphClick(p: RenderedParagraph) {
  if (!p.sectionId && !p.itemId) return
  emit('select', {
    sectionId: p.sectionId,
    itemId: p.itemId,
    childId: p.childId,
  })
}

watch(
  () => [props.activeSectionId, props.activeItemId, props.activeChildId],
  async () => {
    await nextTick()
    const activeEl = paperContainerRef.value?.querySelector('[data-preview-active="true"]')
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  },
)

function paragraphClass(p: RenderedParagraph): string {
  const baseInteractive =
    p.sectionId || p.itemId
      ? 'cursor-pointer rounded-[4px] transition-colors hover:bg-control/50'
      : ''
  const activeStyle = isParagraphActive(p)
    ? 'border-l-2 border-accent bg-surface pl-2.5 -ml-3'
    : ''

  switch (p.role) {
    case 'title':
      return `mb-3 text-center text-[17px] leading-[1.65] font-bold text-ink ${baseInteractive}`
    case 'section-header':
      return `mt-3.5 mb-1 text-left text-[14.5px] leading-[1.65] font-bold text-ink ${baseInteractive} ${activeStyle}`
    case 'group-delimiter':
      return `mt-2.5 text-left text-[14.5px] leading-[1.65] text-ink ${baseInteractive} ${activeStyle}`
    case 'question-stem':
      return `mt-2 text-[13px] leading-[1.7] text-ink ${baseInteractive} ${activeStyle}`
    case 'group-passage':
      return `mt-1 text-[13px] leading-[1.7] text-ink ${baseInteractive} ${activeStyle}`
    default:
      return `text-[13px] leading-[1.7] text-ink ${baseInteractive} ${activeStyle}`
  }
}

function prefixClass(p: RenderedParagraph): string {
  if (p.role === 'tag' || p.role === 'tag-header') {
    if (p.prefix?.startsWith('【答案】') || p.prefix?.startsWith('【解析】')) {
      return 'font-semibold text-accent-alt'
    }
    return 'font-semibold text-accent'
  }
  if (p.role === 'question-stem' || p.role === 'sub-question-stem') {
    return 'font-medium text-ink'
  }
  if (p.role === 'sub-answer' || p.role === 'sub-analysis') {
    return 'font-medium text-ink-muted'
  }
  return ''
}
</script>

<template>
  <Card class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <CardHeader class="shrink-0 gap-2 px-3.5 pt-3.5 pb-2">
      <template #title>
        <span class="inline-flex items-center gap-2 text-[14px]">
          <FileText class="size-4 text-ink-muted" aria-hidden="true" />
          <span>排版实时预览</span>
          <Badge variant="outline" class="font-mono text-[11px] tabular-nums">
            {{ paragraphs.length }} 段
          </Badge>
        </span>
      </template>
      <template #description>
        <p class="text-[11px] text-ink-muted">点击预览行可定位到对应试题 · A4 宋体</p>
      </template>
      <template #action>
        <div class="flex items-center gap-1.5 text-[11px]">
          <Badge v-if="errorCount > 0" variant="outline" class="border-danger text-danger">
            {{ errorCount }} 处错误
          </Badge>
          <Badge v-else-if="warningCount > 0" variant="accent-alt">
            {{ warningCount }} 项提示
          </Badge>
          <Badge v-else variant="accent">规范通过</Badge>
        </div>
      </template>
    </CardHeader>

    <CardContent class="flex min-h-0 flex-1 flex-col px-3.5 pt-1 pb-3.5">
      <div
        class="min-h-72 flex-1 overflow-y-auto rounded-control border border-line bg-surface p-3"
      >
        <div
          ref="paperContainerRef"
          class="mx-auto max-w-[40rem] rounded-control border border-line bg-raised px-4 py-5 font-['SimSun','Songti_SC','Noto_Serif_SC',serif] break-words whitespace-pre-wrap sm:px-6 sm:py-6"
        >
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="`${index}-${paragraph.role}`"
            :data-preview-active="isParagraphActive(paragraph) ? 'true' : undefined"
            :class="paragraphClass(paragraph)"
            @click="handleParagraphClick(paragraph)"
          >
            <template v-if="paragraph.prefix !== undefined && paragraph.body !== undefined">
              <span :class="prefixClass(paragraph)">{{ paragraph.prefix }}</span>
              <span>{{ paragraph.body }}</span>
            </template>
            <template v-else>
              {{ paragraph.text }}
            </template>
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
