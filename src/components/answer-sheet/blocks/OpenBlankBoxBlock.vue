<script setup lang="ts">
import { computed } from 'vue'
import type { AnswerSheetBlock, SheetAsset } from '@/lib/answer-sheet/types'
import BlockLabel from './BlockLabel.vue'
const props = defineProps<{
  block: Extract<AnswerSheetBlock, { type: 'open_blank_box' }>
  columnWidthMm: number
  assetUrls: Readonly<Record<string, string>>
  assets: Readonly<Record<string, SheetAsset>>
  monochrome?: boolean
  imageWidthMm?: number
}>()

function normalizeSubText(text: string): string {
  return text.trim().replace(/（/g, '(').replace(/）/g, ')')
}

function formatOpenSubNo(rawSubNo: string): string {
  const trimmed = normalizeSubText(rawSubNo)
  const baseNo = normalizeSubText(props.block.displayNo)
  if (!trimmed || !baseNo) return trimmed
  if (trimmed === baseNo || trimmed.startsWith(baseNo)) return trimmed
  const suffixMatch = baseNo.match(/(\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])$/)
  if (suffixMatch && trimmed.startsWith(suffixMatch[1]!)) {
    return `${baseNo}${trimmed.slice(suffixMatch[1]!.length)}`
  }
  return trimmed
}
const hideTopHeader = computed(() => {
  if (!props.block.subQuestions?.length) return false
  const firstSub = normalizeSubText(props.block.subQuestions[0]?.subNo ?? '')
  const baseNo = normalizeSubText(props.block.displayNo)
  if (!firstSub || !baseNo) return false
  if (firstSub === baseNo || firstSub.startsWith(baseNo)) return true
  const suffixMatch = baseNo.match(/(\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])$/)
  if (suffixMatch && firstSub.startsWith(suffixMatch[1]!)) return true
  return false
})
</script>
<template>
  <section
    class="sheet-block open-box"
    :data-block-id="block.id"
    :style="{ minHeight: `calc(${block.baseHeightMm}mm + var(--sheet-balance-padding, 0mm))` }"
  >
    <BlockLabel v-if="!hideTopHeader" :display-no="block.displayNo" :score="block.score" />
    <template v-for="(asset, index) in block.attachedAssetIds" :key="index">
      <img
        v-if="asset.position !== 'bottom' && assetUrls[asset.assetId]"
        class="sheet-asset top-image"
        :class="[
          asset.position,
          { 'sheet-monochrome': monochrome ?? assets[asset.assetId]?.monochromeRecommended },
        ]"
        :src="assetUrls[asset.assetId]"
        :style="{ width: `${Math.min(imageWidthMm ?? Infinity, columnWidthMm * 0.48)}mm` }"
        alt="解答配图"
      />
    </template>
    <div
      v-for="(question, index) in block.subQuestions"
      :key="index"
      class="sub-question"
      data-blank-area
      :style="{ flexGrow: question.heightRatio ?? 1 }"
      :data-sub-no="question.subNo"
    >
      <BlockLabel :display-no="formatOpenSubNo(question.subNo)" :score="question.score" />
    </div>
    <div v-if="!block.subQuestions?.length" class="blank-area" data-blank-area />
    <template v-for="(asset, index) in block.attachedAssetIds" :key="`bottom-${index}`">
      <img
        v-if="asset.position === 'bottom' && assetUrls[asset.assetId]"
        class="sheet-asset bottom-image"
        :class="{ 'sheet-monochrome': monochrome ?? assets[asset.assetId]?.monochromeRecommended }"
        :src="assetUrls[asset.assetId]"
        :style="{ width: `${Math.min(imageWidthMm ?? Infinity, columnWidthMm * 0.48)}mm` }"
        alt="解答配图"
      />
    </template>
  </section>
</template>
<style scoped>
.open-box {
  display: flex;
  flex-direction: column;
}
.blank-area {
  flex: 1;
  min-height: 4mm;
}
.sub-question {
  flex-basis: 0;
  min-height: 8mm;
  padding-top: 1mm;
}
.sub-question + .sub-question {
  border-top: 0.2mm dashed;
}
.sheet-asset {
  max-height: 45mm;
}
.top-right {
  align-self: end;
}
.top-left {
  align-self: start;
}
.bottom-image {
  margin: auto auto 0;
}
</style>
