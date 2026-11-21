<script setup lang="ts">
import { computed } from 'vue'
import { writingFlow } from '@/lib/answer-sheet/layout/flow'
import type { Writing } from '@/lib/answer-sheet/layout/model'
import BlockLabel from './BlockLabel.vue'
import WritingLines from './WritingLines.vue'
const props = defineProps<{ block: Writing; columnWidthMm: number; start?: number; end?: number }>()
const flow = computed(() => writingFlow(props.block))
const lines = computed(() => flow.value.slice(props.start, props.end))
const isPlain = computed(() => !props.block.englishWritingMeta && !props.block.subItems?.length)
const showTopBlockHeader = computed(() => {
  if (props.start) return false
  if (isPlain.value) return false
  if (props.block.englishWritingMeta) return true
  return false
})
function formatSubLabel(rawLabel: string | undefined, isFirstLineOfBlock: boolean): string {
  if (!rawLabel) return ''
  const trimmed = rawLabel.trim()
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(trimmed)) {
    return isFirstLineOfBlock ? `${props.block.displayNo}、${trimmed}` : trimmed
  }
  if (/^\(\d+\)|^（\d+）/.test(trimmed)) {
    return `${props.block.displayNo}${trimmed.replace(/（/g, '(').replace(/）/g, ')')}`
  }
  return trimmed
}
</script>
<template>
  <section class="sheet-block" :data-block-id="block.id">
    <span v-if="start" class="sheet-label">续第 {{ block.displayNo }} 题</span>
    <BlockLabel v-else-if="showTopBlockHeader" :display-no="block.displayNo" :score="block.score" />
    <div v-if="!start && block.englishWritingMeta?.salutation" class="salutation" data-first-only>
      {{ block.englishWritingMeta.salutation }}
    </div>
    <div v-for="(line, index) in lines" :key="index" data-flow-unit :data-sub-no="line.subNo">
      <WritingLines :lines="1" :heading="line.heading" :lead-text="line.leadText">
        <template #label>
          <BlockLabel
            v-if="!start && index === 0 && isPlain"
            :display-no="block.displayNo"
            :score="block.score"
          />
          <BlockLabel
            v-else-if="line.label"
            :display-no="formatSubLabel(line.label, !start && index === 0)"
            :score="line.score"
          />
        </template>
      </WritingLines>
    </div>
    <div
      v-if="(end ?? flow.length) >= flow.length && block.englishWritingMeta?.signOff"
      class="sign-off"
      data-last-only
    >
      {{ block.englishWritingMeta.signOff }}
    </div>
  </section>
</template>
<style scoped>
.salutation,
.sign-off {
  padding-top: 1mm;
  white-space: pre-line;
}
.sign-off {
  text-align: right;
}
</style>
