<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CheckboxIndicator, CheckboxRoot, type CheckboxCheckedState } from 'reka-ui'

defineOptions({ name: 'UiCheckbox', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest['aria-invalid']
  return rest
})

export type CheckboxProps = {
  defaultValue?: boolean | 'indeterminate'
  disabled?: boolean
  required?: boolean
  name?: string
  value?: string
  id?: string
  /** Marks the control as invalid and paints the border with the danger colour. */
  invalid?: boolean
}

const props = withDefaults(defineProps<CheckboxProps>(), {
  defaultValue: undefined,
  disabled: false,
  required: false,
  name: undefined,
  value: undefined,
  id: undefined,
  invalid: false,
})

const model = defineModel<CheckboxCheckedState>()

const ariaInvalid = computed(() => {
  if (props.invalid) return 'true'
  return attrs['aria-invalid'] as 'true' | 'false' | 'grammar' | 'spelling' | undefined
})
</script>

<template>
  <CheckboxRoot
    :id="id"
    v-slot="{ state }"
    v-model="model"
    v-bind="forwarded"
    :default-value="defaultValue"
    :disabled="disabled"
    :required="required"
    :name="name"
    :value="value"
    :aria-invalid="ariaInvalid"
    :class="
      cn(
        'peer inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-line bg-control text-surface',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
        'data-[state=checked]:border-ink data-[state=checked]:bg-ink',
        'data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger',
        'disabled:cursor-default disabled:opacity-55',
        'transition-[background-color,border-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
        attrs.class as ClassValue,
      )
    "
  >
    <CheckboxIndicator
      class="flex items-center justify-center text-current motion-safe:animate-check-in data-[state=unchecked]:motion-safe:animate-check-out"
    >
      <slot name="indicator" :state="state">
        <svg
          v-if="state === 'indeterminate'"
          class="size-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M2.5 6h7" />
        </svg>
        <svg
          v-else
          class="size-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
