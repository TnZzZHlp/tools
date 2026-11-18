<script setup lang="ts">
import { DialogRoot } from 'reka-ui'

defineOptions({ name: 'UiSheet', inheritAttrs: false })

export type SheetProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
}

withDefaults(defineProps<SheetProps>(), {
  defaultOpen: undefined,
})

const open = defineModel<boolean>('open')
</script>

<template>
  <DialogRoot v-model:open="open" :default-open="defaultOpen" modal v-bind="$attrs">
    <slot />
  </DialogRoot>
</template>
