<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { selectItem } from './styles'

defineOptions({ inheritAttrs: false })

export type SelectItemProps = {
  value: string
  disabled?: boolean
  textValue?: string
}

withDefaults(defineProps<SelectItemProps>(), {
  disabled: false,
  textValue: undefined,
})

const emit = defineEmits<{ select: [event: Event] }>()

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SelectItem
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :text-value="textValue"
    :class="cn(selectItem, attrs.class as ClassValue)"
    @select="emit('select', $event)"
  >
    <span class="flex size-3.5 shrink-0 items-center justify-center">
      <SelectItemIndicator
        class="flex items-center justify-center text-ink motion-safe:animate-check-in data-[state=unchecked]:motion-safe:animate-check-out"
      >
        <slot name="indicator">
          <span class="size-1.5 rounded-full bg-ink" />
        </slot>
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
