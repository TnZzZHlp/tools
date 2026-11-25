<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AlertDialogClose } from '@ui-sdk/vue/alert-dialog'
import { RenderChild } from '@/lib/render-child'
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
  <AlertDialogClose
    v-bind="forwarded"
    data-p0seid0n-alert-cancel
    value="cancel"
    :class="
      asChild
        ? cn(attrs.class as ClassValue)
        : cn('h-auto border-0', buttonVariants({ variant, size }), attrs.class as ClassValue)
    "
  >
    <template v-if="asChild" #render="{ props: part }">
      <RenderChild v-bind="part"><slot /></RenderChild>
    </template>
    <slot v-if="!asChild" />
  </AlertDialogClose>
</template>
