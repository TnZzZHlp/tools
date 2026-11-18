<script setup lang="ts">
import type { Component } from 'vue'
import { PopoverTrigger, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type PopoverTriggerProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<PopoverTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <PopoverTrigger :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </PopoverTrigger>
</template>
