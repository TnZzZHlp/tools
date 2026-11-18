<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionHeader, AccordionTrigger } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      v-bind="forwarded"
      :class="
        cn(
          'group flex flex-1 cursor-pointer items-center justify-between gap-4 rounded-[6px] py-4 text-left text-[15px] font-medium text-ink',
          'outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
          'disabled:pointer-events-none disabled:opacity-55',
          attrs.class as ClassValue,
        )
      "
    >
      <slot />
      <slot name="icon">
        <svg
          class="size-4 shrink-0 text-ink-muted transition-transform duration-[var(--p0seid0n-duration-normal)] ease-out-expo group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </slot>
    </AccordionTrigger>
  </AccordionHeader>
</template>
