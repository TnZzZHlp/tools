<script setup lang="ts">
import { computed, useAttrs, useTemplateRef, type ComponentPublicInstance } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectContent as SdkSelectContent, SelectList } from '@ui-sdk/vue/select'
import SelectScrollButton from './SelectScrollButton.vue'
import { useSelectScroll } from './scroll'
import { selectSurface } from './styles'

defineOptions({ inheritAttrs: false })

export type SelectContentProps = {
  position?: 'popper' | 'item-aligned'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<SelectContentProps>(), {
  position: 'popper',
  side: 'bottom',
  sideOffset: 6,
  align: 'start',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
const list = useTemplateRef<ComponentPublicInstance>('list')
const listElement = computed<HTMLElement | null>(() => {
  const node = list.value?.$el
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null
})
const { canScrollUp, canScrollDown, scroll } = useSelectScroll(listElement)
</script>

<template>
  <SdkSelectContent
    v-bind="forwarded"
    :align-item-with-trigger="props.position === 'item-aligned'"
    :side="props.side"
    :side-offset="props.sideOffset"
    :align="props.align"
    :class="
      cn(
        selectSurface,
        props.position === 'popper' && 'min-w-[max(8rem,var(--anchor-width,0px))]',
        attrs.class as ClassValue,
      )
    "
  >
    <SelectScrollButton v-if="canScrollUp" direction="up" @scroll="scroll(-1)" />
    <SelectList ref="list" class="min-h-0 overflow-y-auto p-1.5">
      <slot />
    </SelectList>
    <SelectScrollButton v-if="canScrollDown" direction="down" @scroll="scroll(1)" />
  </SdkSelectContent>
</template>
