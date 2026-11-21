<script setup lang="ts">
import { computed } from 'vue'
import type { AnswerSheetBlock, SheetAsset } from '@/lib/answer-sheet/types'
import BlockLabel from './BlockLabel.vue'

const props = defineProps<{
  block: Extract<AnswerSheetBlock, { type: 'drawing_grid' }>
  columnWidthMm: number
  assetUrls: Readonly<Record<string, string>>
  assets: Readonly<Record<string, SheetAsset>>
  monochrome?: boolean
  imageWidthMm?: number
}>()
const rows = computed(() => Math.max(1, props.block.rows ?? 15))
const cols = computed(() => Math.max(1, props.block.cols ?? 20))
const cell = computed(() =>
  Math.min(
    Math.max(0.1, props.columnWidthMm - 5) / cols.value,
    props.block.baseHeightMm / rows.value,
  ),
)
const width = computed(() => cols.value * cell.value)
const height = computed(() => rows.value * cell.value)
const assetId = computed(() => props.block.assetId ?? '')
</script>

<template>
  <section class="sheet-block" :data-block-id="block.id">
    <BlockLabel :display-no="block.displayNo" :score="block.score" />
    <svg
      v-if="block.gridType === 'coordinate_paper'"
      class="grid-paper"
      data-drawing-area
      :width="`${width}mm`"
      :height="`${height}mm`"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="坐标方格纸"
      stroke="currentColor"
    >
      <line
        v-for="i in cols + 1"
        :key="`x${i}`"
        :x1="(i - 1) * cell"
        :x2="(i - 1) * cell"
        y1="0"
        :y2="height"
        :stroke-width="(i - 1) % 5 === 0 ? 0.3 : 0.12"
      />
      <line
        v-for="i in rows + 1"
        :key="`y${i}`"
        x1="0"
        :x2="width"
        :y1="(i - 1) * cell"
        :y2="(i - 1) * cell"
        :stroke-width="(i - 1) % 5 === 0 ? 0.3 : 0.12"
      />
    </svg>
    <div
      v-else
      class="image-canvas"
      data-drawing-area
      :style="{ height: `${block.baseHeightMm}mm` }"
    >
      <img
        v-if="assetUrls[assetId]"
        class="sheet-asset"
        :class="{
          'sheet-monochrome': monochrome ?? assets[assetId]?.monochromeRecommended ?? true,
        }"
        :src="assetUrls[assetId]"
        :style="
          imageWidthMm ? { width: `${Math.min(imageWidthMm, columnWidthMm * 0.85)}mm` } : undefined
        "
        alt="作图底图"
      />
    </div>
  </section>
</template>
<style scoped>
.grid-paper {
  display: block;
  margin: 1mm auto 0;
  overflow: visible;
}
.image-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-canvas img {
  max-height: 100%;
}
</style>
