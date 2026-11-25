<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DialogBackdrop, DialogClose, DialogContent as SdkDialogContent } from '@ui-sdk/vue/dialog'
import { useDialogDismiss, type PanelFocusProps, type PointerDownOutsideEvent } from './behaviour'
import { closeButton } from './styles'

defineOptions({ inheritAttrs: false })

export type DialogContentProps = PanelFocusProps & {
  /** Hides the built-in close button when the panel supplies its own. */
  hideClose?: boolean
}

withDefaults(defineProps<DialogContentProps>(), {
  hideClose: false,
  initialFocus: undefined,
  finalFocus: undefined,
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

useDialogDismiss({
  escapeKeyDown: (event) => emit('escapeKeyDown', event),
  pointerDownOutside: (event) => emit('pointerDownOutside', event),
  interactOutside: (event) => emit('interactOutside', event),
})
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
    :class="
      cn(
        'fixed inset-0 z-50 m-auto block h-fit w-[min(28rem,calc(100vw-2rem))]',
        'rounded-panel border border-line bg-raised p-6 shadow-popup outline-none',
        'motion-safe:animate-dialog-in data-ending-style:motion-safe:animate-dialog-out',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
    <DialogClose v-if="!hideClose" aria-label="Close" :class="closeButton">
      <span aria-hidden="true">&#215;</span>
    </DialogClose>
  </SdkDialogContent>
</template>
