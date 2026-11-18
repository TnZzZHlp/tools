<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Primitive, type AsTag } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type BreadcrumbLinkProps = {
  as?: AsTag | Component
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
  <Primitive
    v-bind="forwarded"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        'rounded-[6px] text-ink-muted transition-colors duration-[var(--p0seid0n-duration-fast)] ease-out-expo hover:text-ink',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </Primitive>
</template>
