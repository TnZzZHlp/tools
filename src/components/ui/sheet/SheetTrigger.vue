<script setup lang="ts">
import type { Component } from 'vue'
import { DialogTrigger, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type SheetTriggerProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<SheetTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <DialogTrigger :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </DialogTrigger>
</template>
