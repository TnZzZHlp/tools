<script setup lang="ts">
import { TooltipTrigger } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type TooltipTriggerProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<TooltipTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <TooltipTrigger :as="as" :as-child="asChild" v-bind="$attrs">
    <slot />
  </TooltipTrigger>
</template>
