<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsTab } from '@ui-sdk/vue/tabs'
import { encodeTab } from './context'
import { tabTrigger } from './styles'

defineOptions({ inheritAttrs: false })

export type TabsTriggerProps = {
  value: string | number
  disabled?: boolean
}

withDefaults(defineProps<TabsTriggerProps>(), {
  disabled: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TabsTab
    v-bind="forwarded"
    :value="encodeTab(value)"
    :disabled="disabled"
    :class="cn(tabTrigger, attrs.class as ClassValue)"
  >
    <slot />
  </TabsTab>
</template>
