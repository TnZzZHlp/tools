<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SkeletonPart } from './parts'

defineOptions({ name: 'UiSkeleton', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SkeletonPart
    v-bind="forwarded"
    :class="cn('rounded-control bg-control motion-safe:animate-pulse', attrs.class as ClassValue)"
  />
</template>
