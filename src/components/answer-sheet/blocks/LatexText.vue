<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
const props = defineProps<{ text: string }>()
const host = ref<HTMLElement>()
const math = computed(() => /[\\^_{}]|^\$.*\$$/.test(props.text))
watchEffect(() => {
  if (!host.value || !math.value) return
  katex.render(props.text.replace(/^\$|\$$/g, ''), host.value, {
    throwOnError: false,
    trust: false,
    maxExpand: 100,
    maxSize: 8,
  })
})
</script>
<template>
  <span v-if="math" ref="host" class="sheet-formula" /><span v-else>{{ text }}</span>
</template>
<style scoped>
.sheet-formula {
  min-width: 0;
  max-width: 100%;
  display: inline-block;
  overflow: auto;
  vertical-align: middle;
}
</style>
