<script setup lang="ts">
import { PopoverRoot } from 'reka-ui'

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

const open = defineModel<boolean>('open')
</script>

<template>
  <PopoverRoot v-model:open="open" :default-open="defaultOpen" :modal="modal" v-bind="$attrs">
    <slot />
  </PopoverRoot>
</template>
