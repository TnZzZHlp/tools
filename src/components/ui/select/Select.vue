<script setup lang="ts">
import { SelectRoot } from 'reka-ui'

defineOptions({ name: 'UiSelect', inheritAttrs: false })

export type SelectProps = {
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  disabled?: boolean
  name?: string
  required?: boolean
  autocomplete?: string
}

withDefaults(defineProps<SelectProps>(), {
  defaultValue: undefined,
  defaultOpen: undefined,
  disabled: false,
  name: undefined,
  required: false,
  autocomplete: undefined,
})

const model = defineModel<string>()
const open = defineModel<boolean>('open')
</script>

<template>
  <SelectRoot
    v-model="model"
    v-model:open="open"
    :default-value="defaultValue"
    :default-open="defaultOpen"
    :disabled="disabled"
    :name="name"
    :required="required"
    :autocomplete="autocomplete"
    v-bind="$attrs"
  >
    <slot />
  </SelectRoot>
</template>
