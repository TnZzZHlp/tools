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
    :class="cn('flex items-start justify-between gap-4 px-6 pt-5 pb-4', attrs.class as ClassValue)"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h3
        v-if="$slots.title || $slots.default"
        class="text-[15px] leading-tight font-medium text-ink"
      >
        <slot name="title">
          <slot />
        </slot>
      </h3>
      <slot name="description" />
    </div>
    <slot name="action" />
  </div>
</template>
