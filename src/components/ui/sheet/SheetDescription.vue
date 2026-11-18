<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DialogDescription } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <DialogDescription
    v-bind="forwarded"
    :class="cn('text-[14px] leading-relaxed text-ink-muted', attrs.class as ClassValue)"
  >
    <slot />
  </DialogDescription>
</template>
