<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionRoot } from 'reka-ui'

defineOptions({ name: 'UiAccordion', inheritAttrs: false })

export type AccordionProps = {
  /** Whether one item or several items can stay open at once. */
  type?: 'single' | 'multiple'
  /** Allows closing the active item when `type` is `"single"`. */
  collapsible?: boolean
  defaultValue?: string | string[]
  disabled?: boolean
  unmountOnHide?: boolean
}

const props = withDefaults(defineProps<AccordionProps>(), {
  type: undefined,
  collapsible: true,
  defaultValue: undefined,
  disabled: false,
  unmountOnHide: true,
})

const model = defineModel<string | string[]>()
const resolvedType = computed<'single' | 'multiple'>(
  () => props.type ?? (Array.isArray(model.value ?? props.defaultValue) ? 'multiple' : 'single'),
)

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionRoot
    v-model="model"
    v-bind="forwarded"
    :type="resolvedType"
    :collapsible="collapsible"
    :default-value="defaultValue"
    :disabled="disabled"
    :unmount-on-hide="unmountOnHide"
    :class="cn('w-full', attrs.class as ClassValue)"
  >
    <slot />
  </AccordionRoot>
</template>
