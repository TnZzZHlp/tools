<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableCellPart } from './parts'

defineOptions({ inheritAttrs: false })

export type TableCellProps = {
  /** Right-aligns the cell and renders numerals in the condensed tabular font. */
  numeric?: boolean
}

withDefaults(defineProps<TableCellProps>(), {
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
  <TableCellPart
    v-bind="forwarded"
    :class="
      cn(
        'p-3 align-middle [&:has([role=checkbox])]:pr-0',
        numeric &&
          'text-right font-condensed text-[15px] font-medium tracking-[-0.01em] tabular-nums',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </TableCellPart>
</template>
