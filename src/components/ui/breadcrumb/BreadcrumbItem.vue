<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BreadcrumbItemPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <BreadcrumbItemPart
    v-bind="forwarded"
    :class="cn('m-0 inline-flex list-none items-center gap-1.5', attrs.class as ClassValue)"
  >
    <slot />
  </BreadcrumbItemPart>
</template>
