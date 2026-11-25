<script setup lang="ts">
import { Dialog as DialogRoot } from '@ui-sdk/vue/dialog'
import { provideDialogBehaviour } from '../dialog/behaviour'

defineOptions({ name: 'UiSheet', inheritAttrs: false })

export type SheetProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
}

withDefaults(defineProps<SheetProps>(), {
  defaultOpen: undefined,
})

const open = defineModel<boolean | undefined>('open', { default: undefined })
const onOpenChange = provideDialogBehaviour()
</script>

<template>
  <DialogRoot
    v-model:open="open"
    :default-open="defaultOpen"
    modal
    v-bind="$attrs"
    @open-change="onOpenChange"
  >
    <slot />
  </DialogRoot>
</template>
