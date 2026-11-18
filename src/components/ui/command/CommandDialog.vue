<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog'
import Command from './Command.vue'

defineOptions({ inheritAttrs: false })

export type CommandDialogProps = {
  defaultOpen?: boolean
  title?: string
  description?: string
  closeOnEsc?: boolean
  closeOnOutside?: boolean
}

withDefaults(defineProps<CommandDialogProps>(), {
  defaultOpen: undefined,
  title: 'Command menu',
  description: 'Search for a command to run.',
  closeOnEsc: true,
  closeOnOutside: true,
})

const open = defineModel<boolean>('open')

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <Dialog
    v-model:open="open"
    :default-open="defaultOpen"
    :close-on-esc="closeOnEsc"
    :close-on-outside="closeOnOutside"
  >
    <DialogContent
      v-bind="forwarded"
      hide-close
      :class="cn('overflow-hidden p-0', attrs.class as ClassValue)"
    >
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>
      <DialogDescription class="sr-only">{{ description }}</DialogDescription>
      <Command class="rounded-none border-0 bg-transparent">
        <slot />
      </Command>
    </DialogContent>
  </Dialog>
</template>
