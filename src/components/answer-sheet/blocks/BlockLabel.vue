<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    displayNo: string
    score?: number
    punctuation?: boolean
  }>(),
  { punctuation: true },
)

const needsComma = computed(() => {
  if (!props.punctuation) return false
  const text = props.displayNo.trim()
  if (!text) return false
  if (/[、，,.:：]$/.test(text)) return false
  // Circled numerals like ① ② without parent no do not take a comma unless score follows
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(text) && props.score === undefined) return false
  return true
})
</script>
<template>
  <span class="sheet-label"
    >{{ displayNo }}<template v-if="needsComma">、</template
    ><span v-if="score !== undefined">({{ score }}分)</span></span
  >
</template>
