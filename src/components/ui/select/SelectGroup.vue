<script setup lang="ts">
import { SelectGroup } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <SelectGroup v-bind="$attrs">
    <slot />
  </SelectGroup>
</template>
