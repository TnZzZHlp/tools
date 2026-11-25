<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { MenuItem as SdkMenuItem } from '@ui-sdk/vue/menu'
import { emitMenuSelect } from './selection'
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

function onSelect(event: Event) {
  emitMenuSelect(event, (select) => emit('select', select))
}

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkMenuItem
    v-bind="forwarded"
    :disabled="disabled"
    :label="textValue"
    :class="cn(menuItem, attrs.class as ClassValue)"
    @select="onSelect"
  >
    <slot />
  </SdkMenuItem>
</template>
