<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  type PointerDownOutsideEvent,
} from 'reka-ui'
import { sheetCloseButton, sheetVariants, type SheetSide } from './variants'

defineOptions({ inheritAttrs: false })

export type SheetContentProps = {
  side?: SheetSide
  /** Hides the built-in close button when the panel supplies its own. */
  hideClose?: boolean
  closeOnEsc?: boolean
  closeOnOutside?: boolean
}

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: 'right',
  hideClose: false,
  closeOnEsc: true,
  closeOnOutside: true,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

const emit = defineEmits<{
  escapeKeyDown: [event: KeyboardEvent]
  pointerDownOutside: [event: PointerDownOutsideEvent]
  interactOutside: [event: Event]
}>()

function onEscapeKeyDown(event: KeyboardEvent): void {
  if (!props.closeOnEsc) event.preventDefault()
  emit('escapeKeyDown', event)
}

function onPointerDownOutside(event: PointerDownOutsideEvent): void {
  if (!props.closeOnOutside) event.preventDefault()
  emit('pointerDownOutside', event)
}

function onInteractOutside(event: Event): void {
  emit('interactOutside', event)
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] motion-safe:animate-fade-in data-[state=closed]:motion-safe:animate-fade-out"
    />
    <DialogContent
      v-bind="forwarded"
      aria-modal="true"
      :class="cn(sheetVariants({ side }), attrs.class as ClassValue)"
      @escape-key-down="onEscapeKeyDown"
      @pointer-down-outside="onPointerDownOutside"
      @interact-outside="onInteractOutside"
    >
      <slot />
      <DialogClose v-if="!hideClose" aria-label="Close" :class="sheetCloseButton">
        <span aria-hidden="true">&#215;</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
