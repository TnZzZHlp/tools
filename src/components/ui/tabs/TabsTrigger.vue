<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsTrigger } from 'reka-ui'
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
  <TabsTrigger
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :class="cn(tabTrigger, attrs.class as ClassValue)"
  >
    <slot />
  </TabsTrigger>
</template>
