<script setup lang="ts">
import { Tooltip as TooltipRoot } from '@ui-sdk/vue/tooltip'

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

const open = defineModel<boolean | undefined>('open', { default: undefined })
</script>

<template>
  <TooltipRoot
    v-model:open="open"
    v-bind="$attrs"
    :default-open="defaultOpen"
    :delay="delay"
    :disabled="disabled"
  >
    <slot />
  </TooltipRoot>
</template>
