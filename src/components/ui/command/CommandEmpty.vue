<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { useCommandContext } from './context'

defineOptions({ inheritAttrs: false })

const context = useCommandContext()

const isEmpty = computed(
  () =>
    !context.filterDisabled.value &&
    context.search.value.trim().length > 0 &&
    context.visibleIds.value.size === 0,
)

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <div
    v-if="isEmpty"
    role="presentation"
    v-bind="forwarded"
    :class="cn('py-6 text-center text-[13px] text-ink-muted', attrs.class as ClassValue)"
  >
    <slot />
  </div>
</template>
