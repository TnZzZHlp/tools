<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <kbd
    v-bind="forwarded"
    :class="
      cn(
        'ml-auto rounded-[6px] border border-line px-1.5 py-0.5 font-sans text-[11px] text-ink-muted',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </kbd>
</template>
