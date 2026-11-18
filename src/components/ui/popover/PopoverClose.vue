<script setup lang="ts">
import type { Component } from 'vue'
import { PopoverClose, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type PopoverCloseProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<PopoverCloseProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <PopoverClose :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </PopoverClose>
</template>
