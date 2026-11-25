<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionHeader, AccordionTrigger as SdkAccordionTrigger } from '@ui-sdk/vue/accordion'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionHeader class="m-0 flex">
    <SdkAccordionTrigger
      v-bind="forwarded"
      :class="
        cn(
          'group flex flex-1 cursor-pointer items-center justify-between gap-4 rounded-[6px] py-4 text-left text-[15px] font-medium text-ink',
          'outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
          'data-disabled:pointer-events-none data-disabled:opacity-55 after:hidden',
          attrs.class as ClassValue,
        )
      "
    >
      <template #render="{ props: part, state }">
        <button
          v-bind="part"
          :disabled="state.disabled || undefined"
          :data-state="state.open ? 'open' : 'closed'"
        >
          <slot />
          <slot name="icon">
            <svg
              class="size-4 shrink-0 text-ink-muted transition-[rotate,color] duration-[var(--p0seid0n-duration-normal)] ease-out-expo group-hover:text-ink group-data-open:rotate-180 motion-reduce:transition-none"
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
        </button>
      </template>
    </SdkAccordionTrigger>
  </AccordionHeader>
</template>
