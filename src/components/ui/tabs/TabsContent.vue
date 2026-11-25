<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsPanel } from '@ui-sdk/vue/tabs'
import { encodeTab, tabsContext } from './context'
import { tabPanel } from './styles'

defineOptions({ inheritAttrs: false })

export type TabsContentProps = {
  value: string | number
  forceMount?: boolean
}

withDefaults(defineProps<TabsContentProps>(), {
  forceMount: false,
})

const context = inject(tabsContext)
const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <TabsPanel
    v-bind="forwarded"
    :value="encodeTab(value)"
    :keep-mounted="forceMount || !context?.unmountOnHide.value"
    :class="cn(tabPanel, attrs.class as ClassValue)"
  >
    <template #render="{ props: part, state }">
      <div
        v-bind="part"
        :hidden="!forceMount && part.hidden != null && part.hidden !== false"
        :data-state="state.selected ? 'active' : 'inactive'"
      >
        <slot />
      </div>
    </template>
  </TabsPanel>
</template>
