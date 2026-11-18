<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionItem } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type AccordionItemProps = {
  value: string
  disabled?: boolean
}

withDefaults(defineProps<AccordionItemProps>(), {
  disabled: false,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionItem
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :class="cn('border-b border-line last:border-b-0', attrs.class as ClassValue)"
  >
    <slot />
  </AccordionItem>
</template>
