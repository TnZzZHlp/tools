<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableFooterPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TableFooterPart
    v-bind="forwarded"
    :class="
      cn(
        'border-t border-line bg-control font-medium [&>tr]:last:border-b-0',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </TableFooterPart>
</template>
