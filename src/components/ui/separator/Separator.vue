<script setup lang="ts">
import { Separator as SdkSeparator } from '@ui-sdk/vue/separator'
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiSeparator', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

export type SeparatorProps = {
  orientation?: 'horizontal' | 'vertical'
  /** Marks the separator as presentational; it is then hidden from assistive tech. */
  decorative?: boolean
}

const props = withDefaults(defineProps<SeparatorProps>(), {
  orientation: 'horizontal',
  decorative: true,
})

const isVertical = computed(() => props.orientation === 'vertical')
</script>

<template>
  <SdkSeparator
    v-bind="forwarded"
    :class="
      cn(
        'shrink-0 bg-line',
        isVertical ? 'h-full w-px self-stretch' : 'h-px w-full',
        attrs.class as ClassValue,
      )
    "
    :decorative="decorative"
    :orientation="orientation"
    :aria-hidden="decorative ? 'true' : undefined"
  />
</template>
