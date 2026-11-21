<script setup lang="ts">
import { computed } from 'vue'
import type { AnswerSheetBlock } from '@/lib/answer-sheet/types'
import { compositionColumns } from '@/lib/answer-sheet/render'
import BlockLabel from './BlockLabel.vue'

const props = defineProps<{
  block: Extract<AnswerSheetBlock, { type: 'composition_grid' }>
  columnWidthMm: number
  startGridIndex?: number
  endGridIndex?: number
  preferredCols?: number
}>()
const columns = computed(() => compositionColumns(props.columnWidthMm, props.preferredCols))
const start = computed(() => props.startGridIndex ?? 0)
const end = computed(() =>
  Math.min(props.block.totalGrids, props.endGridIndex ?? props.block.totalGrids),
)
const rows = computed(() =>
  Array.from(
    { length: Math.max(0, Math.ceil((end.value - start.value) / columns.value)) },
    (_, index) => {
      const from = start.value + index * columns.value
      return Array.from(
        { length: Math.min(columns.value, end.value - from) },
        (_, cell) => from + cell + 1,
      )
    },
  ),
)
function showCountAtCell(cellNumber: number): boolean {
  return cellNumber % 100 === 0 || props.block.milestones.includes(cellNumber)
}
</script>

<template>
  <section
    class="sheet-block"
    :data-block-id="block.id"
    :data-start-grid-index="start"
    :data-end-grid-index="end"
  >
    <div
      v-if="start === 0 && (block.displayNo || block.hasTitleRow)"
      class="comp-header"
      data-first-only
    >
      <BlockLabel :display-no="block.displayNo" :score="block.score" />
    </div>
    <div
      v-for="(row, rowIndex) in rows"
      :key="row[0]"
      class="grid-row"
      :class="{ 'is-last-row': rowIndex === rows.length - 1 }"
      data-grid-row
      data-flow-unit
      :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
    >
      <div v-for="number in row" :key="number" class="cell" :data-grid-number="number">
        <span v-if="showCountAtCell(number)" class="milestone">{{ number }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.comp-header {
  margin-bottom: 1.5mm;
}
.grid-row {
  display: grid;
  padding-bottom: 2.9mm;
  border-inline: 0.25mm solid;
}
.grid-row.is-last-row {
  padding-bottom: 2.5mm;
  border-inline: 0;
}
.grid-row.is-last-row .cell:first-child {
  border-inline-start: 0.25mm solid;
}
.grid-row.is-last-row .cell:last-child {
  border-inline-end: 0.25mm solid;
}
.cell {
  position: relative;
  height: 6.62mm;
  border: 0.25mm solid;
  border-inline-start: 0;
}
.cell:last-child {
  border-inline-end: 0;
}
.milestone {
  position: absolute;
  right: 0.3mm;
  top: calc(100% + 0.15mm);
  font-size: 8.5pt;
  line-height: 1;
  white-space: nowrap;
}
</style>
