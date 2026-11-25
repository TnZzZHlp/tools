<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationPrevious as SdkPaginationPrev } from '@ui-sdk/vue/pagination'
import { RenderChild } from '@/lib/render-child'
import { paginationButton } from './styles'

defineOptions({ inheritAttrs: false })

export type PaginationPrevProps = {
  asChild?: boolean
}

withDefaults(defineProps<PaginationPrevProps>(), {
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
  <SdkPaginationPrev v-bind="forwarded" :class="cn(paginationButton, attrs.class as ClassValue)">
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
        <path d="M10 12 6 8l4-4" />
      </svg>
    </slot>
  </SdkPaginationPrev>
</template>
