<script setup lang="ts">
import { SelectGroup as SdkSelectGroup } from '@ui-sdk/vue/select'
import { provide } from 'vue'
import { selectGroup } from './selection'

defineOptions({ inheritAttrs: false })

provide(selectGroup, true)
</script>

<template>
  <SdkSelectGroup v-bind="$attrs">
    <slot />
  </SdkSelectGroup>
</template>
