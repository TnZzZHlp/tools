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
</script>
<template>
  <section class="sheet-block" :data-block-id="block.id">
    <BlockLabel
      v-if="block.items.length > 1 && block.items[0]?.subNo.startsWith('(')"
      :display-no="block.displayNo"
      :score="block.score"
    />
    <div class="blanks" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <div
        v-for="(item, index) in block.items"
        :key="index"
        class="blank"
        :data-sub-no="item.subNo"
      >
        <BlockLabel :display-no="item.subNo" :score="item.score" />
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
  gap: 0 2mm;
}
.blank {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 0.7mm;
  min-height: 8mm;
  align-content: center;
}
.blank .sheet-rule {
  flex: 1;
  min-width: min(100%, 40mm);
  min-height: 4mm;
}
</style>
