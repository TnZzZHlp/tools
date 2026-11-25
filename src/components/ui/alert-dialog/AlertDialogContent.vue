<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import {
  AlertDialogBackdrop,
  AlertDialogContent as SdkAlertDialogContent,
} from '@ui-sdk/vue/alert-dialog'
import type { DialogFinalFocus, DialogInitialFocus } from '@ui-sdk/vue/dialog'

defineOptions({ inheritAttrs: false })

export type AlertDialogContentProps = {
  initialFocus?: DialogInitialFocus
  finalFocus?: DialogFinalFocus
}

withDefaults(defineProps<AlertDialogContentProps>(), {
  initialFocus: '[data-p0seid0n-alert-cancel]',
  finalFocus: undefined,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AlertDialogBackdrop
    class="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] motion-safe:animate-fade-in data-ending-style:motion-safe:animate-fade-out"
  />
  <SdkAlertDialogContent
    v-bind="forwarded"
    :initial-focus="initialFocus"
    :final-focus="finalFocus"
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
  </SdkAlertDialogContent>
</template>
