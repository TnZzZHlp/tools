<script setup lang="ts">
import { Menu as SdkMenu } from '@ui-sdk/vue/menu'

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

const open = defineModel<boolean | undefined>('open', { default: undefined })
</script>

<template>
  <SdkMenu v-model:open="open" :default-open="defaultOpen" :modal="modal" v-bind="$attrs">
    <slot />
  </SdkMenu>
</template>
