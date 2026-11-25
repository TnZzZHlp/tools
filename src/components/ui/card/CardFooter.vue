<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CardFooterPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <CardFooterPart
    v-bind="forwarded"
    :class="
      cn(
        'flex items-center justify-between gap-3 border-t border-line px-6 py-4 text-[13px] text-ink-muted',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </CardFooterPart>
</template>
