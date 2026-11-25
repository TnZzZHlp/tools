<script setup lang="ts">
import { Popover as PopoverRoot } from '@ui-sdk/vue/popover'
import { provide, ref, shallowRef } from 'vue'
import { popoverContext } from './context'

defineOptions({ name: 'UiPopover', inheritAttrs: false })

export type PopoverProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Disables interaction with outside elements while open. */
  modal?: boolean
}

withDefaults(defineProps<PopoverProps>(), {
  defaultOpen: undefined,
  modal: false,
})

const open = defineModel<boolean | undefined>('open', { default: undefined })
const trapFocus = ref(false)
provide(popoverContext, { anchor: shallowRef<HTMLElement>(), trapFocus })
</script>

<template>
  <PopoverRoot
    v-model:open="open"
    :default-open="defaultOpen"
    :modal="modal || (trapFocus ? 'trap-focus' : false)"
    v-bind="$attrs"
  >
    <slot />
  </PopoverRoot>
</template>
