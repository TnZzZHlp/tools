<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { BadgePart } from './parts'
import { badgeVariants } from './variants'
import type { BadgeVariant } from './variants'

defineOptions({ name: 'UiBadge', inheritAttrs: false })

export type BadgeProps = {
  variant?: BadgeVariant
}

const props = withDefaults(defineProps<BadgeProps>(), {
  variant: 'neutral',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <BadgePart
    v-bind="forwarded"
    :class="cn(badgeVariants({ variant: props.variant }), attrs.class as ClassValue)"
  >
    <slot />
  </BadgePart>
</template>
