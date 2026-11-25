<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableBodyPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TableBodyPart
    v-bind="forwarded"
    :class="cn('[&_tr:last-child]:border-0', attrs.class as ClassValue)"
  >
    <slot />
  </TableBodyPart>
</template>
