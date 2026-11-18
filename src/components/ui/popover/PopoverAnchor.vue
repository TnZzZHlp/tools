<script setup lang="ts">
import type { Component } from 'vue'
import { PopoverAnchor, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type PopoverAnchorProps = {
  as?: AsTag | Component
  asChild?: boolean
}

withDefaults(defineProps<PopoverAnchorProps>(), {
  as: 'div',
  asChild: false,
})
</script>

<template>
  <PopoverAnchor :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </PopoverAnchor>
</template>
