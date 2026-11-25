<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CardPart } from './parts'

defineOptions({ name: 'UiCard', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

export type CardProps = {
  /** raised sits on the page surface; surface sits on a raised panel. */
  appearance?: 'raised' | 'surface'
}

const props = withDefaults(defineProps<CardProps>(), {
  appearance: 'raised',
})

const appearanceClass = computed(() =>
  props.appearance === 'surface' ? 'bg-surface' : 'bg-raised',
)
</script>

<template>
  <CardPart
    v-bind="forwarded"
    :class="
      cn(
        'flex flex-col rounded-panel border border-line',
        appearanceClass,
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </CardPart>
</template>
