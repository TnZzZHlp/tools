<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Accordion as AccordionRoot } from '@ui-sdk/vue/accordion'
import { navigateAccordion } from './keyboard'

defineOptions({ name: 'UiAccordion', inheritAttrs: false })

export type AccordionProps = {
  /** Whether one item or several items can stay open at once. */
  type?: 'single' | 'multiple'
  /** Allows closing the active item when `type` is `"single"`. */
  collapsible?: boolean
  defaultValue?: string | string[]
  disabled?: boolean
  unmountOnHide?: boolean
  orientation?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<AccordionProps>(), {
  type: undefined,
  collapsible: true,
  defaultValue: undefined,
  disabled: false,
  unmountOnHide: false,
  orientation: 'vertical',
})

const model = defineModel<string | string[]>()
const resolvedType = computed<'single' | 'multiple'>(
  () => props.type ?? (Array.isArray(model.value ?? props.defaultValue) ? 'multiple' : 'single'),
)

function toValues(value: string | string[] | undefined) {
  return typeof value === 'string' ? (value ? [value] : []) : value
}

function updateValue(values: string[]) {
  model.value = resolvedType.value === 'multiple' ? values : (values[0] ?? '')
}

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionRoot
    v-bind="forwarded"
    :value="toValues(model)"
    :multiple="resolvedType === 'multiple'"
    :collapsible="collapsible"
    :default-value="toValues(defaultValue)"
    :disabled="disabled"
    :keep-mounted="!unmountOnHide"
    :data-orientation="orientation"
    :class="cn('w-full max-w-none border-t-0', attrs.class as ClassValue)"
    @update:value="updateValue"
    @keydown="navigateAccordion($event, orientation)"
  >
    <slot />
  </AccordionRoot>
</template>
