<script setup lang="ts">
import { MenuGroup as SdkMenuGroup } from '@ui-sdk/vue/menu'
import { provide } from 'vue'
import { menuGroup } from './selection'

defineOptions({ inheritAttrs: false })

provide(menuGroup, true)
</script>

<template>
  <SdkMenuGroup v-bind="$attrs">
    <slot />
  </SdkMenuGroup>
</template>
