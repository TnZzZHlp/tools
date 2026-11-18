<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsContent } from 'reka-ui'
import { tabPanel } from './styles'

defineOptions({ inheritAttrs: false })

export type TabsContentProps = {
  value: string | number
  forceMount?: boolean
}

withDefaults(defineProps<TabsContentProps>(), {
  forceMount: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TabsContent
    v-bind="forwarded"
    :value="value"
    :force-mount="forceMount"
    :class="cn(tabPanel, attrs.class as ClassValue)"
  >
    <slot />
  </TabsContent>
</template>
