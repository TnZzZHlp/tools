<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import {
  createSliderController,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from '@ui-sdk/vue/slider'
import { reverseSliderValues, sliderStepMax } from './inverted-values'
import { SliderRoot, SliderThumbInput } from './parts'

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
const controller = createSliderController()
const stepMax = computed(() => sliderStepMax(props.min, props.max, props.step))
const value = computed(() => (model.value === undefined ? undefined : toSdkValue(model.value)))
const initial = computed(() => toSdkValue(props.defaultValue))

function toSdkValue(values: number[]) {
  return props.inverted ? reverseSliderValues(values, props.min, stepMax.value) : values
}

function arrayValue(value: number | number[]) {
  return Array.isArray(value) ? value : [value]
}

function toModel(value: number | number[]) {
  return toSdkValue(arrayValue(value))
}

function onCommit(value: number | number[]) {
  emit('valueCommit', toModel(value))
}

function invertedKeydown(event: KeyboardEvent) {
  if (!props.inverted || event.defaultPrevented || !['Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = [...arrayValue(controller.getValue())]
  if (event.key === 'Home') next[next.length - 1] = stepMax.value
  else next[0] = props.min
  if (controller.setValue(next, { reason: 'step-key', event })) onCommit(controller.getValue())
}

function invertedFill(value: number) {
  const span = props.max - props.min
  return span > 0 ? `${Math.max(0, Math.min(100, (100 * (props.max - value)) / span))}%` : '0%'
}

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
    v-slot="{ state }"
    v-bind="forwarded"
    :value="value"
    :default-value="initial"
    :min="min"
    :max="max"
    :step="step"
    :large-step="step * 10"
    :min-steps-between-thumbs="minStepsBetweenThumbs"
    :orientation="orientation"
    :disabled="disabled"
    :controller="controller"
    :class="
      cn(
        'relative w-full min-w-0 touch-none select-none',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-fit',
        'data-[disabled]:opacity-55',
        attrs.class as ClassValue,
      )
    "
    @update:value="model = toModel($event)"
    @value-commit="onCommit"
  >
    <SliderControl
      class="flex min-h-5 items-center p-0 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:min-w-5 data-[orientation=vertical]:justify-center"
    >
      <SliderTrack
        class="relative h-2 w-full rounded-full bg-control data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-2"
      >
        <div
          v-if="inverted && arrayValue(state.value).length === 1"
          :class="
            cn(
              'pointer-events-none absolute rounded-full bg-ink',
              orientation === 'vertical' ? 'inset-x-0 top-0' : 'inset-y-0 end-0',
            )
          "
          :style="{
            [orientation === 'vertical' ? 'height' : 'width']: invertedFill(
              arrayValue(state.value)[0] ?? props.min,
            ),
          }"
        />
        <SliderIndicator v-else class="rounded-full bg-ink" />
        <SliderThumb
          v-for="(_, index) in arrayValue(state.value)"
          :key="index"
          :index="inverted ? arrayValue(state.value).length - 1 - index : index"
          :aria-label="thumbAriaLabel(index)"
          :aria-labelledby="thumbAriaLabelledby"
          :class="
            cn(
              'block size-5 rounded-full border-2 border-ink bg-raised shadow-sm',
              'outline-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
              'transition-[scale] duration-[var(--p0seid0n-duration-fast)] ease-spring hover:scale-105 data-dragging:scale-95 motion-reduce:transition-none',
              'data-[disabled]:pointer-events-none',
            )
          "
        >
          <template v-if="inverted" #render="{ props: part, state: thumbState }">
            <div v-bind="part">
              <SliderThumbInput
                :index="thumbState.index"
                :aria-label="thumbAriaLabel(index)"
                :aria-labelledby="thumbAriaLabelledby"
                class="sr-only"
                @keydown="invertedKeydown"
              >
                <template #render="{ props: input }">
                  <input
                    v-bind="input"
                    :aria-valuenow="toModel(state.value)[index]"
                    :aria-valuetext="String(toModel(state.value)[index])"
                  />
                </template>
              </SliderThumbInput>
            </div>
          </template>
        </SliderThumb>
      </SliderTrack>
    </SliderControl>
    <template v-if="name">
      <input
        v-for="(number, index) in toModel(state.value)"
        :key="index"
        type="hidden"
        :name="`${name}[${index}]`"
        :value="number"
        :disabled="state.disabled"
      />
    </template>
  </SliderRoot>
</template>
