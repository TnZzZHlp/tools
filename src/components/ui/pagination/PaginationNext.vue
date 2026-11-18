<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationNext } from 'reka-ui'
import { paginationButton } from './styles'

defineOptions({ inheritAttrs: false })

export type PaginationNextProps = {
  asChild?: boolean
}

withDefaults(defineProps<PaginationNextProps>(), {
  asChild: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <PaginationNext
    v-bind="forwarded"
    :as-child="asChild"
    :class="cn(paginationButton, attrs.class as ClassValue)"
  >
    <slot>
      <svg
        class="size-3.5"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 12 4-4-4-4" />
      </svg>
    </slot>
  </PaginationNext>
</template>
