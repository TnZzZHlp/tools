<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TableCaptionPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TableCaptionPart
    v-bind="forwarded"
    :class="cn('mt-3 text-[12px] text-ink-faint', attrs.class as ClassValue)"
  >
    <slot />
  </TableCaptionPart>
</template>
