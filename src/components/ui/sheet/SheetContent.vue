<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DialogBackdrop, DialogClose, DialogContent as SdkDialogContent } from '@ui-sdk/vue/dialog'
import {
  useDialogDismiss,
  type PanelFocusProps,
  type PointerDownOutsideEvent,
} from '../dialog/behaviour'
import { sheetCloseButton, sheetVariants, type SheetSide } from './variants'

defineOptions({ inheritAttrs: false })

export type SheetContentProps = PanelFocusProps & {
  side?: SheetSide
  /** Hides the built-in close button when the panel supplies its own. */
  hideClose?: boolean
  closeOnEsc?: boolean
  closeOnOutside?: boolean
}

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: 'right',
  hideClose: false,
  initialFocus: undefined,
  finalFocus: undefined,
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

useDialogDismiss(
  {
    escapeKeyDown: (event) => emit('escapeKeyDown', event),
    pointerDownOutside: (event) => emit('pointerDownOutside', event),
    interactOutside: (event) => emit('interactOutside', event),
  },
  { closeOnEsc: () => props.closeOnEsc, closeOnOutside: () => props.closeOnOutside },
)
</script>

<template>
  <DialogBackdrop
    class="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] motion-safe:animate-fade-in data-ending-style:motion-safe:animate-fade-out"
  />
  <SdkDialogContent
    v-bind="forwarded"
    :initial-focus="initialFocus"
    :final-focus="finalFocus"
    aria-modal="true"
    :class="cn(sheetVariants({ side }), attrs.class as ClassValue)"
  >
    <slot />
    <DialogClose v-if="!hideClose" aria-label="Close" :class="sheetCloseButton">
      <span aria-hidden="true">&#215;</span>
    </DialogClose>
  </SdkDialogContent>
</template>
