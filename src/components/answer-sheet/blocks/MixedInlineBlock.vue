<script setup lang="ts">
import { computed } from 'vue'
import { mixedFlow } from '@/lib/answer-sheet/layout/flow'
import type { AnswerSheetBlock } from '@/lib/answer-sheet/types'
import BlockLabel from './BlockLabel.vue'
import LatexText from './LatexText.vue'
import WritingLines from './WritingLines.vue'
const props = defineProps<{
  block: Extract<AnswerSheetBlock, { type: 'mixed_inline' }>
  columnWidthMm: number
  start?: number
  end?: number
  assetUrls: Readonly<Record<string, string>>
}>()
const rows = computed(() => mixedFlow(props.block).slice(props.start, props.end))
function normalizeSubText(text: string): string {
  return text.trim().replace(/（/g, '(').replace(/）/g, ')')
}

const hasInlineRowLabels = computed(() => {
  const first = props.block.rows[0]
  if (first?.type === 'inline_blank') return Boolean(first.segments[0]?.label?.trim())
  if (first?.type === 'full_line') return Boolean(first.label?.trim())
  return false
})

function formatSegmentLabel(rawLabel: string, isFirstSegmentOfBlock = false): string {
  const trimmed = normalizeSubText(rawLabel)
  const baseNo = normalizeSubText(props.block.displayNo)
  if (!trimmed) return isFirstSegmentOfBlock ? baseNo : ''
  if (!baseNo) return trimmed
  if (trimmed === baseNo || trimmed.startsWith(baseNo)) {
    return trimmed
  }
  // Avoid duplicating trailing sub-question suffix when displayNo is already e.g. "20(1)" and label is "(1)" or "18(2)②" and label is "②-1"
  const suffixMatch = baseNo.match(/(\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])$/)
  if (suffixMatch && trimmed.startsWith(suffixMatch[1]!)) {
    return `${baseNo}${trimmed.slice(suffixMatch[1]!.length)}`
  }
  if (/^\(\d+\)/.test(trimmed)) {
    return `${baseNo}${trimmed}`
  }
  if (isFirstSegmentOfBlock) {
    return `${baseNo}、${trimmed}`
  }
  return trimmed
}
</script>
<template>
  <section class="sheet-block" :data-block-id="block.id">
    <BlockLabel
      v-if="!start && !hasInlineRowLabels"
      :display-no="block.displayNo"
      :score="block.score"
    />
    <span v-else-if="start" class="sheet-label">续第 {{ block.displayNo }} 题</span>
    <div
      v-for="(row, index) in rows"
      :key="index"
      :data-block-row="index + (start ?? 0)"
      data-flow-unit
    >
      <div v-if="row.type === 'inline_blank'" class="segments">
        <div
          v-for="(segment, i) in row.segments"
          :key="i"
          class="segment"
          :style="{ flexGrow: segment.blanksCount }"
        >
          <BlockLabel
            v-if="
              segment.label || segment.score !== undefined || (!start && index === 0 && i === 0)
            "
            :display-no="formatSegmentLabel(segment.label, !start && index === 0 && i === 0)"
            :score="segment.score"
          />
          <LatexText v-if="segment.prefix" :text="segment.prefix" />
          <span v-for="blank in segment.blanksCount" :key="blank" class="sheet-rule" />
          <LatexText v-if="segment.suffixUnit" :text="segment.suffixUnit" />
        </div>
      </div>
      <WritingLines
        v-else-if="row.type === 'full_line'"
        :lines="row.lines"
        :label="row.label ? formatSegmentLabel(row.label, !start && index === 0) : undefined"
      />
      <img
        v-else-if="assetUrls[row.assetId]"
        class="sheet-asset embedded"
        :src="assetUrls[row.assetId]"
        :style="{ width: `${columnWidthMm * Math.min(0.85, row.widthRatio ?? 0.85)}mm` }"
        alt="题目配图"
      />
    </div>
  </section>
</template>
<style scoped>
.segments,
.segment {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
}
.segments {
  gap: 0 2.6mm;
  min-height: var(--sheet-line-height, 8.8mm);
  line-height: var(--sheet-line-height, 8.8mm);
}
.segment {
  min-width: min(100%, 26mm);
  flex: 1 1 0;
  gap: 0 1mm;
}
.segment > :not(.sheet-rule) {
  line-height: 1.35;
}
.sheet-rule {
  flex: 1;
  min-width: 8mm;
}
.embedded {
  margin: 1mm auto;
  max-height: 75mm;
}
</style>
