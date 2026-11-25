<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BreadcrumbPart } from './parts'

defineOptions({ name: 'UiBreadcrumb', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <BreadcrumbPart v-bind="forwarded" :class="cn(attrs.class as ClassValue)">
    <slot />
  </BreadcrumbPart>
</template>
