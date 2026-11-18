<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AlertDialogContent, AlertDialogOverlay, AlertDialogPortal } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      class="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] motion-safe:animate-fade-in data-[state=closed]:motion-safe:animate-fade-out"
    />
    <AlertDialogContent
      v-bind="forwarded"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'rounded-panel border border-line bg-raised p-6 shadow-popup outline-none',
          'motion-safe:animate-dialog-in data-[state=closed]:motion-safe:animate-dialog-out',
          attrs.class as ClassValue,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
