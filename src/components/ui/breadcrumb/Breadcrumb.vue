<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiBreadcrumb', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <nav aria-label="Breadcrumb" v-bind="forwarded" :class="cn(attrs.class as ClassValue)">
    <slot />
  </nav>
</template>
