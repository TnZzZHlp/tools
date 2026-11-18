<script setup lang="ts">
import { SelectValue } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type SelectValueProps = {
  placeholder?: string
}

withDefaults(defineProps<SelectValueProps>(), {
  placeholder: undefined,
})
</script>

<template>
  <SelectValue v-if="$slots.default" v-slot="slotProps" :placeholder="placeholder" v-bind="$attrs">
    <slot v-bind="slotProps" />
  </SelectValue>
  <SelectValue v-else :placeholder="placeholder" v-bind="$attrs" />
</template>
