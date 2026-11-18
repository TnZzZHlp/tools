<script setup lang="ts">
import { DropdownMenuGroup } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <DropdownMenuGroup v-bind="$attrs">
    <slot />
  </DropdownMenuGroup>
</template>
