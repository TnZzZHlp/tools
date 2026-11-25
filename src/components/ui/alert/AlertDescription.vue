<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AlertDescriptionPart } from './parts'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AlertDescriptionPart
    v-bind="forwarded"
    :class="cn('text-[13px] leading-relaxed text-ink-muted', attrs.class as ClassValue)"
  >
    <slot />
  </AlertDescriptionPart>
</template>
