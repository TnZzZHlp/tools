<script setup lang="ts">
import { DropdownMenuTrigger } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type DropdownMenuTriggerProps = {
  /** Renders the trigger as another element or component (for example the Button item). */
  as?: string | object
  asChild?: boolean
  disabled?: boolean
}

withDefaults(defineProps<DropdownMenuTriggerProps>(), {
  as: 'button',
  asChild: false,
  disabled: false,
})
</script>

<template>
  <DropdownMenuTrigger :as="as" :as-child="asChild" :disabled="disabled" v-bind="$attrs">
    <slot />
  </DropdownMenuTrigger>
</template>
