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
  <ol
    v-bind="forwarded"
    :class="
      cn(
        'm-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-[13px] break-words text-ink-muted sm:gap-2',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </ol>
</template>
