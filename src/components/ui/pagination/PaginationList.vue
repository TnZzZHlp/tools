<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationList as SdkPaginationList } from '@ui-sdk/vue/pagination'
import type { PaginationRangeItem } from '@ui-sdk/vue/pagination'

defineOptions({ inheritAttrs: false })

function toItems(items: PaginationRangeItem[]) {
  return items.map((item) =>
    typeof item === 'number'
      ? ({ type: 'page', value: item } as const)
      : ({ type: 'ellipsis' } as const),
  )
}

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkPaginationList
    v-bind="forwarded"
    :class="cn('flex flex-wrap items-center gap-1', attrs.class as ClassValue)"
  >
    <template #render="{ props: part, state }">
      <div v-bind="part"><slot :items="toItems(state.items)" /></div>
    </template>
  </SdkPaginationList>
</template>
