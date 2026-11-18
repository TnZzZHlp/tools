<script setup lang="ts">
import { DropdownMenuRadioGroup } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
</script>

<template>
  <DropdownMenuRadioGroup v-model="model" v-bind="$attrs">
    <slot />
  </DropdownMenuRadioGroup>
</template>
