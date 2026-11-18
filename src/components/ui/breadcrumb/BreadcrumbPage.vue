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
  <span
    role="link"
    aria-disabled="true"
    aria-current="page"
    v-bind="forwarded"
    :class="cn('font-medium text-ink', attrs.class as ClassValue)"
  >
    <slot />
  </span>
</template>
