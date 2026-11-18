<script setup lang="ts">
import { AlertDialogRoot } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type AlertDialogProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
}

withDefaults(defineProps<AlertDialogProps>(), {
  defaultOpen: undefined,
})

const open = defineModel<boolean>('open')
</script>

<template>
  <AlertDialogRoot v-model:open="open" :default-open="defaultOpen" v-bind="$attrs">
    <slot />
  </AlertDialogRoot>
</template>
