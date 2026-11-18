<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionContent } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionContent
    v-bind="forwarded"
    class="overflow-hidden text-[14px] leading-relaxed text-ink-muted data-[state=open]:motion-safe:animate-accordion-down data-[state=closed]:motion-safe:animate-accordion-up"
  >
    <div :class="cn('pt-0 pb-4', attrs.class as ClassValue)">
      <slot />
    </div>
  </AccordionContent>
</template>
