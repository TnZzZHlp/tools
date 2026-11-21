<script setup lang="ts">
import type { AnswerSheetBlock, SheetAsset } from '@/lib/answer-sheet/types'
import CompactBlankBlock from './blocks/CompactBlankBlock.vue'
import CompositionGridBlock from './blocks/CompositionGridBlock.vue'
import DrawingGridBlock from './blocks/DrawingGridBlock.vue'
import LinedWritingBlock from './blocks/LinedWritingBlock.vue'
import MixedInlineBlock from './blocks/MixedInlineBlock.vue'
import OmrChoiceBlock from './blocks/OmrChoiceBlock.vue'
import OpenBlankBoxBlock from './blocks/OpenBlankBoxBlock.vue'

withDefaults(
  defineProps<{
    block: AnswerSheetBlock
    columnWidthMm: number
    assetUrls?: Readonly<Record<string, string>>
    assets?: Readonly<Record<string, SheetAsset>>
    startGridIndex?: number
    endGridIndex?: number
    start?: number
    end?: number
    monochrome?: boolean
    imageWidthMm?: number
    preferredCompositionCols?: number
  }>(),
  { assetUrls: () => ({}), assets: () => ({}) },
)
</script>
<template>
  <OmrChoiceBlock
    v-if="block.type === 'omr_choice'"
    :blocks="[block]"
    :column-width-mm="columnWidthMm"
  />
  <CompactBlankBlock
    v-else-if="block.type === 'compact_blank'"
    :block="block"
    :column-width-mm="columnWidthMm"
  />
  <MixedInlineBlock
    v-else-if="block.type === 'mixed_inline'"
    :block="block"
    :column-width-mm="columnWidthMm"
    :asset-urls="assetUrls"
    :start="start"
    :end="end"
  />
  <OpenBlankBoxBlock
    v-else-if="block.type === 'open_blank_box'"
    :block="block"
    :column-width-mm="columnWidthMm"
    :asset-urls="assetUrls"
    :assets="assets"
    :monochrome="monochrome"
    :image-width-mm="imageWidthMm"
  />
  <LinedWritingBlock
    v-else-if="block.type === 'lined_writing'"
    :block="block"
    :column-width-mm="columnWidthMm"
    :start="start"
    :end="end"
  />
  <CompositionGridBlock
    v-else-if="block.type === 'composition_grid'"
    :block="block"
    :column-width-mm="columnWidthMm"
    :start-grid-index="startGridIndex"
    :end-grid-index="endGridIndex"
    :preferred-cols="preferredCompositionCols"
  />
  <DrawingGridBlock
    v-else
    :block="block"
    :column-width-mm="columnWidthMm"
    :asset-urls="assetUrls"
    :assets="assets"
    :monochrome="monochrome"
    :image-width-mm="imageWidthMm"
  />
</template>
