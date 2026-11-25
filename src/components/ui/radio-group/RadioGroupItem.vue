<script setup lang="ts">
import { computed, inject, useAttrs, watchEffect } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Radio as RadioGroupItem, RadioIndicator as RadioGroupIndicator } from '@ui-sdk/vue/radio'
import { requiredRadioItems } from './context'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest['aria-invalid']
  return rest
})

export type RadioGroupItemProps = {
  value: string
  disabled?: boolean
  id?: string
  required?: boolean
  /** Marks the control as invalid and paints the border with the danger colour. */
  invalid?: boolean
}

const props = withDefaults(defineProps<RadioGroupItemProps>(), {
  disabled: false,
  id: undefined,
  required: false,
  invalid: false,
})

const requiredItems = inject(requiredRadioItems)
if (requiredItems) {
  const key = Symbol()
  watchEffect((onCleanup) => {
    if (!props.required) return
    requiredItems.add(key)
    onCleanup(() => requiredItems.delete(key))
  })
}

const ariaInvalid = computed(() => {
  if (props.invalid) return 'true'
  return attrs['aria-invalid'] as 'true' | 'false' | 'grammar' | 'spelling' | undefined
})
</script>

<template>
  <RadioGroupItem
    v-bind="forwarded"
    :id="id"
    :value="value"
    :disabled="disabled"
    :aria-invalid="ariaInvalid"
    :class="
      cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-control text-surface',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
        'data-checked:border-ink data-checked:bg-ink',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger',
        'disabled:cursor-default disabled:opacity-55',
        'transition-[background-color,border-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
        attrs.class as ClassValue,
      )
    "
  >
    <RadioGroupIndicator
      class="flex items-center justify-center motion-safe:animate-check-in data-ending-style:motion-safe:animate-check-out"
    >
      <slot name="indicator">
        <span class="size-2 rounded-full bg-surface" />
      </slot>
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
