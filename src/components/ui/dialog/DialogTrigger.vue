<script setup lang="ts">
import { DialogTrigger } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type DialogTriggerProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<DialogTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <DialogTrigger :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </DialogTrigger>
</template>
