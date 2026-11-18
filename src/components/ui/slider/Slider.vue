<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

defineOptions({ name: 'UiSlider', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest['aria-label']
  delete rest['aria-labelledby']
  return rest
})

export type SliderProps = {
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  minStepsBetweenThumbs?: number
  orientation?: 'horizontal' | 'vertical'
  disabled?: boolean
  inverted?: boolean
  name?: string
  /** Optional accessible labels per thumb; falls back to the root aria-label. */
  thumbLabels?: string[]
}

const props = withDefaults(defineProps<SliderProps>(), {
  defaultValue: () => [0],
  min: 0,
  max: 100,
  step: 1,
  minStepsBetweenThumbs: 0,
  orientation: 'horizontal',
  disabled: false,
  inverted: false,
  name: undefined,
  thumbLabels: undefined,
})

const model = defineModel<number[]>()
const emit = defineEmits<{ valueCommit: [value: number[]] }>()

function thumbAriaLabel(index: number): string | undefined {
  const custom = props.thumbLabels?.[index]
  if (custom !== undefined) return custom
  const raw = attrs['aria-label']
  return typeof raw === 'string' ? raw : undefined
}

const thumbAriaLabelledby = computed(() => {
  const raw = attrs['aria-labelledby']
  return typeof raw === 'string' ? raw : undefined
})
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue: values }"
    v-model="model"
    v-bind="forwarded"
    :default-value="defaultValue"
    :min="min"
    :max="max"
    :step="step"
    :min-steps-between-thumbs="minStepsBetweenThumbs"
    :orientation="orientation"
    :disabled="disabled"
    :inverted="inverted"
    :name="name"
    :class="
      cn(
        'relative flex w-full touch-none select-none items-center',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        'data-[disabled]:opacity-55',
        attrs.class as ClassValue,
      )
    "
    @value-commit="emit('valueCommit', $event)"
  >
    <SliderTrack
      class="relative h-2 w-full grow overflow-hidden rounded-full bg-control data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
    >
      <SliderRange
        class="absolute bg-ink data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>
    <SliderThumb
      v-for="(_, index) in values ?? defaultValue"
      :key="index"
      :aria-label="thumbAriaLabel(index)"
      :aria-labelledby="thumbAriaLabelledby"
      :class="
        cn(
          'block size-5 rounded-full border-2 border-ink bg-raised shadow-sm',
          'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
          'transition-transform duration-[var(--p0seid0n-duration-fast)] ease-spring hover:scale-105 active:scale-95 motion-reduce:transition-none',
          'data-[disabled]:pointer-events-none',
        )
      "
    />
  </SliderRoot>
</template>
