<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watchEffect,
} from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TabsIndicator, TabsList as SdkTabsList } from '@ui-sdk/vue/tabs'
import { tabsContext } from './context'
import { tabIndicator, tabList } from './styles'

defineOptions({ inheritAttrs: false })

export type TabsListProps = {
  /** Wraps focus from the last trigger to the first. */
  loop?: boolean
}

const props = withDefaults(defineProps<TabsListProps>(), {
  loop: true,
})

const context = inject(tabsContext)
watchEffect(() => {
  if (context) context.loop.value = props.loop
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
  <SdkTabsList
    v-bind="forwarded"
    :data-ready="ready ? '' : undefined"
    :class="cn(tabList, attrs.class as ClassValue)"
  >
    <TabsIndicator :class="tabIndicator" />
    <slot />
  </SdkTabsList>
</template>
