<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiStat', inheritAttrs: false })

export type StatTone = 'default' | 'accent' | 'accent-alt'

export type StatProps = {
  label: string
  /** Preformatted value. Null or undefined renders `emptyText`. */
  value?: string | number | null
  unit?: string
  emptyText?: string
  /** Colours the value; `accent-alt` uses the theme danger colour. */
  tone?: StatTone
}

const props = withDefaults(defineProps<StatProps>(), {
  value: null,
  unit: undefined,
  emptyText: '—',
  tone: 'default',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

const isEmpty = computed(
  () => props.value === null || props.value === undefined || props.value === '',
)

const toneClass = computed(
  () =>
    ({
      default: 'text-ink',
      accent: 'text-accent',
      'accent-alt': 'text-danger',
    })[props.tone],
)
</script>

<template>
  <div v-bind="forwarded" :class="cn('flex flex-col', attrs.class as ClassValue)">
    <span class="text-[13px] font-medium text-ink-muted">{{ label }}</span>
    <div class="mt-1 flex items-baseline gap-0">
      <span
        :class="
          cn(
            'font-condensed text-[26px] leading-none font-medium tracking-[-0.01em] tabular-nums',
            'max-sm:text-[24px] lg:text-[28px]',
            isEmpty ? 'text-ink-faint' : toneClass,
          )
        "
      >
        {{ isEmpty ? emptyText : value }}
      </span>
      <span
        v-if="unit && !isEmpty"
        class="ml-1.5 font-sans text-[14px] font-normal text-ink-muted lg:text-[16px]"
        >{{ unit }}</span
      >
      <span
        v-if="$slots.figure"
        class="min-w-0 flex-1 pl-3 font-condensed text-[26px] leading-none max-sm:text-[24px] lg:text-[28px]"
      >
        <slot name="figure" />
      </span>
    </div>
  </div>
</template>
