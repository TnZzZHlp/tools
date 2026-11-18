<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationFirst } from 'reka-ui'
import { paginationButton } from './styles'

defineOptions({ inheritAttrs: false })

export type PaginationFirstProps = {
  asChild?: boolean
}

withDefaults(defineProps<PaginationFirstProps>(), {
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
  <PaginationFirst
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
        <path d="M11 12 7 8l4-4" />
        <path d="M6 12 2 8l4-4" />
      </svg>
    </slot>
  </PaginationFirst>
</template>
