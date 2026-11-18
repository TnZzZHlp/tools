<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Toggle as ToggleRoot } from 'reka-ui'
import { toggleVariants, type ToggleSize, type ToggleVariant } from './variants'

defineOptions({ name: 'UiToggle', inheritAttrs: false })

export type ToggleProps = {
  /** Initial pressed state when uncontrolled. */
  defaultValue?: boolean
  disabled?: boolean
  variant?: ToggleVariant
  size?: ToggleSize
  name?: string
  required?: boolean
}

withDefaults(defineProps<ToggleProps>(), {
  defaultValue: false,
  disabled: false,
  variant: 'default',
  size: 'md',
  name: undefined,
  required: false,
})

const model = defineModel<boolean>()

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ToggleRoot
    v-slot="slotProps"
    v-model="model"
    v-bind="forwarded"
    :default-value="defaultValue"
    :disabled="disabled"
    :name="name"
    :required="required"
    :class="cn(toggleVariants({ variant, size }), attrs.class as ClassValue)"
  >
    <slot v-bind="slotProps" />
  </ToggleRoot>
</template>
