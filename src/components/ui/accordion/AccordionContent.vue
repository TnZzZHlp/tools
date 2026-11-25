<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AccordionPanel } from '@ui-sdk/vue/accordion'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AccordionPanel
    v-bind="forwarded"
    class="h-[var(--accordion-panel-height)] overflow-hidden p-0 text-[14px] leading-relaxed text-ink-muted motion-safe:transition-[height,opacity] motion-safe:duration-[var(--p0seid0n-duration-normal)] motion-safe:ease-out-expo motion-safe:data-starting-style:h-0 motion-safe:data-starting-style:opacity-0 motion-safe:data-ending-style:h-0 motion-safe:data-ending-style:opacity-0"
  >
    <template #render="{ props: part, state }">
      <div v-bind="part" :data-state="state.open ? 'open' : 'closed'">
        <div :class="cn('pt-0 pb-4 [&>p]:m-0', attrs.class as ClassValue)">
          <slot />
        </div>
      </div>
    </template>
  </AccordionPanel>
</template>
