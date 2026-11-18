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
  <tr
    v-bind="forwarded"
    :class="
      cn(
        'border-b border-line transition-colors duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
        'hover:bg-[color-mix(in_oklab,var(--color-control)_55%,transparent)] data-[state=selected]:bg-control',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </tr>
</template>
