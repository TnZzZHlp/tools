<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TablePart } from './parts'

defineOptions({ name: 'UiTable', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <div class="relative w-full overflow-x-auto">
    <TablePart
      v-bind="forwarded"
      :class="
        cn('w-full caption-bottom border-collapse text-[14px] text-ink', attrs.class as ClassValue)
      "
    >
      <slot />
    </TablePart>
  </div>
</template>
