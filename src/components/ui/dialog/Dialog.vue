<script setup lang="ts">
import { DialogRoot } from 'reka-ui'
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

// Passed as thunks rather than as props so the flags are read at event time.
provideDialogBehaviour({
  closeOnOutside: () => props.closeOnOutside,
  closeOnEsc: () => props.closeOnEsc,
})

const open = defineModel<boolean>('open')
</script>

<template>
  <DialogRoot v-model:open="open" :default-open="defaultOpen" modal v-bind="$attrs">
    <slot />
  </DialogRoot>
</template>
