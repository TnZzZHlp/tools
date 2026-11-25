<script setup lang="ts">
import { Dialog as DialogRoot } from '@ui-sdk/vue/dialog'
import { provideDialogBehaviour } from './behaviour'

defineOptions({ name: 'UiDialog', inheritAttrs: false })

export type DialogProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Closes when the pointer goes down outside the panel. */
  closeOnOutside?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<DialogProps>(), {
  defaultOpen: undefined,
  closeOnOutside: true,
  closeOnEsc: true,
})

const onOpenChange = provideDialogBehaviour({
  closeOnOutside: () => props.closeOnOutside,
  closeOnEsc: () => props.closeOnEsc,
})

const open = defineModel<boolean | undefined>('open', { default: undefined })
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
