<script setup lang="ts">
import { Tabs as TabsRoot } from '@ui-sdk/vue/tabs'
import { computed, provide, ref, toRef } from 'vue'
import { decodeTab, encodeTab, tabsContext } from './context'

defineOptions({ name: 'UiTabs', inheritAttrs: false })

export type TabsProps = {
  defaultValue?: string | number
  orientation?: 'horizontal' | 'vertical'
  /** 'automatic' follows arrow keys; 'manual' waits for Enter or Space. */
  activationMode?: 'automatic' | 'manual'
  /** Unmounts inactive panels instead of hiding them. */
  unmountOnHide?: boolean
}

const props = withDefaults(defineProps<TabsProps>(), {
  defaultValue: undefined,
  orientation: 'horizontal',
  activationMode: 'automatic',
  unmountOnHide: false,
})

const model = defineModel<string | number>()
const loop = ref(true)
provide(tabsContext, { loop, unmountOnHide: toRef(props, 'unmountOnHide') })

const value = computed(() => (model.value === undefined ? undefined : encodeTab(model.value)))
const initial = computed(() =>
  props.defaultValue === undefined ? undefined : encodeTab(props.defaultValue),
)
</script>

<template>
  <TabsRoot
    v-bind="$attrs"
    :value="value"
    :default-value="initial"
    class="block"
    :orientation="orientation"
    :activation="activationMode"
    :loop="loop"
    @update:value="model = $event === null ? undefined : decodeTab($event)"
  >
    <slot />
  </TabsRoot>
</template>
