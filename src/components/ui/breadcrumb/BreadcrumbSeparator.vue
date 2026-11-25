<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BreadcrumbSeparatorPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <BreadcrumbSeparatorPart
    v-bind="forwarded"
    :class="
      cn(
        'm-0 inline-flex list-none items-center text-ink-faint select-none [&>svg]:size-3.5',
        attrs.class as ClassValue,
      )
    "
  >
    <slot>/</slot>
  </BreadcrumbSeparatorPart>
</template>
