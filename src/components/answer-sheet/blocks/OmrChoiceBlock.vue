<script setup lang="ts">
import { computed } from 'vue'
import { choiceRows } from '@/lib/answer-sheet/layout/flow'
import type { Choice, ChoiceRow } from '@/lib/answer-sheet/layout/model'
import BubbleMark from './BubbleMark.vue'
const props = defineProps<{
  blocks?: Choice[]
  rows?: ChoiceRow[]
  columnWidthMm: number
  paddingMm?: number
}>()
const matrix = computed(() => choiceRows(props.blocks ?? [], props.columnWidthMm, props.paddingMm))
function rowEntriesWithColumns(row: ChoiceRow) {
  let nextCol = 1
  return row.entries.map((entry) => {
    const startCol = entry.colStart ?? nextCol
    nextCol = startCol + entry.span
    return {
      ...entry,
      startCol,
    }
  })
}
</script>

<template>
  <section class="sheet-block matrix">
    <div
      v-for="(row, index) in rows ?? matrix.rows"
      :key="index"
      class="group"
      :class="{ 'group-start': row.gapBefore }"
      data-flow-unit
      :style="{ gridTemplateColumns: `repeat(${matrix.columns}, minmax(0, 1fr))` }"
    >
      <div
        v-for="{ block, span, startCol } in rowEntriesWithColumns(row)"
        :key="block.id"
        class="question"
        :data-block-id="block.id"
        :style="{ gridColumn: `${startCol} / span ${span}` }"
      >
        <span class="sheet-label number">{{ block.displayNo }}</span>
        <div class="marks">
          <BubbleMark
            v-for="(option, i) in block.options"
            :key="i"
            :option="option"
            :data-omr-qid="block.id"
            :data-omr-opt="option"
          />
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.group {
  display: grid;
  gap: 1.1mm 1.8mm;
  align-items: center;
  padding-bottom: 1.1mm;
}
.group:last-child {
  padding-bottom: 0;
}
.group-start {
  padding-top: 5mm;
}
.question {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 1mm;
}
.number {
  flex: none;
  min-width: 5mm;
  text-align: right;
  font-size: 9pt;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
}
.marks {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1.1mm;
}
</style>
