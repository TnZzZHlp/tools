<script setup lang="ts">
import { MenuGroup as SdkMenuGroup } from '@ui-sdk/vue/menu'
import { provide } from 'vue'
import { menuGroup, menuRadioValue } from './selection'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
provide(menuRadioValue, model)
provide(menuGroup, true)
</script>

<template>
  <SdkMenuGroup v-bind="$attrs">
    <slot />
  </SdkMenuGroup>
</template>
