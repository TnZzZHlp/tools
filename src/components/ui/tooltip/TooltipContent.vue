<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { TooltipContent as SdkTooltipContent } from '@ui-sdk/vue/tooltip'

defineOptions({ inheritAttrs: false })

export type TooltipContentProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Keyboard shortcut hint appended after the label. */
  shortcut?: string
}

withDefaults(defineProps<TooltipContentProps>(), {
  side: 'top',
  align: 'center',
  sideOffset: 6,
  shortcut: undefined,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkTooltipContent
    v-bind="forwarded"
    :side="side"
    :align="align"
    :side-offset="sideOffset"
    :class="
      cn(
        'z-50 flex items-center gap-2 rounded-[10px] border border-line bg-raised px-2.5 py-1.5',
        'max-w-none text-[12px] font-medium text-ink shadow-popup',
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
    <kbd
      v-if="shortcut"
      class="rounded-[6px] border border-line px-1.5 py-0.5 font-sans text-[11px] text-ink-muted"
      >{{ shortcut }}</kbd
    >
  </SdkTooltipContent>
</template>
