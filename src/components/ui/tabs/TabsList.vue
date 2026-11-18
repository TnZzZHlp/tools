<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsIndicator, TabsList } from 'reka-ui'
import { tabIndicator, tabList } from './styles'

defineOptions({ inheritAttrs: false })

export type TabsListProps = {
  /** Wraps focus from the last trigger to the first. */
  loop?: boolean
}

withDefaults(defineProps<TabsListProps>(), {
  loop: true,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

const ready = ref(false)
let frameId: number | undefined

onMounted(async () => {
  // Wait one frame after TabsIndicator measures the initial active tab so the
  // indicator never slides in from x=0 on first paint.
  await nextTick()
  frameId = window.requestAnimationFrame(() => {
    ready.value = true
  })
})

onBeforeUnmount(() => {
  if (frameId !== undefined) window.cancelAnimationFrame(frameId)
})
</script>

<template>
  <TabsList
    v-bind="forwarded"
    :loop="loop"
    :data-ready="ready ? '' : undefined"
    :class="cn(tabList, attrs.class as ClassValue)"
  >
    <TabsIndicator :class="tabIndicator" />
    <slot />
  </TabsList>
</template>
