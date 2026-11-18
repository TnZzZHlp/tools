<script setup lang="ts">
import { TabsRoot } from 'reka-ui'

defineOptions({ name: 'UiTabs', inheritAttrs: false })

export type TabsProps = {
  orientation?: 'horizontal' | 'vertical'
  /** 'automatic' follows arrow keys; 'manual' waits for Enter or Space. */
  activationMode?: 'automatic' | 'manual'
  /** Unmounts inactive panels instead of hiding them. */
  unmountOnHide?: boolean
}

withDefaults(defineProps<TabsProps>(), {
  orientation: 'horizontal',
  activationMode: 'automatic',
  unmountOnHide: false,
})

const model = defineModel<string | number>()
</script>

<template>
  <TabsRoot
    v-model="model"
    v-bind="$attrs"
    :orientation="orientation"
    :activation-mode="activationMode"
    :unmount-on-hide="unmountOnHide"
  >
    <slot />
  </TabsRoot>
</template>
