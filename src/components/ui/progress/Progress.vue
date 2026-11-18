<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ProgressIndicator, ProgressRoot } from 'reka-ui'

defineOptions({ name: 'UiProgress', inheritAttrs: false })

export type ProgressTone = 'default' | 'accent' | 'danger'

export type ProgressProps = {
  /** Current value; omit or pass `null` for an indeterminate bar. */
  modelValue?: number | null
  max?: number
  tone?: ProgressTone
}

const props = withDefaults(defineProps<ProgressProps>(), {
  modelValue: null,
  max: 100,
  tone: 'default',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

const safeMax = computed(() =>
  typeof props.max === 'number' && Number.isFinite(props.max) && props.max > 0 ? props.max : 100,
)

const isIndeterminate = computed(
  () =>
    props.modelValue === null ||
    props.modelValue === undefined ||
    !Number.isFinite(props.modelValue),
)

const percentage = computed(() => {
  if (isIndeterminate.value || typeof props.modelValue !== 'number') return 0
  return Math.min(100, Math.max(0, (props.modelValue / safeMax.value) * 100))
})

const toneClass = computed(() => {
  if (props.tone === 'accent') return 'bg-accent'
  if (props.tone === 'danger') return 'bg-danger'
  return 'bg-ink'
})
</script>

<template>
  <ProgressRoot
    :model-value="modelValue"
    :max="safeMax"
    v-bind="forwarded"
    :class="
      cn('relative h-2.5 w-full overflow-hidden rounded-full bg-control', attrs.class as ClassValue)
    "
  >
    <ProgressIndicator
      :class="
        cn(
          'h-full rounded-full',
          toneClass,
          isIndeterminate
            ? 'w-2/5 motion-safe:animate-progress-indeterminate motion-reduce:translate-x-3/4'
            : 'w-full flex-1 transition-transform duration-[var(--p0seid0n-duration-slow)] ease-out-expo motion-reduce:transition-none',
        )
      "
      :style="isIndeterminate ? undefined : { transform: `translateX(-${100 - percentage}%)` }"
    />
  </ProgressRoot>
</template>
