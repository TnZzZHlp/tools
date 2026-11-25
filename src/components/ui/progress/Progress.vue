<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Progress as ProgressRoot, ProgressIndicator } from '@ui-sdk/vue/progress'

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

const value = computed(() => (isIndeterminate.value ? null : props.modelValue))

const toneClass = computed(() => {
  if (props.tone === 'accent') return 'bg-accent'
  if (props.tone === 'danger') return 'bg-danger'
  return 'bg-ink'
})
</script>

<template>
  <ProgressRoot
    :value="value"
    :max="safeMax"
    v-bind="forwarded"
    :class="
      cn(
        'relative block h-2.5 w-full min-w-0 overflow-hidden rounded-full bg-control',
        attrs.class as ClassValue,
      )
    "
  >
    <ProgressIndicator
      :class="
        cn(
          'relative inset-auto h-full rounded-full bg-none',
          toneClass,
          isIndeterminate
            ? 'w-2/5 motion-safe:animate-progress-indeterminate motion-reduce:translate-x-3/4'
            : 'transition-[width] duration-[var(--p0seid0n-duration-slow)] ease-out-expo motion-reduce:transition-none',
        )
      "
    />
  </ProgressRoot>
</template>
