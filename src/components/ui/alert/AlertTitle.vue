<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AlertTitlePart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AlertTitlePart
    v-bind="forwarded"
    :class="cn('text-[14px] leading-snug font-semibold text-ink', attrs.class as ClassValue)"
  >
    <slot />
  </AlertTitlePart>
</template>
