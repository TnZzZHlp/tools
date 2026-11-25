<script setup lang="ts">
import type { RenderItem } from '@/lib/answer-sheet/layout/model'
import type { SheetAsset } from '@/lib/answer-sheet/types'
import AnswerBlock from './AnswerBlock.vue'
import HeaderBlock from './HeaderBlock.vue'
import OmrChoiceBlock from './blocks/OmrChoiceBlock.vue'

defineProps<{
  item: RenderItem
  columnWidthMm: number
  blockPaddingMm: number
  assetUrls: Readonly<Record<string, string>>
  assets: Readonly<Record<string, SheetAsset>>
}>()
</script>
<template>
  <HeaderBlock
    v-if="item.type === 'header'"
    :meta="item.meta"
    :column-width-mm="columnWidthMm"
    :heights-mm="item.heightsMm"
  />
  <OmrChoiceBlock
    v-else-if="item.type === 'choices'"
    :rows="item.rows"
    :column-width-mm="columnWidthMm"
    :padding-mm="blockPaddingMm"
  />
  <AnswerBlock
    v-else
    :block="item.block"
    :column-width-mm="columnWidthMm"
    :asset-urls="assetUrls"
    :assets="assets"
    :start-grid-index="item.start"
    :end-grid-index="item.end"
    :start="item.start"
    :end="item.end"
    :monochrome="item.monochrome"
    :image-width-mm="item.imageWidthMm"
    :preferred-composition-cols="item.preferredCompositionCols"
    :style="item.minHeightMm ? { minHeight: `${item.minHeightMm}mm` } : undefined"
  />
</template>
