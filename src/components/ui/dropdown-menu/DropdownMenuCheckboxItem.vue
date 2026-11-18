<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator } from 'reka-ui'
import { menuItem } from './styles'

defineOptions({ inheritAttrs: false })

export type DropdownMenuCheckboxItemProps = {
  disabled?: boolean
  textValue?: string
}

withDefaults(defineProps<DropdownMenuCheckboxItemProps>(), {
  disabled: false,
  textValue: undefined,
})

const model = defineModel<boolean>({ default: false })
const emit = defineEmits<{ select: [event: Event] }>()

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <DropdownMenuCheckboxItem
    v-model="model"
    v-bind="forwarded"
    :disabled="disabled"
    :text-value="textValue"
    :class="cn(menuItem, attrs.class as ClassValue)"
    @select="emit('select', $event)"
  >
    <span class="flex size-3.5 shrink-0 items-center justify-center">
      <DropdownMenuItemIndicator
        class="flex items-center justify-center text-ink motion-safe:animate-check-in data-[state=unchecked]:motion-safe:animate-check-out"
      >
        <slot name="indicator">
          <span class="size-1.5 rounded-full bg-ink" />
        </slot>
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
