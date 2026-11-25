<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationEllipsis as SdkPaginationEllipsis } from '@ui-sdk/vue/pagination'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkPaginationEllipsis
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex size-9 items-center justify-center text-ink-faint select-none',
        attrs.class as ClassValue,
      )
    "
  >
    <slot>
      <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="3.5" cy="8" r="1.25" />
        <circle cx="8" cy="8" r="1.25" />
        <circle cx="12.5" cy="8" r="1.25" />
      </svg>
    </slot>
  </SdkPaginationEllipsis>
</template>
