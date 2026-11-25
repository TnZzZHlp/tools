<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationFirst as SdkPaginationFirst } from '@ui-sdk/vue/pagination'
import { RenderChild } from '@/lib/render-child'
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
  <SdkPaginationFirst v-bind="forwarded" :class="cn(paginationButton, attrs.class as ClassValue)">
    <template v-if="asChild" #render="{ props: part }">
      <RenderChild v-bind="part"><slot /></RenderChild>
    </template>
    <slot v-if="!asChild">
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
  </SdkPaginationFirst>
</template>
