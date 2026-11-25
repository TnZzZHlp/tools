<script setup lang="ts">
import type { ChangeDetails } from '@ui-sdk/core'
import {
  Select as SelectRoot,
  type SelectOpenChangeReason,
  type SelectValueChangeReason,
} from '@ui-sdk/vue/select'
import { provide } from 'vue'
import { selectItems } from './selection'

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

const props = withDefaults(defineProps<SelectProps>(), {
  defaultValue: undefined,
  defaultOpen: undefined,
  disabled: false,
  name: undefined,
  required: false,
  autocomplete: undefined,
})

const model = defineModel<string>()
const open = defineModel<boolean | undefined>('open', { default: undefined })
const items = new Map<string, (event: Event) => void>()
const selections = new WeakMap<Event, boolean>()
provide(selectItems, items)

function emitSelection(value: string, originalEvent: Event | undefined) {
  const event = new CustomEvent('select.select', {
    bubbles: true,
    cancelable: true,
    detail: { originalEvent, value },
  })
  items.get(value)?.(event)
  return event.defaultPrevented
}

function onValueChange(value: string | null, details: ChangeDetails<SelectValueChangeReason>) {
  if (value === null || details.reason !== 'item-press') return
  const canceled = emitSelection(value, details.event)
  if (details.event) selections.set(details.event, canceled)
  if (canceled) details.cancel()
}

function onOpenChange(next: boolean, details: ChangeDetails<SelectOpenChangeReason>) {
  if (next || details.reason !== 'item-press') return
  const event = details.event
  const current = model.value ?? props.defaultValue
  const canceled =
    (event && selections.get(event)) ?? (current !== undefined && emitSelection(current, event))
  if (event) selections.delete(event)
  if (canceled) details.cancel()
}
</script>

<template>
  <SelectRoot
    v-model:open="open"
    :multiple="false"
    :value="model === '' ? null : model"
    :default-value="defaultValue || undefined"
    :default-open="defaultOpen"
    :disabled="disabled"
    :name="name"
    :required="required"
    :auto-complete="autocomplete"
    v-bind="$attrs"
    @value-change="onValueChange"
    @open-change="onOpenChange"
    @update:value="model = $event ?? ''"
  >
    <slot />
  </SelectRoot>
</template>
