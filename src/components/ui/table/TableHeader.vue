<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableHeaderPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TableHeaderPart
    v-bind="forwarded"
    :class="cn('[&_tr]:border-b [&_tr]:border-line', attrs.class as ClassValue)"
  >
    <slot />
  </TableHeaderPart>
</template>
