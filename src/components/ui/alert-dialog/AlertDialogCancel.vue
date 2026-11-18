<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AlertDialogCancel } from 'reka-ui'
import { buttonVariants, type ButtonSize, type ButtonVariant } from '../button'

defineOptions({ inheritAttrs: false })

export type AlertDialogCancelProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

withDefaults(defineProps<AlertDialogCancelProps>(), {
  variant: 'secondary',
  size: 'md',
  asChild: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AlertDialogCancel
    v-bind="forwarded"
    :as-child="asChild"
    :class="
      asChild
        ? cn(attrs.class as ClassValue)
        : cn(buttonVariants({ variant, size }), attrs.class as ClassValue)
    "
  >
    <slot />
  </AlertDialogCancel>
</template>
