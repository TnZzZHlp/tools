<script setup lang="ts">
import type { Component } from 'vue'
import { AlertDialogTrigger, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type AlertDialogTriggerProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<AlertDialogTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <AlertDialogTrigger :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </AlertDialogTrigger>
</template>
