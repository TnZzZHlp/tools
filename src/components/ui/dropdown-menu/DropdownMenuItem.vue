<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DropdownMenuItem } from 'reka-ui'
import { menuItem } from './styles'

defineOptions({ inheritAttrs: false })

export type DropdownMenuItemProps = {
  disabled?: boolean
  /** Text used for typeahead when the item renders non-text content. */
  textValue?: string
}

withDefaults(defineProps<DropdownMenuItemProps>(), {
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
  <DropdownMenuItem
    v-bind="forwarded"
    :disabled="disabled"
    :text-value="textValue"
    :class="cn(menuItem, attrs.class as ClassValue)"
    @select="emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
