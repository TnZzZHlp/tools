<script setup lang="ts">
import { AlertDialog as AlertDialogRoot } from '@ui-sdk/vue/alert-dialog'

defineOptions({ inheritAttrs: false })

export type AlertDialogProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
}

withDefaults(defineProps<AlertDialogProps>(), {
  defaultOpen: undefined,
})

const open = defineModel<boolean | undefined>('open', { default: undefined })
</script>

<template>
  <AlertDialogRoot v-model:open="open" :default-open="defaultOpen" v-bind="$attrs">
    <slot />
  </AlertDialogRoot>
</template>
