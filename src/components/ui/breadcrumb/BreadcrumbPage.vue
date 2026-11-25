<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BreadcrumbPagePart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <BreadcrumbPagePart
    v-bind="forwarded"
    :class="cn('font-medium text-ink', attrs.class as ClassValue)"
  >
    <slot />
  </BreadcrumbPagePart>
</template>
