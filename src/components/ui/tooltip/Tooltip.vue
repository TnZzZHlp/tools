<script setup lang="ts">
import { TooltipProvider, TooltipRoot } from 'reka-ui'

defineOptions({ name: 'UiTooltip', inheritAttrs: false })

export type TooltipProps = {
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Milliseconds the pointer must rest before the tip opens. */
  delay?: number
  disabled?: boolean
}

withDefaults(defineProps<TooltipProps>(), {
  defaultOpen: undefined,
  delay: 300,
  disabled: false,
})

const open = defineModel<boolean>('open')
</script>

<template>
  <TooltipProvider :delay-duration="delay" :disabled="disabled">
    <TooltipRoot v-model:open="open" :default-open="defaultOpen" v-bind="$attrs">
      <slot />
    </TooltipRoot>
  </TooltipProvider>
</template>
