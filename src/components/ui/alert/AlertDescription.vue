<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <div
    v-bind="forwarded"
    :class="cn('text-[13px] leading-relaxed text-ink-muted', attrs.class as ClassValue)"
  >
    <slot />
  </div>
</template>
