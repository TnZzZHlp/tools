<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableHeadPart } from './parts'

defineOptions({ inheritAttrs: false })

export type TableHeadProps = {
  /** Aligns the column header to the right for numeric values. */
  numeric?: boolean
}

withDefaults(defineProps<TableHeadProps>(), {
  numeric: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TableHeadPart
    v-bind="forwarded"
    :class="
      cn(
        'h-10 px-3 text-left align-middle text-[12px] font-medium text-ink-muted [&:has([role=checkbox])]:pr-0',
        numeric && 'text-right',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </TableHeadPart>
</template>
