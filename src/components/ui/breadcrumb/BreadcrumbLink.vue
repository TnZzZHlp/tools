<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BreadcrumbLinkPart } from './parts'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type BreadcrumbLinkProps = {
  as?: string | Component
  asChild?: boolean
}

withDefaults(defineProps<BreadcrumbLinkProps>(), {
  as: 'a',
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
  <BreadcrumbLinkPart
    v-bind="forwarded"
    :class="
      cn(
        'rounded-[6px] text-ink-muted no-underline transition-colors duration-[var(--p0seid0n-duration-fast)] ease-out-expo hover:text-ink',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none',
        attrs.class as ClassValue,
      )
    "
  >
    <template #render="{ props: rendered }">
      <RenderChild v-if="asChild" v-bind="rendered"><slot /></RenderChild>
      <component :is="as" v-else v-bind="rendered"><slot /></component>
    </template>
  </BreadcrumbLinkPart>
</template>
