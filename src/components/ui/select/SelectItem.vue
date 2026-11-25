<script setup lang="ts">
import { computed, inject, useAttrs, watchEffect } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import {
  SelectItem as SdkSelectItem,
  SelectItemIndicator,
  SelectItemText,
} from '@ui-sdk/vue/select'
import { selectItem } from './styles'
import { selectItems } from './selection'

defineOptions({ inheritAttrs: false })

export type SelectItemProps = {
  value: string
  disabled?: boolean
  textValue?: string
}

const props = withDefaults(defineProps<SelectItemProps>(), {
  disabled: false,
  textValue: undefined,
})

const emit = defineEmits<{ select: [event: Event] }>()
const items = inject(selectItems)
watchEffect((onCleanup) => {
  const value = props.value
  items?.set(value, (event) => emit('select', event))
  onCleanup(() => items?.delete(value))
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkSelectItem
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :label="textValue"
    :class="cn(selectItem, attrs.class as ClassValue)"
  >
    <span class="flex size-3.5 shrink-0 items-center justify-center">
      <SelectItemIndicator
        class="flex items-center justify-center text-ink before:hidden motion-safe:animate-check-in data-ending-style:motion-safe:animate-check-out"
      >
        <slot name="indicator">
          <span class="size-1.5 rounded-full bg-ink" />
        </slot>
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </SdkSelectItem>
</template>
