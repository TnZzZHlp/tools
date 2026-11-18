<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DialogTitle } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <DialogTitle
    v-bind="forwarded"
    :class="cn('text-[17px] font-medium text-ink', attrs.class as ClassValue)"
  >
    <slot />
  </DialogTitle>
</template>
