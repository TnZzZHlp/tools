<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { StyleValue } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { sparklinePath } from './geometry'

defineOptions({ name: 'UiSparkline', inheritAttrs: false })

export type SparklineTone = 'default' | 'accent' | 'accent-alt'

export type SparklineProps = {
  values: readonly number[]
  /** Upper bound of the value axis; defaults to the median-based scale. */
  max?: number
  /** Draws a 1px rule at the bottom of the strip. */
  baseline?: boolean
  tone?: SparklineTone
  /** Accessible name. Without it the graphic is hidden from assistive technology. */
  ariaLabel?: string
  /** Bars are laid out across this many slots; the newest sits at the right edge. */
  slots?: number
  /**
   * Strip height, `font-size` relative. The reference puts the strip beside the 26px
   * value text, so `0.7em` there is about 18px; inside a Stat the figure slot
   * inherits that font size, and standalone use should set a font size on the parent.
   */
  height?: string
}

const props = withDefaults(defineProps<SparklineProps>(), {
  max: undefined,
  baseline: false,
  tone: 'default',
  ariaLabel: undefined,
  slots: undefined,
  height: '0.7em',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  return rest
})

const toneClass = computed(
  () =>
    ({
      default: 'text-ink-faint',
      accent: 'text-accent',
      'accent-alt': 'text-danger',
    })[props.tone],
)

const path = computed(() =>
  sparklinePath({ values: props.values, slots: props.slots, max: props.max }),
)
const viewWidth = computed(() =>
  Math.max(props.slots ?? props.values.length, props.values.length, 1),
)

const labelled = computed(() => props.ariaLabel !== undefined)
</script>

<template>
  <svg
    v-bind="forwarded"
    :viewBox="`0 0 ${viewWidth} 1`"
    :style="[{ height: props.height }, attrs.style as StyleValue]"
    preserveAspectRatio="none"
    :class="
      cn(
        'block w-full transition-colors duration-[var(--p0seid0n-duration-normal)] ease-out-expo motion-reduce:transition-none',
        props.baseline ? 'border-b border-line' : undefined,
        toneClass,
        attrs.class as ClassValue,
      )
    "
    :role="labelled ? 'img' : undefined"
    :aria-label="props.ariaLabel"
    :aria-hidden="labelled ? undefined : 'true'"
  >
    <path :d="path" fill="currentColor" />
  </svg>
</template>
