<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PaginationList } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <PaginationList
    v-slot="{ items }"
    v-bind="forwarded"
    :class="cn('flex flex-wrap items-center gap-1', attrs.class as ClassValue)"
  >
    <slot :items="items" />
  </PaginationList>
</template>
