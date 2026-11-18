<script setup lang="ts">
import type { Component } from 'vue'
import { DialogClose, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type SheetCloseProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<SheetCloseProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <DialogClose :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </DialogClose>
</template>
