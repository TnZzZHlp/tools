<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CardContentPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <CardContentPart
    v-bind="forwarded"
    :class="cn('px-6 py-4 text-[14px] text-ink-muted', attrs.class as ClassValue)"
  >
    <slot />
  </CardContentPart>
</template>
