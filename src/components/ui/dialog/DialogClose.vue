<script setup lang="ts">
import { DialogClose } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type DialogCloseProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<DialogCloseProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <DialogClose :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </DialogClose>
</template>
