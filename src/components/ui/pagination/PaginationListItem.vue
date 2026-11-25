<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationLink } from '@ui-sdk/vue/pagination'
import { RenderChild } from '@/lib/render-child'
import { paginationItemButton } from './styles'

defineOptions({ inheritAttrs: false })

export type PaginationListItemProps = {
  value: number
  asChild?: boolean
}

withDefaults(defineProps<PaginationListItemProps>(), {
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
  <PaginationLink
    v-bind="forwarded"
    :page="value"
    :class="cn(paginationItemButton, attrs.class as ClassValue)"
  >
    <template v-if="asChild" #render="{ props: part }">
      <RenderChild v-bind="part"><slot /></RenderChild>
    </template>
    <slot v-if="!asChild">{{ value }}</slot>
  </PaginationLink>
</template>
