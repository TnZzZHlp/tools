<script setup lang="ts">
import { DropdownMenuRoot } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type DropdownMenuProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Keeps the page scrollable while the menu is open. */
  modal?: boolean
}

withDefaults(defineProps<DropdownMenuProps>(), {
  defaultOpen: undefined,
  modal: false,
})

const open = defineModel<boolean>('open')
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :default-open="defaultOpen" :modal="modal" v-bind="$attrs">
    <slot />
  </DropdownMenuRoot>
</template>
