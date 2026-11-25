<script setup lang="ts">
import { computed, inject, onScopeDispose, useAttrs, watchEffect } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { PopoverContent as SdkPopoverContent } from '@ui-sdk/vue/popover'
import { popoverContext } from './context'

defineOptions({ inheritAttrs: false })

export type PopoverContentProps = {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  trapFocus?: boolean
}

const props = withDefaults(defineProps<PopoverContentProps>(), {
  align: 'center',
  side: 'bottom',
  sideOffset: 8,
  trapFocus: false,
})

const context = inject(popoverContext)
const anchor = context?.anchor
if (context) {
  watchEffect(() => {
    context.trapFocus.value = props.trapFocus
  })
  onScopeDispose(() => {
    context.trapFocus.value = false
  })
}

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkPopoverContent
    v-bind="forwarded"
    :align="align"
    :side="side"
    :side-offset="sideOffset"
    :anchor="anchor"
    :class="
      cn(
        'z-50 w-72 rounded-panel border border-line bg-raised p-4 text-[14px] text-ink shadow-popup outline-none',
        'origin-[var(--transform-origin)]',
        'data-[side=bottom]:[--p0seid0n-pop-y:-4px]',
        'data-[side=top]:[--p0seid0n-pop-y:4px]',
        'data-[side=left]:[--p0seid0n-pop-x:4px] data-[side=left]:[--p0seid0n-pop-y:0px]',
        'data-[side=right]:[--p0seid0n-pop-x:-4px] data-[side=right]:[--p0seid0n-pop-y:0px]',
        'motion-safe:animate-pop-in data-ending-style:motion-safe:animate-pop-out',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </SdkPopoverContent>
</template>
