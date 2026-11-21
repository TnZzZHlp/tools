<script setup lang="ts">
import { computed } from 'vue'
import type { AnswerSheetBlock } from '@/lib/answer-sheet/types'
import BlockLabel from './BlockLabel.vue'
import LatexText from './LatexText.vue'
const props = defineProps<{
  block: Extract<AnswerSheetBlock, { type: 'compact_blank' }>
  columnWidthMm: number
}>()
const columns = computed(() =>
  Math.max(1, Math.min(props.block.preferredColumns, Math.floor((props.columnWidthMm - 2.6) / 49))),
)
function normalizeSubText(text: string): string {
  return text.trim().replace(/（/g, '(').replace(/）/g, ')')
}

function formatItemSubNo(rawSubNo: string, isFirstItem: boolean): string {
  const trimmed = normalizeSubText(rawSubNo)
  const baseNo = normalizeSubText(props.block.displayNo)
  if (!trimmed) return isFirstItem ? baseNo : ''
  if (!baseNo) return trimmed
  if (trimmed === baseNo || trimmed.startsWith(baseNo)) {
    return trimmed
  }
  const suffixMatch = baseNo.match(/(\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])$/)
  if (suffixMatch && trimmed.startsWith(suffixMatch[1]!)) {
    return `${baseNo}${trimmed.slice(suffixMatch[1]!.length)}`
  }
  if (/^\(\d+\)/.test(trimmed)) {
    return `${baseNo}${trimmed}`
  }
  if (isFirstItem) {
    return `${baseNo}、${trimmed}`
  }
  return trimmed
}
</script>
<template>
  <section class="sheet-block" :data-block-id="block.id">
    <div class="blanks" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <div
        v-for="(item, index) in block.items"
        :key="index"
        class="blank"
        :data-sub-no="item.subNo"
      >
        <BlockLabel :display-no="formatItemSubNo(item.subNo, index === 0)" :score="item.score" />
        <LatexText v-if="item.prefixLatex" :text="item.prefixLatex" />
        <span class="sheet-rule" :style="{ flexGrow: Math.max(1, item.minWidthWeight ?? 1) }" />
        <LatexText v-if="item.suffixUnit" :text="item.suffixUnit" />
      </div>
    </div>
  </section>
</template>
<style scoped>
.blanks {
  display: grid;
  gap: 1.2mm 2.6mm;
}
.blank {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0 1mm;
  min-height: var(--sheet-line-height, 9mm);
  line-height: var(--sheet-line-height, 9mm);
}
.blank > :not(.sheet-rule) {
  line-height: 1.35;
}
.blank .sheet-rule {
  flex: 1;
  min-width: min(100%, 40mm);
}
</style>
