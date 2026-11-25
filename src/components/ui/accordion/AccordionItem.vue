<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionItem as SdkAccordionItem } from '@ui-sdk/vue/accordion'

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
  <SdkAccordionItem
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :class="cn('border-b border-line last:border-b-0', attrs.class as ClassValue)"
  >
    <slot />
  </SdkAccordionItem>
</template>
