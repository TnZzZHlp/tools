<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Pagination as PaginationRoot } from '@ui-sdk/vue/pagination'

defineOptions({ name: 'UiPagination', inheritAttrs: false })

export type PaginationProps = {
  total?: number
  itemsPerPage?: number
  siblingCount?: number
  showEdges?: boolean
  defaultPage?: number
  disabled?: boolean
}

withDefaults(defineProps<PaginationProps>(), {
  total: 0,
  itemsPerPage: 10,
  siblingCount: 1,
  showEdges: true,
  defaultPage: 1,
  disabled: false,
})

const page = defineModel<number>('page')

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <PaginationRoot
    v-slot="{ state }"
    v-model:page="page"
    aria-label="Pagination"
    v-bind="forwarded"
    :default-page="defaultPage"
    :total="total"
    :page-size="itemsPerPage"
    :siblings="siblingCount"
    :boundaries="showEdges ? 1 : 0"
    :disabled="disabled"
    :class="cn('mx-auto flex w-full justify-center', attrs.class as ClassValue)"
  >
    <slot :page="state.page" :page-count="state.pageCount" />
  </PaginationRoot>
</template>
