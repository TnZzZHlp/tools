<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationListItem } from 'reka-ui'
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
  <PaginationListItem
    v-bind="forwarded"
    :value="value"
    :as-child="asChild"
    :class="cn(paginationItemButton, attrs.class as ClassValue)"
  >
    <slot>{{ value }}</slot>
  </PaginationListItem>
</template>
