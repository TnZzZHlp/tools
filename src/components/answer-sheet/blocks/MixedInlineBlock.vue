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
const hasInlineRowLabels = computed(() => {
  const first = props.block.rows[0]
  return first?.type === 'inline_blank' && Boolean(first.segments[0]?.label)
})
function formatSegmentLabel(rawLabel: string): string {
  const trimmed = rawLabel.trim()
  if (!trimmed) return ''
  if (/^\(\d+\)|^（\d+）/.test(trimmed)) {
    return `${props.block.displayNo}${trimmed.replace(/（/g, '(').replace(/）/g, ')')}`
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
            v-if="segment.label || segment.score !== undefined"
            :display-no="formatSegmentLabel(segment.label)"
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
        :label="row.label ? formatSegmentLabel(row.label) : undefined"
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
