<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import {
  SelectContent,
  SelectPortal,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectViewport,
} from 'reka-ui'
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
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="forwarded"
      :position="props.position"
      :side="props.side"
      :side-offset="props.sideOffset"
      :align="props.align"
      :class="cn(selectSurface, attrs.class as ClassValue)"
    >
      <SelectScrollUpButton
        class="flex cursor-default items-center justify-center py-1 text-ink-muted"
      >
        <svg
          class="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m4 10 4-4 4 4" />
        </svg>
      </SelectScrollUpButton>
      <SelectViewport
        :class="
          cn(
            'p-1.5',
            props.position === 'popper' &&
              'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)]',
          )
        "
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton
        class="flex cursor-default items-center justify-center py-1 text-ink-muted"
      >
        <svg
          class="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </SelectScrollDownButton>
    </SelectContent>
  </SelectPortal>
</template>
