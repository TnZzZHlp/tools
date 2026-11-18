<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectLabel } from 'reka-ui'
import { selectLabel } from './styles'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SelectLabel v-bind="forwarded" :class="cn(selectLabel, attrs.class as ClassValue)">
    <slot />
  </SelectLabel>
</template>
